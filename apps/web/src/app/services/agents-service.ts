import { connection } from "next/server";
import { cache } from "react";
import { env } from "@/app/config/env";
import type { AgentRequest } from "@/app/services/chat-api";

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

export type SetConnectionResult = { kind: "ok" } | { kind: "failure" };

// Conecta ou desconecta um Agente em nome de quem pede, com o papel dela (ADR 0015; spec da F10,
// "BFF"). Qualquer resposta que não seja 204 é falha: o forbidden e o agent_not_found do Serviço
// de agentes não chegam à tela de outro jeito.
export async function setConnection(
  slug: string,
  connected: boolean,
  person: { id: string; isAdmin: boolean },
): Promise<SetConnectionResult> {
  const response = await request(`/v1/agents/${encodeURIComponent(slug)}/connection`, {
    method: connected ? "PUT" : "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ person_id: person.id, is_admin: person.isAdmin }),
  });
  return response?.status === 204 ? { kind: "ok" } : { kind: "failure" };
}

// O Pedido entregue ao Serviço de agentes (spec da F11, "Rota de Pedido").
export type AgentRequestPayload = {
  requestId: string;
  kind: AgentRequest["kind"];
  parentRequestId: string | null;
  agent: string;
  conversationId: string;
  message: { id: string; body: string };
  requester: { id: string; name: string; username: string };
  mentions: { username: string; name: string }[];
  timeZone: string;
  // A Mensagem citada pelo Pedido, ou nula (spec da F12, "Rota de Pedido e execução").
  quote: { id: string; body: string; author: { name: string; username: string } } | null;
};

// Sem resposta (rede fora ou tempo esgotado), o status é nulo.
export type StartAgentRequestResult = { kind: "accepted" } | { kind: "failure"; status: number | null };

// Entrega o Pedido e espera só o aceite (spec da F11, "Disparo pelo BFF"): o Agente responde na
// Conversa pela API do chat, depois.
export async function startAgentRequest(payload: AgentRequestPayload): Promise<StartAgentRequestResult> {
  const response = await request("/v1/requests", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      request_id: payload.requestId,
      kind: payload.kind,
      parent_request_id: payload.parentRequestId,
      agent: payload.agent,
      conversation_id: payload.conversationId,
      message: payload.message,
      requester: payload.requester,
      mentions: payload.mentions,
      time_zone: payload.timeZone,
      quote: payload.quote,
    }),
  });
  return response?.status === 202
    ? { kind: "accepted" }
    : { kind: "failure", status: response?.status ?? null };
}
