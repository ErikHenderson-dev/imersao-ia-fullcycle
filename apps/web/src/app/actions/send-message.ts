"use server";

import isUUID from "validator/lib/isUUID";
import { listAgents, startAgentRequest } from "@/app/services/agents-service";
import {
  sendMessage as sendMessageToChat,
  type SendMessageResult,
} from "@/app/services/chat-api";
import { readSessionToken } from "@/app/services/session-cookie";
import { readTimeZone } from "@/app/services/time-zone-cookie";
import { mentionedAgentUsername, needsAgentRegistry } from "@/app/utils/agent-mentions";
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
  const agentUsername = await mentionedAgent(text);
  const message = { clientId, body: text, quotedMessageId };
  let result = await sendMessageToChat(token, conversationId, { ...message, agentUsername });
  // O registro diz conectado, mas a API do chat não tem o bot (o create-bot não rodou): a primeira
  // tentativa não gravou nada, e a Mensagem segue como texto comum, com o mesmo client_id.
  if (result.kind === "bot_not_found") {
    result = await sendMessageToChat(token, conversationId, message);
  }
  if (result.kind === "ok" && result.agentRequest) {
    const { message: sent, agentRequest } = result;
    // Só o aceite. A falha (encerrar o Pedido e o erro do Agente) é da F11-T06.
    await startAgentRequest({
      requestId: agentRequest.id,
      kind: agentRequest.kind,
      parentRequestId: agentRequest.parentRequestId,
      agent: agentRequest.botUsername,
      conversationId,
      message: { id: sent.id, body: sent.body },
      requester: { id: sent.author.id, name: sent.author.name, username: sent.author.username },
      // As Menções com o nome de cada Pessoa entram na F11-T04.
      mentions: [],
      timeZone: await readTimeZone(),
    });
  }
  return result;
}

// O Agente conectado mencionado, pelo registro; sem `@` no texto, nem consulta.
async function mentionedAgent(text: string): Promise<string | undefined> {
  if (!needsAgentRegistry(text)) return undefined;
  const agents = await listAgents();
  return mentionedAgentUsername(text, agents.kind === "ok" ? agents.agents : null) ?? undefined;
}
