import { Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type {
  ConversationOpenResult,
  ConversationRef,
  HandshakeAuth,
  HandshakeErrorCode,
  StoredEventPayloads,
} from 'chat-events';
import { ConversationNotFoundError } from '../conversations/conversation-not-found.error';
import { ConversationsService } from '../conversations/conversations.service';
import { Env } from '../config/env.schema';
import { readSessionCookie } from '../sessions/session-cookie';
import { SessionsService } from '../sessions/sessions.service';
import { UnauthenticatedError } from '../sessions/unauthenticated.error';
import {
  conversationRoom,
  emitStoredEvent,
  isStoredEventName,
  personRoom,
  sessionRoom,
} from './realtime-socket';
import { EventsStore } from './events.store';
import { SESSION_RECHECK_INTERVAL_MS } from './realtime-values';
import type { RealtimeServer, RealtimeSocket } from './realtime-socket';

const UNAUTHENTICATED: HandshakeErrorCode = 'unauthenticated';

// WebSocket da API do chat (spec da F03, "Conexão" e "Sessão no WebSocket"). O handshake verifica a
// Sessão pelo mesmo authenticate do guard REST e põe o socket nas salas da Pessoa e da Sessão.

@WebSocketGateway()
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnModuleDestroy
{
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server!: RealtimeServer;

  constructor(
    private readonly sessions: SessionsService,
    private readonly config: ConfigService<Env, true>,
    private readonly conversations: ConversationsService,
    private readonly events: EventsStore,
  ) {}

  private recheckTimer?: ReturnType<typeof setInterval>;
  private stopListening?: () => void;

  afterInit(server: RealtimeServer): void {
    // Sair desconecta na hora as abas daquela Sessão (LLD, "Sessão e login", "WebSocket").
    this.stopListening = this.sessions.onSessionEnded((sessionId) =>
      this.endSession(server, sessionRoom(sessionId)),
    );
    // Uma volta lenta não se sobrepõe à seguinte: a próxima só começa quando esta termina.
    let isRechecking = false;
    this.recheckTimer = setInterval(() => {
      if (isRechecking) return;
      isRechecking = true;
      this.recheckSessions()
        .catch((error: unknown) =>
          this.logger.error('Falha na reconferência das Sessões', error),
        )
        .finally(() => {
          isRechecking = false;
        });
    }, SESSION_RECHECK_INTERVAL_MS);
    this.recheckTimer.unref();
    const cookieName = this.config.get('SESSION_COOKIE_NAME', { infer: true });
    server.use((socket, next) => {
      void this.authenticateSocket(socket, cookieName, next);
    });
  }

  // Na conexão, a aba recebe os eventos que perdeu desde o cursor que mandou e então o sync (spec
  // da F03, "Eventos por Pessoa e reconexão"). As salas já entraram no handshake, então um evento
  // novo pode chegar no meio do reenvio: a aba guarda tudo até o sync e aplica em ordem. Sem
  // cursor, com o cursor perdido ou com o Redis fora, o sync pede que a aba recarregue a página
  // mais recente.
  async handleConnection(socket: RealtimeSocket): Promise<void> {
    const personId = socket.data.person.id;
    const auth = socket.handshake.auth as HandshakeAuth | undefined;
    const cursor = typeof auth?.cursor === 'string' ? auth.cursor : undefined;
    try {
      if (!cursor) {
        socket.emit('sync', {
          cursor: await this.events.currentCursor(personId),
          reset: true,
        });
        return;
      }
      const result = await this.events.readSince(personId, cursor);
      if (result.kind === 'lost') {
        socket.emit('sync', { cursor: result.cursor, reset: true });
        return;
      }
      // Os eventos guardados voltam na ordem do stream; um nome desconhecido, de uma versão
      // anterior ou posterior, fica de fora.
      for (const event of result.events) {
        if (!isStoredEventName(event.name)) continue;
        emitStoredEvent(socket, event.name, {
          ...(event.payload as StoredEventPayloads[typeof event.name]),
          event_id: event.cursor,
        });
      }
      socket.emit('sync', { cursor: result.cursor, reset: false });
    } catch (error) {
      this.logger.error('Falha ao ler os eventos da reconexão', error);
      socket.emit('sync', { cursor: null, reset: true });
    }
  }

  // A aba abre uma Conversa: confere a participação, como o REST, e põe o socket na sala dela, saindo
  // da Conversa que tinha aberto antes (spec da F03, "Digitando").
  @SubscribeMessage('conversation.open')
  async openConversation(
    @ConnectedSocket() socket: RealtimeSocket,
    @MessageBody() event: ConversationRef,
  ): Promise<ConversationOpenResult> {
    const conversationId = conversationIdOf(event) ?? '';
    const request = nextRoomRequest(socket);
    const isStale = () => socket.data.roomRequest !== request;
    try {
      await this.conversations.getForMember(
        socket.data.person.id,
        conversationId,
      );
    } catch (error) {
      if (error instanceof ConversationNotFoundError) {
        return { ok: false, code: 'conversation_not_found' };
      }
      throw error;
    }
    // Outra abertura, ou o fechamento, chegou enquanto esta conferia a participação.
    if (isStale()) return { ok: true };
    if (socket.data.conversationId !== conversationId) {
      await this.leaveConversation(socket);
      if (isStale()) return { ok: true };
    }
    socket.data.conversationId = conversationId;
    await socket.join(conversationRoom(conversationId));
    // Uma operação mais nova chegou durante a entrada: ela vale, e esta sai da sala que ocupou.
    if (isStale() && socket.data.conversationId !== conversationId) {
      await socket.leave(conversationRoom(conversationId));
    }
    return { ok: true };
  }

  @SubscribeMessage('conversation.close')
  async closeConversation(
    @ConnectedSocket() socket: RealtimeSocket,
    @MessageBody() event: ConversationRef,
  ): Promise<void> {
    const conversationId = conversationIdOf(event);
    if (!conversationId) return;
    nextRoomRequest(socket);
    if (socket.data.conversationId === conversationId) {
      await this.leaveConversation(socket);
    }
  }

  // Sai da sala da Conversa aberta. Quem estava digitando nela deixa de estar para os outros, sem
  // esperar o prazo vencer.
  private async leaveConversation(socket: RealtimeSocket): Promise<void> {
    const conversationId = socket.data.conversationId;
    if (!conversationId) return;
    this.relayTyping(
      socket,
      { conversation_id: conversationId },
      'typing.stop',
    );
    socket.data.conversationId = undefined;
    await socket.leave(conversationRoom(conversationId));
  }

  @SubscribeMessage('typing.start')
  typingStart(
    @ConnectedSocket() socket: RealtimeSocket,
    @MessageBody() event: ConversationRef,
  ): void {
    this.relayTyping(socket, event, 'typing.start');
  }

  @SubscribeMessage('typing.stop')
  typingStop(
    @ConnectedSocket() socket: RealtimeSocket,
    @MessageBody() event: ConversationRef,
  ): void {
    this.relayTyping(socket, event, 'typing.stop');
  }

  // O "digitando" só passa entre as abas com a Conversa aberta, sem as da própria Pessoa, e não é
  // guardado. A participação já foi conferida no conversation.open: aqui basta a sala.
  private relayTyping(
    socket: RealtimeSocket,
    event: ConversationRef,
    name: 'typing.start' | 'typing.stop',
  ): void {
    const conversationId = conversationIdOf(event);
    if (!conversationId) return;
    const room = conversationRoom(conversationId);
    if (!socket.rooms.has(room)) return;
    const { id, name: personName } = socket.data.person;
    socket
      .to(room)
      .except(personRoom(id))
      .emit(name, {
        conversation_id: conversationId,
        person: { id, name: personName },
      });
  }

  onModuleDestroy(): void {
    clearInterval(this.recheckTimer);
    this.stopListening?.();
  }

  // Reconfere as Sessões das abas conectadas, uma vez por Sessão e uma de cada vez, para não
  // disputar o pool do banco com as requisições. Usa o mesmo authenticate do REST, que também a
  // renova. A Sessão revogada ou vencida encerra as abas dela; outra falha, como o banco fora, as
  // mantém até a próxima volta.
  async recheckSessions(): Promise<void> {
    const tokens = new Map<string, string>();
    for (const socket of this.server.sockets.sockets.values()) {
      if (socket.data.sessionId) {
        tokens.set(socket.data.sessionId, socket.data.sessionToken);
      }
    }
    for (const [sessionId, token] of tokens) {
      try {
        await this.sessions.authenticate(token);
      } catch (error) {
        if (error instanceof UnauthenticatedError) {
          this.endSession(this.server, sessionRoom(sessionId));
        } else {
          this.logger.error('Falha ao reconferir a Sessão no WebSocket', error);
        }
      }
    }
  }

  // Avisa a aba de que a Sessão acabou e a desconecta.
  private endSession(server: RealtimeServer, room: string): void {
    server.to(room).emit('session.ended');
    server.in(room).disconnectSockets(true);
  }

  // Grava a Pessoa e a Sessão no socket, ou recusa o handshake.
  private async authenticateSocket(
    socket: RealtimeSocket,
    cookieName: string,
    next: (error?: Error) => void,
  ): Promise<void> {
    const token = readSessionCookie(
      socket.handshake.headers.cookie,
      cookieName,
    );
    try {
      const { person, sessionId } = await this.sessions.authenticate(token);
      socket.data.person = person;
      socket.data.sessionId = sessionId;
      socket.data.sessionToken = token ?? '';
      // As salas entram antes do CONNECT: nenhum evento emitido logo depois se perde.
      await socket.join([personRoom(person.id), sessionRoom(sessionId)]);
      next();
    } catch (error) {
      if (error instanceof UnauthenticatedError) {
        next(new Error(UNAUTHENTICATED));
        return;
      }
      // Outra falha também recusa, com outra mensagem: o cliente tenta de novo.
      this.logger.error('Falha ao verificar a Sessão no handshake', error);
      next(new Error('internal_error'));
    }
  }
}

// O id da Conversa de um evento da aba, que pode chegar sem carga ou com outro tipo.
function conversationIdOf(
  event: ConversationRef | undefined,
): string | undefined {
  const conversationId = event?.conversation_id;
  return typeof conversationId === 'string' ? conversationId : undefined;
}

function nextRoomRequest(socket: RealtimeSocket): number {
  socket.data.roomRequest = (socket.data.roomRequest ?? 0) + 1;
  return socket.data.roomRequest;
}
