import type {
  TaskPayload,
  TaskPersonPayload,
  ConversationPayload,
  MentionPayload,
  MessageAuthorPayload,
  MessagePayload,
  QuotePayload,
  Presence,
  StatusEmoji,
  StatusPayload,
} from "chat-events";
import { connection } from "next/server";
import { cache } from "react";
import { env } from "@/app/config/env";
import {
  conversationFromPayload,
  listedConversationFromPayload,
  type ListedConversationPayload,
  unreadFromPayload,
  type UnreadPayload,
} from "@/app/utils/conversation-event";
import type { AgentErrorReason, AgentRequestFailure } from "@/app/utils/agent-request-failure";
import { initials } from "@/app/utils/initials";
import type { Theme } from "@/app/utils/theme";
import { messageFromEvent } from "@/app/utils/message-event";
import { taskFromPayload } from "@/app/utils/tasks";
import { activityUnreadFromPayload, type ActivityUnreadPayload } from "@/app/utils/activity-unread";

// Service HTTP da API do chat, usado só no servidor (Server Actions, Server Components e
// Route Handlers). Devolve uniões de resultado em vez de lançar.

const TIMEOUT_MS = 5000;

// O Status de uma Pessoa (spec da F09, "Pessoas"): a chave do emoji e a mensagem.
export type Status = StatusPayload;

type ApiPerson = {
  id: string;
  name: string;
  email: string;
  username: string;
  time_zone: string | null;
  status: Status | null;
  presence_choice: Presence;
  // O tema escolhido (spec da F09, "Pessoas").
  theme: Theme;
  // O papel de administrador (spec da F10, "Papel de administrador").
  is_admin: boolean;
};

// As iniciais saem aqui, no servidor, e seguem prontas para os componentes do cliente
// (utils/initials.ts).
export type Person = Omit<ApiPerson, "time_zone" | "presence_choice" | "is_admin"> & {
  initials: string;
  timeZone: string | null;
  // A escolha de presença (spec da F09, "Pessoas").
  presenceChoice: Presence;
  isAdmin: boolean;
};

function toPerson({
  time_zone: timeZone,
  presence_choice: presenceChoice,
  is_admin: isAdmin,
  ...person
}: ApiPerson): Person {
  return { ...withInitials(person), timeZone, presenceChoice, isAdmin };
}

export type LoginResult =
  | { kind: "ok"; token: string; person: Person }
  | { kind: "invalid_credentials" }
  | { kind: "too_many_attempts" }
  | { kind: "failure" };

export type CurrentPersonResult =
  | { kind: "ok"; person: Person }
  | { kind: "unauthenticated" }
  | { kind: "failure" };

