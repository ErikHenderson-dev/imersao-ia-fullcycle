"use server";

import isUUID from "validator/lib/isUUID";
import { type Agent, listAgents, startAgentRequest } from "@/app/services/agents-service";
import {
  closeAgentRequest,
  getCurrentPerson,
  listMembers,
  type Mention,
  sendMessage as sendMessageToChat,
  type SendMessageResult,
} from "@/app/services/chat-api";
import { readSessionToken } from "@/app/services/session-cookie";
import { readTimeZone } from "@/app/services/time-zone-cookie";
import {
  agentRequestMentions,
  agentRequestQuote,
  agentRequester,
  mentionedAgentUsername,
  needsAgentRegistry,
} from "@/app/utils/agent-mentions";
import { agentRequestFailure } from "@/app/utils/agent-request-failure";
import { messageBodyToSave } from "@/app/utils/message-text";

// Envio de Mensagem (spec da F02, "Envio"): valida o texto como a API e grava pelo service. Com a
// Menção a um Agente conectado, orquestra o Pedido (spec da F11, "Disparo pelo BFF").
export async function sendMessage(
  conversationId: string,
  clientId: string,
  body: string,
  // A Mensagem citada (spec da F06, "Citação").
  quotedMessageId?: string,
): Promise<SendMessageResult> {
  const text = messageBodyToSave(body);
  if (
    typeof conversationId !== "string" ||
    typeof clientId !== "string" ||
    !isUUID(clientId) ||
    text === null ||
    (quotedMessageId !== undefined && (typeof quotedMessageId !== "string" || !isUUID(quotedMessageId)))
  ) {
    return { kind: "invalid" };
  }
  const token = await readSessionToken();
  if (!token) return { kind: "unauthenticated" };
  const agent = await mentionedAgent(text);
  const agentUsername = agent?.username;
  const message = { clientId, body: text, quotedMessageId };
  let result = await sendMessageToChat(token, conversationId, { ...message, agentUsername });
  // O registro diz conectado, mas a API do chat não tem o bot (o create-bot não rodou): a primeira
  // tentativa não gravou nada, e a Mensagem segue como texto comum, com o mesmo client_id.
  if (result.kind === "bot_not_found") {
    result = await sendMessageToChat(token, conversationId, message);
  }
  if (result.kind === "ok" && result.agentRequest) {
    const { message: sent, agentRequest } = result;
    // A Permissão de dados vem da Pessoa da Sessão, e não do autor gravado (ADR 0015).
    const [mentions, timeZone, session] = await Promise.all([
      requestMentions(token, conversationId, sent.mentions),
      readTimeZone(),
      getCurrentPerson(token),
    ]);
    const failure = agentRequestFailure(
      await startAgentRequest({
        requestId: agentRequest.id,
        kind: agentRequest.kind,
        parentRequestId: agentRequest.parentRequestId,
        agent: agentRequest.botUsername,
        conversationId,
        message: { id: sent.id, body: sent.body },
        requester: agentRequester(sent.author, session),
        mentions,
        timeZone,
        quote: agentRequestQuote(sent.quote),
      }),
    );
    // O Pedido não aceito se encerra, e quem pediu vê o erro ao lado da Mensagem; o Agente
    // desconectado (cancelled) não mostra erro, porque a Menção é texto comum.
    if (failure) {
      await closeAgentRequest(token, agentRequest.id, failure.close);
      if (failure.reason) {
        return { ...result, agentError: { reason: failure.reason, agentName: agent?.name ?? "Agente" } };
      }
    }
  }
  return result;
}

// O Agente conectado mencionado, pelo registro; sem `@` no texto, nem consulta.
async function mentionedAgent(text: string): Promise<Agent | undefined> {
  if (!needsAgentRegistry(text)) return undefined;
  const agents = await listAgents();
  if (agents.kind !== "ok") return undefined;
  const username = mentionedAgentUsername(text, agents.agents);
  return agents.agents.find((agent) => agent.username === username);
}

// As Menções do Pedido, com o nome de cada Pessoa pelos Membros da Conversa; sem Menção, nenhuma
// leitura a mais.
async function requestMentions(
  token: string,
  conversationId: string,
  mentions: readonly Mention[],
): Promise<{ username: string; name: string }[]> {
  if (mentions.length === 0) return [];
  const members = await listMembers(token, conversationId);
  return agentRequestMentions(mentions, members.kind === "ok" ? members.members : null);
}
