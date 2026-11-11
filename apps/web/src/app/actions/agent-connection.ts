"use server";

import { setConnection } from "@/app/services/agents-service";
import { announceAgentsChanged, getCurrentPerson } from "@/app/services/chat-api";
import { readSessionToken } from "@/app/services/session-cookie";

// O resultado de conectar e desconectar (spec da F10, "BFF"): a união da F01 mais `forbidden`.
export type ConnectionResult =
  | { kind: "ok" }
  | { kind: "unauthenticated" }
  | { kind: "failure" }
  | { kind: "forbidden" };

// Conecta um Agente em nome do administrador: o papel é lido da API do chat a cada ação, e quem
// não administra recebe forbidden sem o Serviço de agentes ser chamado.
export async function connectAgent(slug: unknown): Promise<ConnectionResult> {
  return changeConnection(slug, true);
}

// Desconecta um Agente, pelos mesmos passos de conectar.
export async function disconnectAgent(slug: unknown): Promise<ConnectionResult> {
  return changeConnection(slug, false);
}

async function changeConnection(slug: unknown, connected: boolean): Promise<ConnectionResult> {
  if (typeof slug !== "string" || slug === "") return { kind: "failure" };
  const token = await readSessionToken();
  if (!token) return { kind: "unauthenticated" };
  // A Server Action é uma requisição própria, e o fetch é sem cache: o papel é o do banco agora.
  const session = await getCurrentPerson(token);
  if (session.kind !== "ok") return session;
  if (!session.person.isAdmin) return { kind: "forbidden" };
  const result = await setConnection(slug, connected, session.person);
  if (result.kind !== "ok") return result;
  // O estado já mudou: uma falha no aviso só vai para o log, e os outros clientes acertam na
  // próxima conexão do socket.
  if (!(await announceAgentsChanged(token))) {
    console.error(`Falha ao avisar a mudança de conexão do agente ${slug}`);
  }
  return result;
}
