import { getPresence } from "@/app/services/chat-api";
import { readSessionToken } from "@/app/services/session-cookie";

// O retrato de quem tem Status, lido pela camada de Pessoas na conexão e na reconexão (spec da F09,
// "BFF").
export async function GET() {
  const token = await readSessionToken();
  const result = token ? await getPresence(token) : ({ kind: "unauthenticated" } as const);
  if (result.kind === "ok") return Response.json({ people: result.people });
  return Response.json({ kind: result.kind }, { status: ERROR_STATUS[result.kind] });
}

const ERROR_STATUS = { unauthenticated: 401, failure: 502 } as const;
