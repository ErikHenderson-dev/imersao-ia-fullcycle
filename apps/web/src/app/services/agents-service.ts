import { connection } from "next/server";
import { cache } from "react";
import { env } from "@/app/config/env";

// Service HTTP do Serviço de agentes, usado só no servidor (spec da F10, "BFF"): o BFF é o único
// que o chama, com a credencial de serviço. Devolve uniões de resultado em vez de lançar.

const TIMEOUT_MS = 5000;

// Um Agente do catálogo, com o estado de conexão (spec da F10, "Tipos da web").
export type Agent = {
  slug: string;
  name: string;
  username: string;
  description: string;
  connected: boolean;
};

export type ListAgentsResult = { kind: "ok"; agents: Agent[] } | { kind: "failure" };

async function request(path: string, init: RequestInit): Promise<Response | null> {
  // Chamada de tempo de requisição, fora do pré-render, como no chat-api.ts.
  await connection();
  try {
    return await fetch(new URL(path, env.AGENTS_SERVICE_URL), {
      ...init,
      headers: { ...init.headers, authorization: `Bearer ${env.AGENTS_SERVICE_TOKEN}` },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    // Rede fora ou tempo esgotado.
    return null;
  }
}

// O catálogo com o estado de conexão, memorizado por requisição: o layout e a rota leem o mesmo
// resultado numa renderização.
export const listAgents = cache(fetchAgents);

async function fetchAgents(): Promise<ListAgentsResult> {
  const response = await request("/v1/agents", { method: "GET" });
  if (response?.status !== 200) return { kind: "failure" };
  try {
    const body = (await response.json()) as { agents: Agent[] };
    return { kind: "ok", agents: body.agents };
  } catch {
    return { kind: "failure" };
  }
}
