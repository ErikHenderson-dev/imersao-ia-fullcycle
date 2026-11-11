import { createClient } from "redis";

// O Redis de desenvolvimento, como o banco em support/database.ts (LLD, "Ambiente de
// desenvolvimento"). Usado para simular a perda dos eventos da reconexão e para o Serviço de agentes
// recusar o Pedido de uma Pessoa (F11-T06).

async function withRedis(work: (client: ReturnType<typeof createClient>) => Promise<unknown>): Promise<void> {
  const client = createClient({ url: process.env.REDIS_URL });
  await client.connect();
  try {
    await work(client);
  } finally {
    client.destroy();
  }
}

export async function deleteEventsEpoch(): Promise<void> {
  await withRedis((client) => client.del("events:epoch"));
}

// As chaves do limite de pedidos da Pessoa no Serviço de agentes (app/agent_requests/rate_limit.py),
// no minuto atual e no seguinte, para a virada do minuto no meio do teste não mudar o resultado.
function limitKeys(personId: string): string[] {
  const minute = Math.floor(Date.now() / 60_000);
  return [minute, minute + 1].map((window) => `agent_requests:${personId}:${window}`);
}

// A Pessoa já fez os 10 Pedidos do minuto: o próximo recebe 429.
export async function fillAgentRequestLimit(personId: string, count = 10): Promise<void> {
  await withRedis((client) =>
    Promise.all(limitKeys(personId).map((key) => client.set(key, String(count), { EX: 120 }))),
  );
}

// Um valor que o INCR recusa: o Serviço de agentes de pé não consegue contar o Pedido e o recusa com
// 503, como faz com o Redis fora, e o BFF trata como o Serviço de agentes fora.
export async function breakAgentRequestLimit(personId: string): Promise<void> {
  await withRedis((client) =>
    Promise.all(limitKeys(personId).map((key) => client.set(key, "fora", { EX: 120 }))),
  );
}
