import { listAgents } from "@/app/services/agents-service";
import { getCurrentPerson } from "@/app/services/chat-api";
import { readSessionToken } from "@/app/services/session-cookie";

// O catálogo de Agentes com o estado de conexão (spec da F10, "BFF"), relido pelo cliente. Exige
// Sessão; a falha do Serviço de agentes responde 502 com agents_unavailable.
export async function GET() {
  const token = await readSessionToken();
  const session = token ? await getCurrentPerson(token) : ({ kind: "unauthenticated" } as const);
  if (session.kind === "unauthenticated") {
    return Response.json({ kind: "unauthenticated" }, { status: 401 });
  }
  if (session.kind === "failure") return Response.json({ kind: "failure" }, { status: 502 });
  const result = await listAgents();
  if (result.kind === "ok") return Response.json(result.agents);
  return Response.json({ kind: "agents_unavailable" }, { status: 502 });
}