async function request(path: string, init: RequestInit): Promise<Response | null> {
  // Chamada de tempo de requisição: o pré-render para aqui (o fetch e o tempo limite leem o
  // relógio, o que o Next recusa durante o pré-render). Fora do try: o sinal do Next que
  // interrompe o pré-render não pode virar uma "falha da API".
  await connection();
  try {
    return await fetch(new URL(path, env.CHAT_API_URL), {
      ...init,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    // Rede fora ou tempo esgotado.
    return null;
  }
}

async function errorCode(response: Response): Promise<string | undefined> {
  const body = await jsonBody<{ code?: unknown }>(response);
  return typeof body?.code === "string" ? body.code : undefined;
}

// O corpo também corre contra o tempo limite e pode chegar quebrado: vira failure, sem lançar.
async function jsonBody<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function sessionCookieHeader(token: string): string {
  return `${env.SESSION_COOKIE_NAME}=${token}`;
}

function authenticated(token: string): HeadersInit {
  return { cookie: sessionCookieHeader(token) };
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const response = await request("/v1/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response) return { kind: "failure" };
  if (response.status === 201) {
    const body = await jsonBody<{ token: string; person: ApiPerson }>(response);
    if (!body) return { kind: "failure" };
    return { kind: "ok", token: body.token, person: toPerson(body.person) };
  }
  const code = response.status < 500 ? await errorCode(response) : undefined;
  // Um 400 aqui é uma entrada que passou na validação da web e a API recusou (formato ou
  // tamanho mais estritos): essas credenciais não podem estar certas.
  if (code === "invalid_credentials" || code === "validation_failed") {
    return { kind: "invalid_credentials" };
  }
  if (code === "too_many_login_attempts") {
    return { kind: "too_many_attempts" };
  }
  return { kind: "failure" };
}

// Leituras memorizadas por requisição (`cache` do React): componentes da mesma renderização, como
// o layout e a página, leem o mesmo resultado sem nova chamada à API.
export const getCurrentPerson = cache(fetchCurrentPerson);

async function fetchCurrentPerson(token: string): Promise<CurrentPersonResult> {
  const response = await request("/v1/sessions/current", {
    method: "GET",
    headers: authenticated(token),
  });
  if (!response) return { kind: "failure" };
  if (response.status === 200) {
    const body = await jsonBody<{ person: ApiPerson }>(response);
    if (!body) return { kind: "failure" };
    return { kind: "ok", person: toPerson(body.person) };
  }
  if (response.status === 401) return { kind: "unauthenticated" };
  return { kind: "failure" };
}

// Sair: apaga na API a Sessão apresentada. O BFF apaga o cookie de qualquer jeito (spec da F01,
// "Menu do avatar"); quando a API não confirma, a Sessão pode seguir válida no banco, e isso fica
// no log.
export async function logout(token: string): Promise<void> {
  const response = await request("/v1/sessions/current", {
    method: "DELETE",
    headers: authenticated(token),
  });
  if (response?.status !== 204 && response?.status !== 401) {
    console.warn(
      `Saída sem confirmação da API do chat (status ${response?.status ?? "sem resposta"})`,
    );
  }
}

// Conversas e Mensagens (spec da F02, "Rotas").

export type ConversationKind = "public_channel" | "private_channel" | "direct";

// A outra Pessoa de uma Conversa direta (a própria, na Conversa consigo mesma), com as iniciais.
export type Counterpart = { id: string; name: string; username: string; initials: string };

export type Conversation = {
  id: string;
  kind: ConversationKind;
  // Vazio na Conversa direta, que não tem nome.
  name: string;
  topic: string | null;
  memberCount: number;
  // Só na Conversa direta (spec da F05, "Conversa direta").
  counterpart: Counterpart | null;
  // A Última leitura e o que a Pessoa tem de novo, só na lista de Conversas (spec da F07, "Rotas");
  // a Conversa que chega por outro caminho entra com nula e zero.
  lastReadMessageId: string | null;
  unreadCount: number;
  mentionCount: number;
};

// A Conversa da API é a mesma do evento do tempo real (pacote chat-events).
type ApiConversation = ConversationPayload;

// A Mensagem da API é a mesma do evento do tempo real (pacote chat-events).
type ApiMessage = MessagePayload;

// Uma Pessoa com as iniciais já calculadas, para o avatar.
export type PersonSummary = { id: string; name: string; initials: string };

// Uma Pessoa nas listas de Pessoas (busca e Membros), com o @usuário e o cargo (spec da F05,
// "Pessoa nas listas").
export type PersonEntry = PersonSummary & {
  username: string;
  title: string | null;
  status: Status | null;
  presence?: Presence;
};

type ApiPersonEntry = Omit<PersonEntry, "initials">;

function withInitials<T extends { name: string }>(person: T): T & { initials: string } {
  return { ...person, initials: initials(person.name) };
}

// Quem escreveu a Mensagem, Pessoa ou bot de um Agente, com as iniciais para o avatar da Pessoa
// (spec da F11, "Autor da Mensagem").
export type MessageAuthor = MessageAuthorPayload & { initials: string };

export type Message = {
  id: string;
  conversationId: string;
  clientId: string;
  author: MessageAuthor;
  body: string;
  createdAt: string;
  // A hora da última edição, ou nulo (spec da F06, "A Mensagem no REST e nos eventos").
  editedAt: string | null;
  // As Pessoas mencionadas, resolvidas ao gravar (spec da F06, "Texto da Mensagem").
  mentions: Mention[];
  // A Citação, com o autor e o texto atual da original, ou a marca de apagada (spec da F06).
  quote: Quote | null;
  // As Respostas prontas da pergunta do Agente, ou nulas (spec da F11, "Envio e Pergunta pendente").
  quickReplies: QuickReplies | null;
};

// Os botões da pergunta do Agente: os rótulos, quem pode responder, até quando e se já se encerrou.
export type QuickReplies = {
  options: string[];
  ownerId: string;
  expiresAt: string;
  closed: boolean;
};

export type Mention = MentionPayload;
export type Quote = QuotePayload;

export type MessagePage = { messages: Message[]; hasMore: boolean };


export type ConversationsResult =
  | { kind: "ok"; conversations: Conversation[] }
  | { kind: "unauthenticated" }
  | { kind: "failure" };

export type ConversationResult =
  | { kind: "ok"; conversation: Conversation }
  | { kind: "not_found" }
  | { kind: "unauthenticated" }
  | { kind: "failure" };

export type MessagePageResult =
  | { kind: "ok"; page: MessagePage }
  | { kind: "not_found" }
  | { kind: "unauthenticated" }
  | { kind: "failure" };

export type CreateChannelResult =
  | { kind: "ok"; conversation: Conversation }
  | { kind: "name_taken" }
  | { kind: "invalid" }
  | { kind: "unauthenticated" }
  | { kind: "failure" };

type ApiAgentRequest = {
  id: string;
  kind: AgentRequest["kind"];
  bot_username: string;
  parent_request_id: string | null;
};

// O Pedido que a Mensagem criou ao mencionar um Agente (spec da F11, "Envio e Pergunta pendente").
export type AgentRequest = {
  id: string;
  kind: "new" | "continuation";
  botUsername: string;
  parentRequestId: string | null;
};

// O Agente não recebeu o Pedido da Mensagem gravada: o aviso ao lado dela, só para quem pediu (LLD,
// "Erros").
export type AgentError = { reason: AgentErrorReason; agentName: string };

export type SendMessageResult =
  | { kind: "ok"; message: Message; agentRequest: AgentRequest | null; agentError?: AgentError }
  // O agent_username não é de um bot: o Agente está conectado, mas o bot dele não foi criado.
  | { kind: "bot_not_found" }
  | { kind: "invalid" }
  | { kind: "not_found" }
  // A Mensagem citada não existe mais nesta Conversa (spec da F06, "Citação").
  | { kind: "quote_not_found" }
  | { kind: "unauthenticated" }
  | { kind: "failure" };

// Os casos de erro comuns às rotas de Conversa: 401 e 404 da conferência de acesso.
function commonFailure(
  response: Response | null,
): { kind: "not_found" } | { kind: "unauthenticated" } | { kind: "failure" } {
  if (response?.status === 401) return { kind: "unauthenticated" };
  if (response?.status === 404) return { kind: "not_found" };
  return { kind: "failure" };
}

function conversationPath(id: string, rest = ""): string {
  return `/v1/conversations/${encodeURIComponent(id)}${rest}`;
}

type GetResult<T> =
  | { kind: "ok"; body: T }
  | { kind: "not_found" }
  | { kind: "unauthenticated" }
  | { kind: "failure" };

// GET autenticado: 200 com o corpo, ou os casos de erro comuns às rotas de Conversa.
async function getJson<T>(token: string, path: string): Promise<GetResult<T>> {
  const response = await request(path, { method: "GET", headers: authenticated(token) });
  if (response?.status !== 200) return commonFailure(response);
  const body = await jsonBody<T>(response);
  return body ? { kind: "ok", body } : { kind: "failure" };
}

export const listConversations = cache(fetchConversations);

async function fetchConversations(token: string): Promise<ConversationsResult> {
  const result = await getJson<{ conversations: ListedConversationPayload[] }>(token, "/v1/conversations");
  if (result.kind === "ok") {
    return { kind: "ok", conversations: result.body.conversations.map(listedConversationFromPayload) };
  }
  // A lista não tem 404: só a Sessão recusada ou a falha.
  return result.kind === "unauthenticated" ? result : { kind: "failure" };
}

export async function getConversation(
  token: string,
  id: string,
): Promise<ConversationResult> {
  const result = await getJson<{ conversation: ListedConversationPayload }>(token, conversationPath(id));
  return result.kind === "ok"
    ? { kind: "ok", conversation: listedConversationFromPayload(result.body.conversation) }
    : result;
}

// Cria o Canal (spec da F04, "Rotas"). O mesmo clientId devolve o Canal já criado.
export async function createChannel(
  token: string,
  channel: { kind: ConversationKind; name: string; topic: string; clientId: string },
): Promise<CreateChannelResult> {
  const response = await request("/v1/conversations", {
    method: "POST",
    headers: { ...authenticated(token), "content-type": "application/json" },
    body: JSON.stringify({
      kind: channel.kind,
      name: channel.name,
      topic: channel.topic,
      client_id: channel.clientId,
    }),
  });
  if (response?.status === 201) {
    const body = await jsonBody<{ conversation: ApiConversation }>(response);
    return body ? { kind: "ok", conversation: conversationFromPayload(body.conversation) } : { kind: "failure" };
  }
  if (response?.status === 401) return { kind: "unauthenticated" };
  if (response?.status === 400) return { kind: "invalid" };
  if (response?.status === 409 && (await errorCode(response)) === "channel_name_taken") {
    return { kind: "name_taken" };
  }
  return { kind: "failure" };
}

// Uma página do histórico: as anteriores a `before`, ou as mais recentes sem ele.
export async function listMessages(
  token: string,
  conversationId: string,
  { before, limit }: { before?: string; limit?: number } = {},
): Promise<MessagePageResult> {
  const params = new URLSearchParams();
  if (before) params.set("before", before);
  if (limit !== undefined) params.set("limit", String(limit));
  const query = params.size > 0 ? `?${params.toString()}` : "";
  const result = await getJson<{ messages: ApiMessage[]; has_more: boolean }>(
    token,
    conversationPath(conversationId, `/messages${query}`),
  );
  if (result.kind !== "ok") return result;
  return {
    kind: "ok",
    page: { messages: result.body.messages.map(messageFromEvent), hasMore: result.body.has_more },
  };
}

export async function sendMessage(
  token: string,
  conversationId: string,
  message: { clientId: string; body: string; quotedMessageId?: string; agentUsername?: string },
): Promise<SendMessageResult> {
  const response = await request(conversationPath(conversationId, "/messages"), {
    method: "POST",
    headers: { ...authenticated(token), "content-type": "application/json" },
    body: JSON.stringify({
      client_id: message.clientId,
      body: message.body,
      quoted_message_id: message.quotedMessageId,
      agent_username: message.agentUsername,
    }),
  });
  if (response?.status === 201) {
    const body = await jsonBody<{ message: ApiMessage; agent_request: ApiAgentRequest | null }>(response);
    if (!body) return { kind: "failure" };
    const pending = body.agent_request;
    return {
      kind: "ok",
      message: messageFromEvent(body.message),
      agentRequest: pending && {
        id: pending.id,
        kind: pending.kind,
        botUsername: pending.bot_username,
        parentRequestId: pending.parent_request_id,
      },
    };
  }
  if (response?.status === 400) return { kind: "invalid" };
  if (response?.status === 422 && (await errorCode(response)) === "bot_not_found") {
    return { kind: "bot_not_found" };
  }
  if (response?.status === 404 && (await errorCode(response)) === "quoted_message_not_found") {
    return { kind: "quote_not_found" };
  }
  return commonFailure(response);
}

// Encerra o Pedido que o Serviço de agentes não aceitou (spec da F11, "Disparo pelo BFF"). A falha só
// vai para o log: o Pedido vence sozinho, e a tela já mostra o que precisa.
export async function closeAgentRequest(
  token: string,
  requestId: string,
  status: AgentRequestFailure["close"],
): Promise<void> {
  const response = await request(`/v1/agent-requests/${encodeURIComponent(requestId)}/close`, {
    method: "POST",
    headers: { ...authenticated(token), "content-type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (response?.status !== 204) {
    console.warn(`Pedido não encerrado na API do chat (status ${response?.status ?? "sem resposta"})`);
  }
}

// Editar a própria Mensagem (spec da F06, "Rotas").

export type EditMessageResult =
  | { kind: "ok"; message: Message }
  | { kind: "invalid" }
  | { kind: "not_found" }
  | { kind: "forbidden" }
  | { kind: "unauthenticated" }
  | { kind: "failure" };

export async function editMessage(
  token: string,
  conversationId: string,
  messageId: string,
  body: string,
): Promise<EditMessageResult> {
  const response = await request(
    conversationPath(conversationId, `/messages/${encodeURIComponent(messageId)}`),
    {
      method: "PATCH",
      headers: { ...authenticated(token), "content-type": "application/json" },
      body: JSON.stringify({ body }),
    },
  );
  if (response?.status === 200) {
    const parsed = await jsonBody<{ message: ApiMessage }>(response);
    if (parsed) return { kind: "ok", message: messageFromEvent(parsed.message) };
    return { kind: "failure" };
  }
  if (response?.status === 400) return { kind: "invalid" };
  if (response?.status === 403) return { kind: "forbidden" };
  return commonFailure(response);
}

// Ler a Conversa até uma Mensagem (spec da F07, "Rotas").

export type Unread = Pick<Conversation, "lastReadMessageId" | "unreadCount" | "mentionCount">;

export type MarkReadResult =
  | { kind: "ok"; unread: Unread }
  | { kind: "not_found" }
  | { kind: "invalid" }
  | { kind: "unauthenticated" }
  | { kind: "failure" };

export async function markConversationRead(
  token: string,
  conversationId: string,
  messageId: string,
): Promise<MarkReadResult> {
  const response = await request(conversationPath(conversationId, "/read"), {
    method: "PUT",
    headers: { ...authenticated(token), "content-type": "application/json" },
    body: JSON.stringify({ message_id: messageId }),
  });
  if (response?.status === 200) {
    const parsed = await jsonBody<UnreadPayload>(response);
    return parsed ? { kind: "ok", unread: unreadFromPayload(parsed) } : { kind: "failure" };
  }
  if (response?.status === 400) return { kind: "invalid" };
  return commonFailure(response);
}

// Apagar a própria Mensagem (spec da F06, "Rotas").

export type DeleteMessageResult =
  | { kind: "ok" }
  | { kind: "not_found" }
  | { kind: "forbidden" }
  | { kind: "unauthenticated" }
  | { kind: "failure" };

export async function deleteMessage(
  token: string,
  conversationId: string,
  messageId: string,
): Promise<DeleteMessageResult> {
  const response = await request(
    conversationPath(conversationId, `/messages/${encodeURIComponent(messageId)}`),
    { method: "DELETE", headers: authenticated(token) },
  );
  if (response?.status === 204) return { kind: "ok" };
  if (response?.status === 403) return { kind: "forbidden" };
  return commonFailure(response);
}

// Busca de Pessoas e adição ao Canal privado (spec da F04, "Rotas").

export type SearchPeopleResult =
  | { kind: "ok"; people: PersonEntry[] }
  | { kind: "invalid" }
  | { kind: "not_found" }
  | { kind: "unauthenticated" }
  | { kind: "failure" };

export async function searchPeople(
  token: string,
  {
    q,
    notMemberOf,
    memberOf,
    admin = false,
  }: { q: string; notMemberOf?: string; memberOf?: string; admin?: boolean },
): Promise<SearchPeopleResult> {
  // Sem a Conversa, a busca do "Nova conversa" (spec da F05, "Busca"); com member_of, a lista de
  // menções (spec da F06).
  const query = new URLSearchParams({ q });
  if (notMemberOf !== undefined) query.set("not_member_of", notMemberOf);
  if (memberOf !== undefined) query.set("member_of", memberOf);
  // Só os administradores, para o diálogo "Agentes" (spec da F10, "BFF").
  if (admin) query.set("admin", "true");
  const response = await request(`/v1/people?${query.toString()}`, {
    method: "GET",
    headers: authenticated(token),
  });
  if (response?.status === 400) return { kind: "invalid" };
  if (response?.status !== 200) return commonFailure(response);
  const body = await jsonBody<{ people: ApiPersonEntry[] }>(response);
  return body ? { kind: "ok", people: body.people.map(withInitials) } : { kind: "failure" };
}

// O Perfil de uma Pessoa (spec da F05, "Busca e Perfil"), com as iniciais para o avatar.
export type Profile = {
  id: string;
  name: string;
  initials: string;
  username: string;
  title: string | null;
  email: string;
  phone: string | null;
  timeZone: string | null;
  status: Status | null;
  presence?: Presence;
  // O selo de administrador no painel de perfil (spec da F10, "Selo de administrador").
  isAdmin: boolean;
};

type ApiProfile = Omit<Profile, "initials" | "timeZone" | "isAdmin"> & {
  time_zone: string | null;
  is_admin: boolean;
};

function toProfile({ time_zone: timeZone, is_admin: isAdmin, ...person }: ApiProfile): Profile {
  return { ...withInitials(person), timeZone, isAdmin };
}

export type GetProfileResult =
  | { kind: "ok"; profile: Profile }
  | { kind: "not_found" }
  | { kind: "unauthenticated" }
  | { kind: "failure" };

export async function getProfile(token: string, personId: string): Promise<GetProfileResult> {
  const response = await request(`/v1/people/${encodeURIComponent(personId)}`, {
    method: "GET",
    headers: authenticated(token),
  });
  if (response?.status !== 200) return commonFailure(response);
  const body = await jsonBody<{ person: ApiProfile }>(response);
  if (!body) return { kind: "failure" };
  return { kind: "ok", profile: toProfile(body.person) };
}

export type UpdateProfileResult =
  | { kind: "ok"; profile: Profile }
  | { kind: "unauthenticated" }
  | { kind: "failure" };

// Grava o próprio Perfil (spec da F09, "Rotas"). O 400 que escape da validação do BFF vira falha:
// a mensagem de cada campo é a da web.
export async function updateProfile(
  token: string,
  changes: {
    name: string;
    title: string | null;
    phone: string | null;
    status_emoji: StatusEmoji | null;
    status_text: string | null;
  },
): Promise<UpdateProfileResult> {
  const response = await request("/v1/people/me", {
    method: "PATCH",
    headers: { ...authenticated(token), "content-type": "application/json" },
    body: JSON.stringify(changes),
  });
  if (response?.status === 401) return { kind: "unauthenticated" };
  if (response?.status !== 200) return { kind: "failure" };
  const body = await jsonBody<{ person: ApiProfile }>(response);
  if (!body) return { kind: "failure" };
  return { kind: "ok", profile: toProfile(body.person) };
}

// Uma Pessoa no retrato: quem está disponível ou tem Status (spec da F09, "Rotas").
export type PresenceEntry = { id: string; presence: Presence; status: Status | null };

export type PresenceResult =
  | { kind: "ok"; people: PresenceEntry[] }
  | { kind: "unauthenticated" }
  | { kind: "failure" };

// O retrato de quem tem Status (spec da F09, "Rotas").
export async function getPresence(token: string): Promise<PresenceResult> {
  const response = await request("/v1/people/presence", {
    method: "GET",
    headers: authenticated(token),
  });
  if (response?.status === 401) return { kind: "unauthenticated" };
  if (response?.status !== 200) return { kind: "failure" };
  const body = await jsonBody<{ people: PresenceEntry[] }>(response);
  return body ? { kind: "ok", people: body.people } : { kind: "failure" };
}

export type SavePresenceChoiceResult =
  | { kind: "ok" }
  | { kind: "invalid" }
  | { kind: "unauthenticated" }
  | { kind: "failure" };

// Grava a escolha de presença (spec da F09, "Rotas").
export async function savePresenceChoice(
  token: string,
  choice: Presence,
): Promise<SavePresenceChoiceResult> {
  const response = await request("/v1/people/me/presence", {
    method: "PUT",
    headers: { ...authenticated(token), "content-type": "application/json" },
    body: JSON.stringify({ presence_choice: choice }),
  });
  if (response?.status === 204) return { kind: "ok" };
  if (response?.status === 400) return { kind: "invalid" };
  if (response?.status === 401) return { kind: "unauthenticated" };
  return { kind: "failure" };
}

export type SaveThemeResult =
  | { kind: "ok" }
  | { kind: "invalid" }
  | { kind: "unauthenticated" }
  | { kind: "failure" };

// Grava o tema (spec da F09, "Rotas").
export async function saveTheme(token: string, theme: Theme): Promise<SaveThemeResult> {
  const response = await request("/v1/people/me/theme", {
    method: "PUT",
    headers: { ...authenticated(token), "content-type": "application/json" },
    body: JSON.stringify({ theme }),
  });
  if (response?.status === 204) return { kind: "ok" };
  if (response?.status === 400) return { kind: "invalid" };
  if (response?.status === 401) return { kind: "unauthenticated" };
  return { kind: "failure" };
}

export type OpenDirectConversationResult =
  | { kind: "ok"; conversation: Conversation }
  | { kind: "invalid" }
  | { kind: "not_found" }
  | { kind: "unauthenticated" }
  | { kind: "failure" };

// Abre a Conversa direta com a Pessoa (spec da F05, "Rotas"): 201 quando nasce agora, 200 quando já
// existia.
export async function openDirectConversation(
  token: string,
  personId: string,
): Promise<OpenDirectConversationResult> {
  const response = await request("/v1/conversations", {
    method: "POST",
    headers: { ...authenticated(token), "content-type": "application/json" },
    body: JSON.stringify({ kind: "direct", person_id: personId }),
  });
  if (response?.status === 200 || response?.status === 201) {
    const body = await jsonBody<{ conversation: ApiConversation }>(response);
    return body
      ? { kind: "ok", conversation: conversationFromPayload(body.conversation) }
      : { kind: "failure" };
  }
  if (response?.status === 400) return { kind: "invalid" };
  return commonFailure(response);
}

export type SaveTimeZoneResult =
  | { kind: "ok" }
  | { kind: "invalid" }
  | { kind: "unauthenticated" }
  | { kind: "failure" };

export async function saveTimeZone(token: string, timeZone: string): Promise<SaveTimeZoneResult> {
  const response = await request("/v1/people/me/time-zone", {
    method: "PUT",
    headers: { ...authenticated(token), "content-type": "application/json" },
    body: JSON.stringify({ time_zone: timeZone }),
  });
  if (response?.status === 204) return { kind: "ok" };
  if (response?.status === 400) return { kind: "invalid" };
  if (response?.status === 401) return { kind: "unauthenticated" };
  return { kind: "failure" };
}

export type AddMembersResult =
  | { kind: "ok"; addedPersonIds: string[]; memberCount: number }
  | { kind: "invalid" }
  | { kind: "not_found" }
  | { kind: "not_editable" }
  | { kind: "unauthenticated" }
  | { kind: "failure" };

export async function addMembers(
  token: string,
  conversationId: string,
  personIds: string[],
): Promise<AddMembersResult> {
  const response = await request(conversationPath(conversationId, "/members"), {
    method: "POST",
    headers: { ...authenticated(token), "content-type": "application/json" },
    body: JSON.stringify({ person_ids: personIds }),
  });
  if (response?.status === 200) {
    const body = await jsonBody<{ added_person_ids: string[]; member_count: number }>(response);
    return body
      ? { kind: "ok", addedPersonIds: body.added_person_ids, memberCount: body.member_count }
      : { kind: "failure" };
  }
  if (response?.status === 400) return { kind: "invalid" };
  if (response?.status === 409) return { kind: "not_editable" };
  return commonFailure(response);
}

export type MembersResult =
  | { kind: "ok"; members: PersonEntry[] }
  | { kind: "not_found" }
  | { kind: "unauthenticated" }
  | { kind: "failure" };

// Os Membros de uma Conversa, em ordem alfabética (spec da F04, "Rotas").
export async function listMembers(token: string, conversationId: string): Promise<MembersResult> {
  const result = await getJson<{ members: ApiPersonEntry[] }>(
    token,
    conversationPath(conversationId, "/members"),
  );
  return result.kind === "ok"
    ? { kind: "ok", members: result.body.members.map(withInitials) }
    : result;
}

// Atividade (spec da F08, "Rotas"): o filtro da lista, o tipo de cada item e os números.
export type ActivityFilter = "all" | "mentions" | "direct";
export type NotificationKind = "mention" | "direct";

// Um item de Atividade: a Notificação, com a Mensagem como no histórico e a Conversa dela.
export type ActivityItem = { kind: NotificationKind; message: Message; conversation: Conversation };

export type ActivityPage = { items: ActivityItem[]; hasMore: boolean };

export type ActivityUnread = {
  // A marca de "Marcar tudo como lido", ou nula.
  activityReadMessageId: string | null;
  totalCount: number;
  mentionCount: number;
  directCount: number;
};

export type ActivityPageResult =
  | { kind: "ok"; page: ActivityPage }
  | { kind: "unauthenticated" }
  | { kind: "failure" };

export type ActivityUnreadResult =
  | { kind: "ok"; unread: ActivityUnread }
  | { kind: "unauthenticated" }
  | { kind: "failure" };

type ApiActivityItem = { kind: NotificationKind; message: ApiMessage; conversation: ApiConversation };

// Uma página de Atividade: as anteriores a `before`, ou as mais novas sem ele, em ordem cronológica.
export async function listActivity(
  token: string,
  { kind, before }: { kind: ActivityFilter; before?: string },
): Promise<ActivityPageResult> {
  const params = new URLSearchParams({ kind });
  if (before) params.set("before", before);
  const result = await getJson<{ items: ApiActivityItem[]; has_more: boolean }>(
    token,
    `/v1/activity?${params.toString()}`,
  );
  if (result.kind !== "ok") return result.kind === "unauthenticated" ? result : { kind: "failure" };
  return {
    kind: "ok",
    page: {
      items: result.body.items.map((item) => ({
        kind: item.kind,
        message: messageFromEvent(item.message),
        conversation: conversationFromPayload(item.conversation),
      })),
      hasMore: result.body.has_more,
    },
  };
}

// Os números de Atividade da Pessoa da Sessão, memorizados por requisição: o rail e a tela
// Atividade leem os mesmos.
export const getActivityUnread = cache(fetchActivityUnread);

async function fetchActivityUnread(token: string): Promise<ActivityUnreadResult> {
  const result = await getJson<ActivityUnreadPayload>(token, "/v1/activity/unread");
  if (result.kind !== "ok") return result.kind === "unauthenticated" ? result : { kind: "failure" };
  return { kind: "ok", unread: activityUnreadFromPayload(result.body) };
}

export type MarkActivityReadResult =
  | { kind: "ok"; unread: ActivityUnread }
  | { kind: "not_found" }
  | { kind: "invalid" }
  | { kind: "unauthenticated" }
  | { kind: "failure" };

// Marca tudo como lido até a Mensagem (spec da F08, "Rotas"): só avança.
export async function markActivityRead(token: string, messageId: string): Promise<MarkActivityReadResult> {
  const response = await request("/v1/activity/read", {
    method: "PUT",
    headers: { ...authenticated(token), "content-type": "application/json" },
    body: JSON.stringify({ message_id: messageId }),
  });
  if (response?.status === 200) {
    const body = await jsonBody<ActivityUnreadPayload>(response);
    return body ? { kind: "ok", unread: activityUnreadFromPayload(body) } : { kind: "failure" };
  }
  if (response?.status === 400) return { kind: "invalid" };
  return commonFailure(response);
}

// Avisa o workspace que o registro de Agentes mudou (spec da F10, "BFF", passo 4): a API do chat
// publica o agents.changed. Devolve se a API confirmou.
export async function announceAgentsChanged(token: string): Promise<boolean> {
  const response = await request("/v1/agents/changed", {
    method: "POST",
    headers: authenticated(token),
  });
  return response?.status === 204;
}

// Tarefas (spec da F12, "Concluir, reabrir e listar").
export type TaskRole = "assigned" | "delegated";
export type TaskPerson = TaskPersonPayload;

export type Task = {
  id: string;
  title: string;
  status: "open" | "done";
  createdAt: string;
  completedAt: string | null;
  assignee: TaskPerson;
  delegator: TaskPerson;
  conversation: { id: string; name: string | null; kind: ConversationKind };
  triggerMessage: { id: string; deleted: boolean };
};

export type TaskPage = { tasks: Task[]; nextCursor: string | null };

export type TaskPageResult = { kind: "ok"; page: TaskPage } | { kind: "unauthenticated" } | { kind: "failure" };

export type TaskResult =
  | { kind: "ok"; task: Task }
  | { kind: "not_found" }
  | { kind: "not_assignee" }
  | { kind: "unauthenticated" }
  | { kind: "failure" };

// Uma página das Tarefas recebidas ou delegadas, a partir do cursor da anterior.
export async function listTasks(
  token: string,
  { role, cursor }: { role: TaskRole; cursor?: string },
): Promise<TaskPageResult> {
  const params = new URLSearchParams({ role });
  if (cursor) params.set("cursor", cursor);
  const result = await getJson<{ tasks: TaskPayload[]; next_cursor: string | null }>(
    token,
    `/v1/tasks?${params.toString()}`,
  );
  if (result.kind !== "ok") return result.kind === "unauthenticated" ? result : { kind: "failure" };
  return {
    kind: "ok",
    page: { tasks: result.body.tasks.map(taskFromPayload), nextCursor: result.body.next_cursor },
  };
}

// Uma Tarefa, para o Responsável ou quem delegou.
export async function getTask(token: string, taskId: string): Promise<TaskResult> {
  const result = await getJson<{ task: TaskPayload }>(token, `/v1/tasks/${encodeURIComponent(taskId)}`);
  return result.kind === "ok" ? { kind: "ok", task: taskFromPayload(result.body.task) } : result;
}

// Conclui ou reabre a Tarefa do Responsável; a repetição devolve a Tarefa como está.
export async function changeTaskStatus(
  token: string,
  taskId: string,
  action: "complete" | "reopen",
): Promise<TaskResult> {
  const response = await request(`/v1/tasks/${encodeURIComponent(taskId)}/${action}`, {
    method: "POST",
    headers: authenticated(token),
  });
  if (response?.status === 200) {
    const body = await jsonBody<{ task: TaskPayload }>(response);
    return body ? { kind: "ok", task: taskFromPayload(body.task) } : { kind: "failure" };
  }
  if (response?.status === 403) return { kind: "not_assignee" };
  return commonFailure(response);
}
