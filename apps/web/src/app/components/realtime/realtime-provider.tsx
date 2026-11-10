"use client";

import type {
  ActivityUnreadEvent,
  ClientToServerEvents,
  ConversationMemberAddedEvent,
  ConversationUnreadEvent,
  HandshakeErrorCode,
  MessageCreatedEvent,
  MessageDeletedEvent,
  MessageUpdatedEvent,
  ServerToClientEvents,
  StoredEvent,
  StoredEventName,
  SyncEvent,
} from "chat-events";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { ActivityUnread, Conversation, Message, Unread } from "@/app/services/chat-api";
import { conversationFromPayload, unreadFromPayload } from "@/app/utils/conversation-event";
import { laterCursor, orderForSync } from "@/app/utils/event-cursor";
import { messageFromEvent } from "@/app/utils/message-event";
import { forgetMessage, rememberEdit, rememberMessage } from "@/app/utils/recent-messages";
import { clearLeaving, hasAskedToLeave } from "@/app/utils/leaving";
import { redirectToExpiredSession } from "@/app/utils/return-path";

export type RealtimeSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export type RealtimeStatus = "connecting" | "connected" | "disconnected";

export type MessageDeleted = { conversationId: string; messageId: string };

// Pessoas que entraram numa Conversa (spec da F04, "Tempo real").
export type MemberAdded = { conversation: Conversation; personIds: readonly string[] };

// A Última leitura e os números de uma Conversa, calculados pelo servidor (spec da F07).
export type ConversationUnread = { conversationId: string; unread: Unread };

export type RealtimeListener = {
  onMessage?: (message: Message) => void;
  // Uma Mensagem editada (spec da F06, "Eventos no cliente").
  onMessageUpdated?: (message: Message) => void;
  // Uma Mensagem apagada, que sai da Conversa (spec da F06, "Eventos no cliente").
  onMessageDeleted?: (event: MessageDeleted) => void;
  onMemberAdded?: (event: MemberAdded) => void;
  onUnread?: (event: ConversationUnread) => void;
  // Os números de Atividade, calculados pelo servidor (spec da F08, "Tempo real").
  onActivityUnread?: (unread: ActivityUnread) => void;
  onSync?: (event: SyncEvent) => void;
  // Quem assina depois do sync recebe, por padrão, uma cópia sem reset. Com esta marca, recebe o
  // reset do último sync: é o caso de quem não guarda os eventos que perdeu, como a lista de
  // Conversas da barra lateral.
  replayLastReset?: boolean;
};

type RealtimeContextValue = {
  status: RealtimeStatus;
  // Número da queda atual: cresce cada vez que a aba deixa de estar conectada (a primeira conexão
  // ainda por fazer é a queda 1). A faixa de conexão conta o atraso por queda.
  outage: number;
  // Nulo só antes do primeiro efeito, na renderização do servidor e na hidratação.
  socket: RealtimeSocket | null;
  // Assina os eventos da aba; devolve a função que cancela.
  subscribe: (listener: RealtimeListener) => () => void;
  // As Mensagens de uma Conversa recebidas desde a conexão (spec da F03, "Conexão por aba").
  recentMessages: (conversationId: string) => readonly Message[];
};

const RealtimeContext = createContext<RealtimeContextValue>({
  status: "connecting",
  outage: 0,
  socket: null,
  subscribe: () => () => {},
  recentMessages: () => [],
});

const UNAUTHENTICATED: HandshakeErrorCode = "unauthenticated";

// Um evento guardado por Pessoa (StoredEventPayloads, em chat-events), com o nome dele, até o
// sync.
type ReceivedEvent = {
  [N in StoredEventName]: { name: N; event: StoredEvent<N> };
}[StoredEventName];

// O tratamento de cada evento guardado, com a carga do evento daquele nome.
type StoredEventHandlers = {
  [N in StoredEventName]: (event: StoredEvent<N>) => void;
};

// Intervalo de uma nova tentativa depois de um handshake recusado por outro motivo, igual ao da
// reconexão padrão do cliente do Socket.IO: começa em 1 s e dobra até 5 s.
const RETRY_MIN_MS = 1_000;
const RETRY_MAX_MS = 5_000;

type RealtimeProviderProps = {
  // Endereço público da API do chat, lido no servidor (spec da F03, "Cliente").
  url: string;
  children: React.ReactNode;
};

