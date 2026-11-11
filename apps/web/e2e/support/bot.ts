import { randomUUIDv7 } from "node:crypto";
import { Pool } from "pg";
import type { TestChannel } from "./database";

// Apoio para o teste agir como o bot de um Agente (spec da F11, "Decisões de teste"): o Pedido que o
// envio criou é lido do banco chat, e o bot age pelas rotas /v1/bot da API do chat, com a credencial
// de bot, sem o modelo. Num teste sem o modelo, o bot do teste age antes do Serviço de agentes, e a
// ação dele depois é a repetição, sem nova Mensagem (bot_actions).
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });

// A API do chat que o navegador do teste alcança, pelo encaminhador do contêiner e2e.
const BOT_API = "http://localhost:3001/v1/bot";

export type TestAgentRequest = { id: string; kind: string; status: string };

// O bot do `assistente`, como o comando de contas o cria (AGENTS.md da raiz), se ainda não existe.
export async function ensureAssistantBot(): Promise<void> {
  await pool.query(
    "INSERT INTO bots (id, username, name) VALUES ($1, 'assistente', 'Assistente') ON CONFLICT (username) DO NOTHING",
    [randomUUIDv7()],
  );
}

// Espera e devolve o Pedido mais recente da Conversa, que o envio com a Menção criou.
export async function agentRequestOf(channel: TestChannel, timeoutMs = 10_000): Promise<TestAgentRequest> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const result = await pool.query<TestAgentRequest>(
      "SELECT id, kind, status FROM agent_requests WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 1",
      [channel.id],
    );
    if (result.rows[0]) return result.rows[0];
    if (Date.now() > deadline) throw new Error("O envio não criou nenhum Pedido.");
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

async function botPost<T>(requestId: string, action: string, payload: unknown): Promise<T> {
  const response = await fetch(`${BOT_API}/requests/${requestId}/${action}`, {
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
