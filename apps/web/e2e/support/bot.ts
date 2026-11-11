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