// Conexão em tempo real da aba (spec da F03, "Cliente", "Conexão por aba"): um socket só, aberto no
// layout das telas logadas e mantido entre as trocas de Conversa. Ele guarda as Mensagens recebidas
// por Conversa e repassa os eventos a quem assina. O estado da conexão também vai para o atributo
// data-realtime, que os testes esperam.
export function RealtimeProvider({ url, children }: RealtimeProviderProps) {
  const [connection, setConnection] = useState<{
    status: RealtimeStatus;
    outage: number;
    socket: RealtimeSocket | null;
  }>({ status: "connecting", outage: 1, socket: null });
  const listeners = useRef(new Set<RealtimeListener>());
  // Um reset que chegou sem ninguém assinando: o histórico ainda montava (Suspense) ou estava
  // entre duas Conversas. A próxima assinatura o recebe.
  const pendingReset = useRef<SyncEvent | null>(null);
  // O último sync da conexão atual. Quem assina depois dele recebe uma cópia sem reset: o buffer
  // de Mensagens já cobre o que chegou desde então.
  const lastSync = useRef<SyncEvent | null>(null);
  const recent = useRef(new Map<string, readonly Message[]>());

  useEffect(() => {
    // Uma conexão nova é de uma Sessão nova: a marca de quem saiu na anterior não vale mais.
    clearLeaving();
    // O cursor do último evento recebido, mandado a cada handshake (spec da F03, "Conexão por aba"):
    // a API reenvia o que veio depois dele.
    let cursor: string | null = null;
    const socket: RealtimeSocket = io(url, {
      transports: ["websocket"],
      withCredentials: true,
      auth: (send) => send(cursor ? { cursor } : {}),
    });
    // Até o sync de cada conexão, os eventos ficam guardados: a sala da Pessoa já recebe os novos
    // enquanto a API reenvia os perdidos, e a ordem é a do cursor.
    let isSyncing = true;
    let pendingEvents: ReceivedEvent[] = [];
    let retryDelay = RETRY_MIN_MS;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const setStatus = (status: RealtimeStatus) =>
      setConnection((current) => {
        if (current.status === status && current.socket === socket) return current;
        // Sair do "conectada" abre uma queda nova; entre "conectando" e "desconectada" é a mesma.
        const outage = current.status === "connected" ? current.outage + 1 : current.outage;
        return { status, outage, socket };
      });
    const received = recent.current;

    socket.on("connect", () => {
      retryDelay = RETRY_MIN_MS;
      isSyncing = true;
      pendingEvents = [];
      setStatus("connected");
    });
    // A Sessão acabou (LLD, "Cliente", "Sessão no cliente"): o session.ended ou a desconexão pelo
    // servidor, que vem logo depois dele, levam a "Entrar" uma vez só, como um 401 do REST. Na aba
    // que pediu para sair, quem navega é o próprio sair.
    let isEnding = false;
    const endSession = () => {
      if (isEnding || hasAskedToLeave()) return;
      isEnding = true;
      void redirectToExpiredSession();
    };
    socket.on("disconnect", (reason) => {
      lastSync.current = null;
      // Os eventos da próxima conexão podem chegar antes do "connect": a fila já começa aqui.
      isSyncing = true;
      pendingEvents = [];
      if (reason === "io server disconnect") return endSession();
      setStatus("disconnected");
    });
    socket.on("session.ended", endSession);
    socket.on("connect_error", (error) => {
      if (error.message === UNAUTHENTICATED) {
        void redirectToExpiredSession();
        return;
      }
      setStatus("disconnected");
      // Uma recusa do handshake (middleware) desliga a reconexão do cliente; a falha da
      // própria conexão, não. Só a primeira precisa de nova tentativa aqui.
      if (!socket.active) {
        retryTimer = setTimeout(() => socket.connect(), retryDelay);
        retryDelay = Math.min(retryDelay * 2, RETRY_MAX_MS);
      }
    });
    const applyMessage = (event: MessageCreatedEvent) => {
      const message = messageFromEvent(event.message);
      received.set(
        message.conversationId,
        rememberMessage(received.get(message.conversationId) ?? [], message),
      );
      listeners.current.forEach((listener) => listener.onMessage?.(message));
    };
    const applyMessageUpdated = (event: MessageUpdatedEvent) => {
      const message = messageFromEvent(event.message);
      const recentOfConversation = received.get(message.conversationId);
      if (recentOfConversation) {
        received.set(message.conversationId, rememberEdit(recentOfConversation, message));
      }
      listeners.current.forEach((listener) => listener.onMessageUpdated?.(message));
    };
    const applyMessageDeleted = (event: MessageDeletedEvent) => {
      const deleted = { conversationId: event.conversation_id, messageId: event.message_id };
      const recentOfConversation = received.get(deleted.conversationId);
      if (recentOfConversation) {
        received.set(deleted.conversationId, forgetMessage(recentOfConversation, deleted.messageId));
      }
      listeners.current.forEach((listener) => listener.onMessageDeleted?.(deleted));
    };
    const applyMemberAdded = (event: ConversationMemberAddedEvent) => {
      const added = {
        conversation: conversationFromPayload(event.conversation),
        personIds: event.person_ids,
      };
      listeners.current.forEach((listener) => listener.onMemberAdded?.(added));
    };
    const applyUnread = (event: ConversationUnreadEvent) => {
      const changed = { conversationId: event.conversation_id, unread: unreadFromPayload(event) };
      listeners.current.forEach((listener) => listener.onUnread?.(changed));
    };
    const applyActivityUnread = (event: ActivityUnreadEvent) => {
      const unread = {
        totalCount: event.total_count,
        mentionCount: event.mention_count,
        directCount: event.direct_count,
      };
      listeners.current.forEach((listener) => listener.onActivityUnread?.(unread));
    };
    // Uma entrada por evento guardado: um evento novo no contrato não compila até ter a sua.
    const handlers: StoredEventHandlers = {
      "message.created": applyMessage,
      "message.updated": applyMessageUpdated,
      "message.deleted": applyMessageDeleted,
      "conversation.member_added": applyMemberAdded,
      "conversation.unread": applyUnread,
      "activity.unread": applyActivityUnread,
    };
    // Os eventos guardados por Pessoa, na ordem do cursor: aplica e avança o cursor.
    const apply = ({ name, event }: ReceivedEvent) => {
      cursor = laterCursor(cursor, event.event_id);
      (handlers[name] as (event: StoredEvent) => void)(event);
    };
    const receive = (received: ReceivedEvent) => {
      if (isSyncing) pendingEvents.push(received);
      else apply(received);
    };
    // O on tipado do Socket.IO não aceita um nome genérico; o par nome e carga vem do contrato.
    const untypedSocket = socket as unknown as {
      on(name: StoredEventName, listener: (event: StoredEvent) => void): void;
    };
    for (const name of Object.keys(handlers) as StoredEventName[]) {
      untypedSocket.on(name, (event) => receive({ name, event } as ReceivedEvent));
    }
    socket.on("sync", (event) => {
      orderForSync(pendingEvents, (received) => received.event.event_id).forEach(apply);
      pendingEvents = [];
      isSyncing = false;
      cursor = laterCursor(cursor, event.cursor);
      lastSync.current = event;
      const syncListeners = [...listeners.current].filter((listener) => listener.onSync);
      pendingReset.current = event.reset && syncListeners.length === 0 ? event : null;
      syncListeners.forEach((listener) => listener.onSync?.(event));
    });

    // O navegador sabe que caiu antes do ping: o socket cai na hora e volta com a rede. O próprio
    // cliente do Socket.IO ignora o offline quando o host é localhost. A desconexão pedida aqui
    // desliga a reconexão automática, e por isso o online conecta de novo.
    const goOffline = () => {
      clearTimeout(retryTimer);
      socket.disconnect();
    };
    const goOnline = () => {
      clearTimeout(retryTimer);
      retryDelay = RETRY_MIN_MS;
      if (!socket.connected) socket.connect();
    };
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);

    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
      clearTimeout(retryTimer);
      socket.removeAllListeners();
      socket.disconnect();
      received.clear();
    };
  }, [url]);

  const subscribe = useCallback((listener: RealtimeListener) => {
    listeners.current.add(listener);
    const pending = pendingReset.current;
    // Quem assina com replayLastReset (a barra lateral, a Atividade) recebe o reset do último sync de
    // todo jeito e não consome o guardado para o histórico.
    if (pending && listener.onSync && !listener.replayLastReset) {
      pendingReset.current = null;
      listener.onSync(pending);
    } else if (lastSync.current && listener.onSync) {
      listener.onSync({
        ...lastSync.current,
        reset: listener.replayLastReset ? lastSync.current.reset : false,
      });
    }
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  const recentMessages = useCallback(
    (conversationId: string): readonly Message[] => recent.current.get(conversationId) ?? [],
    [],
  );

  const value = useMemo(
    () => ({ ...connection, subscribe, recentMessages }),
    [connection, subscribe, recentMessages],
  );

  return (
    <RealtimeContext value={value}>
      <div data-realtime={connection.status} className="contents">
        {children}
      </div>
    </RealtimeContext>
  );
}

export function useRealtime(): RealtimeContextValue {
  return useContext(RealtimeContext);
}
