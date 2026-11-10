import { getActivityUnread } from "@/app/services/chat-api";
import { readSessionToken } from "@/app/services/session-cookie";

// Os números de Atividade, buscados de novo pelo cliente na reconexão com `reset` (spec da F08,
// "Números de Atividade").
export async function GET() {
  const token = await readSessionToken();
  const result = token ? await getActivityUnread(token) : ({ kind: "unauthenticated" } as const);
  if (result.kind === "ok") return Response.json(result.unread);
  return Response.json({ kind: result.kind }, { status: result.kind === "unauthenticated" ? 401 : 502 });
}
