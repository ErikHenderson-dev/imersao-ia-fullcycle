// Tipos dos eventos do WebSocket da API do chat (spec da F03, "Eventos"; spec da F04, "Tempo real"). Só tipos, sem código de
// execução: o pacote é o contrato do tempo real, consumido pela chat-api e pela web. Campos em
// snake_case, como no REST.

/** Autor de uma Mensagem, como no REST. */
export interface MessageAuthorPayload {
  id: string;
  name: string;
}

/** Uma Mensagem, no mesmo formato da resposta REST (spec da F02, "Rotas"). */
export interface MessagePayload {
  id: string;
  conversation_id: string;
  client_id: string;
  author: MessageAuthorPayload;
  body: string;
  created_at: string;
  /** A hora da última edição que mudou o texto, ou nulo (spec da F06, "Mensagens"). */
  edited_at: string | null;
  /** As Pessoas mencionadas, resolvidas ao gravar (spec da F06, "Menções, ao gravar"). */
  mentions: MentionPayload[];
  /** A Citação, ou nula (spec da F06, "A Mensagem no REST e nos eventos"). */
  quote: QuotePayload | null;
}

/** A Mensagem citada: o autor e o texto atual, ou só a marca de apagada. */
export type QuotePayload =
  | { id: string; deleted: false; author: MessageAuthorPayload; body: string }
  | { id: string; deleted: true };

/** Uma Pessoa mencionada numa Mensagem. */
export interface MentionPayload {
  id: string;
  username: string;
}

/** Pessoa que está digitando. */
export interface TypingPersonPayload {
  id: string;
  name: string;
}

export interface MessageCreatedEvent {
  /** Cursor do evento para a reconexão; ausente quando o Redis falhou na publicação. */
  event_id?: string;
  message: MessagePayload;
}

/** Uma Mensagem editada, inteira (spec da F06, "Tempo real"). */
export interface MessageUpdatedEvent {
  /** Cursor do evento para a reconexão; ausente quando o Redis falhou na publicação. */
  event_id?: string;
  message: MessagePayload;
}

/** Uma Mensagem apagada, que sai da Conversa (spec da F06, "Tempo real"). */
export interface MessageDeletedEvent {
  /** Cursor do evento para a reconexão; ausente quando o Redis falhou na publicação. */
  event_id?: string;
  conversation_id: string;
  message_id: string;
}

/** A outra Pessoa de uma Conversa direta, para quem a recebe (spec da F05, "Conversa direta"). */
export interface CounterpartPayload {
  id: string;
  name: string;
  username: string;
}

/** Uma Conversa, no mesmo formato da resposta REST (spec da F04 e da F05, "Rotas"). */
export interface ConversationPayload {
  id: string;
  kind: "public_channel" | "private_channel" | "direct";
  name: string | null;
  topic: string | null;
  member_count: number;
  /** A outra Pessoa da Conversa direta (a própria, na Conversa consigo mesma); nulo nos Canais. */
  counterpart: CounterpartPayload | null;
}

/** Pessoas que entraram numa Conversa (spec da F04, "Tempo real"). */
export interface ConversationMemberAddedEvent {
  /** Cursor do evento para a reconexão; ausente quando o Redis falhou na publicação. */
  event_id?: string;
  conversation: ConversationPayload;
  /**
   * As Pessoas que entraram agora, como quem recebe precisa delas: só a própria Pessoa, se ela
   * entrou agora, ou todas as adicionadas, se ela já era Membro.
   */
  person_ids: string[];
}

/**
 * A Última leitura e os números de Não lidas e de Menções de quem recebe numa Conversa, calculados
 * pelo servidor (spec da F07, "Tempo real").
 */
export interface ConversationUnreadEvent {
  /** Cursor do evento para a reconexão; ausente quando o Redis falhou na publicação. */
  event_id?: string;
  conversation_id: string;
  last_read_message_id: string | null;
  /** De 0 a 100: a contagem para no teto, e a web mostra 99+. */
  unread_count: number;
  mention_count: number;
}

/**
 * Os eventos guardados por Pessoa e reenviados na reconexão, com a carga de cada um sem o cursor,
 * que é de cada Pessoa (spec da F03, "Eventos por Pessoa e reconexão").
 */
export interface StoredEventPayloads {
  "message.created": Omit<MessageCreatedEvent, "event_id">;
  "message.updated": Omit<MessageUpdatedEvent, "event_id">;
  "message.deleted": Omit<MessageDeletedEvent, "event_id">;
  "conversation.member_added": Omit<ConversationMemberAddedEvent, "event_id">;
  "conversation.unread": Omit<ConversationUnreadEvent, "event_id">;
}

export type StoredEventName = keyof StoredEventPayloads;

/** Um evento guardado como chega à aba: a carga e o cursor dela, ausente com o Redis fora. */
export type StoredEvent<N extends StoredEventName = StoredEventName> = StoredEventPayloads[N] & {
  event_id?: string;
};

/** Os eventos guardados emitidos para a aba, um por entrada de StoredEventPayloads. */
export type StoredServerToClientEvents = {
  [N in StoredEventName]: (event: StoredEvent<N>) => void;
};

export interface SyncEvent {
  /** Cursor atual da Pessoa, que a aba manda no próximo handshake. */
  cursor: string | null;
  /** Verdadeiro quando a aba precisa recarregar a página mais recente da Conversa aberta. */
  reset: boolean;
}

export interface ConversationRef {
  conversation_id: string;
}

export interface TypingEvent {
  conversation_id: string;
  person: TypingPersonPayload;
}

export type ConversationOpenResult =
  | { ok: true }
  | { ok: false; code: "conversation_not_found" };

/** Carga do handshake (`auth` do Socket.IO). */
export interface HandshakeAuth {
  cursor?: string;
}

/** Eventos que a API emite para a aba. */
export interface ServerToClientEvents extends StoredServerToClientEvents {
  sync: (event: SyncEvent) => void;
  "session.ended": () => void;
  "typing.start": (event: TypingEvent) => void;
  "typing.stop": (event: TypingEvent) => void;
}

/** Eventos que a aba emite para a API. */
export interface ClientToServerEvents {
  "conversation.open": (
    event: ConversationRef,
    ack: (result: ConversationOpenResult) => void,
  ) => void;
  "conversation.close": (event: ConversationRef) => void;
  "typing.start": (event: ConversationRef) => void;
  "typing.stop": (event: ConversationRef) => void;
}

/** Código do erro de handshake quando a Sessão não vale. */
export type HandshakeErrorCode = "unauthenticated";
