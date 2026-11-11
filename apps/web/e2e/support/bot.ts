import type { Page } from "@playwright/test";
import { API } from "./chat-api";

// Apoio para o teste agir como o bot de um Agente (spec da F11, "Decisões de teste"): o Pedido que o
// envio criou é lido do banco (`latestAgentRequestOf`, em database.ts), e o bot age pelas rotas
// /v1/bot da API do chat, com a credencial de bot, sem o modelo. Num teste sem o modelo, o bot do
// teste age antes do Serviço de agentes, e a ação dele depois é a repetição, sem nova Mensagem
// (bot_actions).

async function botPost<T>(requestId: string, action: string, payload: unknown): Promise<T> {
  const response = await fetch(`${API}/bot/requests/${requestId}/${action}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${process.env.CHAT_BOT_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`A ação ${action} do bot foi recusada: ${response.status}`);
  return (await response.json()) as T;
}

// A resposta do bot ao Pedido; a repetição devolve a Mensagem já gravada.
export async function botReply(requestId: string, body: string): Promise<{ id: string; body: string }> {
  const { message } = await botPost<{ message: { id: string; body: string } }>(requestId, "reply", { body });
  return message;
}

// O "digitando" do bot no Pedido (F11-T05).
export async function botTyping(requestId: string): Promise<void> {
  const response = await fetch(`${API}/bot/requests/${requestId}/typing`, {
    method: "POST",
    headers: { authorization: `Bearer ${process.env.CHAT_BOT_TOKEN}` },
  });
  if (response.status !== 204) throw new Error(`O digitando do bot foi recusado: ${response.status}`);
}

// Um Pedido para o bot, criado pela rota de envio da API do chat como a Pessoa logada na página, com o
// `agent_username` que o BFF preencheria. Sem passar pelo BFF, o Serviço de agentes não recebe o
// Pedido, e só o bot do teste age nele. Devolve o id do Pedido.
export async function requestByApi(page: Page, conversationId: string, agentUsername: string): Promise<string> {
  const response = await page.request.post(`${API}/conversations/${conversationId}/messages`, {
    data: { client_id: crypto.randomUUID(), body: `@${agentUsername} resume hoje`, agent_username: agentUsername },
  });
  if (!response.ok()) throw new Error(`Envio recusado: ${response.status()}`);
  return ((await response.json()) as { agent_request: { id: string } }).agent_request.id;
}
