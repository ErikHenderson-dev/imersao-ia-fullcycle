import type { Page } from "@playwright/test";
import { API, postMessageByApi } from "./chat-api";

// Apoio para o teste agir como o bot de um Agente (spec da F11, "Decisões de teste"): o Pedido que o
// envio criou é lido do banco (`latestAgentRequestOf`, em database.ts), e o bot age pelas rotas
// /v1/bot da API do chat, com a credencial de bot, sem o modelo. Num teste sem o modelo, o bot do
// teste age antes do Serviço de agentes, e a ação dele depois é a repetição, sem nova Mensagem
// (bot_actions).

// Uma ação do bot; o corpo da resposta, ou null no 204.
async function botPost<T>(requestId: string, action: string, payload?: unknown): Promise<T | null> {
  const response = await fetch(`${API}/bot/requests/${requestId}/${action}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.CHAT_BOT_TOKEN}`,
      "content-type": "application/json",
    },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`A ação ${action} do bot foi recusada: ${response.status}`);
  return response.status === 204 ? null : ((await response.json()) as T);
}

// A resposta do bot ao Pedido; a repetição devolve a Mensagem já gravada.
export async function botReply(requestId: string, body: string): Promise<{ id: string; body: string }> {
  const result = await botPost<{ message: { id: string; body: string } }>(requestId, "reply", { body });
  return result!.message;
}

// O "digitando" do bot no Pedido (F11-T05).
export async function botTyping(requestId: string): Promise<void> {
  await botPost(requestId, "typing");
}

// Um Pedido para o bot, criado pela rota de envio da API do chat como a Pessoa logada na página, com o
// `agent_username` que o BFF preencheria. Sem passar pelo BFF, o Serviço de agentes não recebe o
// Pedido, e só o bot do teste age nele. Devolve o id do Pedido.
export async function requestByApi(page: Page, conversationId: string, agentUsername: string): Promise<string> {
  const { agent_request } = await postMessageByApi<{ agent_request: { id: string } }>(page, conversationId, {
    body: `@${agentUsername} resume hoje`,
    agent_username: agentUsername,
  });
  return agent_request.id;
}
