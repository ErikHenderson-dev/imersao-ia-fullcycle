import type {
  ClientToServerEvents,
  ServerToClientEvents,
  StoredEvent,
  StoredEventName,
} from 'chat-events';
import type { BroadcastOperator, Server, Socket } from 'socket.io';
import type { Person } from '../people/person.entity';

// O que o handshake grava no socket depois de verificar a Sessão.
export interface RealtimeSocketData {
  person: Person;
  sessionId: string;
  // O token da Sessão, para a reconferência periódica.
  sessionToken: string;
  // A Conversa aberta na aba, cuja sala o socket ocupa (spec da F03, "Digitando").
  conversationId?: string;
  // Conta as aberturas e os fechamentos da aba: uma abertura que retoma depois de outra operação
  // mais nova desiste, e desfaz o que fez.
  roomRequest?: number;
}

export type RealtimeServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  RealtimeSocketData
>;

export type RealtimeSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  RealtimeSocketData
>;

// Os nomes dos eventos guardados por Pessoa (StoredEventPayloads, em chat-events). O registro
// obriga uma entrada por evento: um evento novo no contrato não compila até entrar aqui, em vez de
// ficar de fora da reconexão sem aviso.
const STORED_EVENTS: Record<StoredEventName, true> = {
  'message.created': true,
  'message.updated': true,
  'message.deleted': true,
  'conversation.member_added': true,
  'conversation.unread': true,
  'activity.unread': true,
};

export function isStoredEventName(name: string): name is StoredEventName {
  return Object.hasOwn(STORED_EVENTS, name);
}

// Quem recebe um evento: um socket, ou as salas escolhidas no servidor.
type StoredEventTarget =
  RealtimeSocket | BroadcastOperator<ServerToClientEvents, RealtimeSocketData>;

// Emite um evento guardado com o par nome e carga do contrato. O emit tipado do Socket.IO não aceita
// um nome genérico; a conversão fica só aqui.
export function emitStoredEvent<N extends StoredEventName>(
  target: StoredEventTarget,
  name: N,
  event: StoredEvent<N>,
): void {
  (target as unknown as { emit(name: string, event: object): boolean }).emit(
    name,
    event,
  );
}

export function personRoom(personId: string): string {
  return `person:${personId}`;
}

export function sessionRoom(sessionId: string): string {
  return `session:${sessionId}`;
}

export function conversationRoom(conversationId: string): string {
  return `conversation:${conversationId}`;
}
