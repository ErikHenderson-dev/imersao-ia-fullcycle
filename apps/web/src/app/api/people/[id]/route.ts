import { getProfile } from "@/app/services/chat-api";
import { readSessionToken } from "@/app/services/session-cookie";

// O Perfil de uma Pessoa, lido pelo painel de perfil no cliente (spec da F05, "BFF"), já com as
// iniciais.
export async function GET(_request: Request, { params }: RouteContext<"/api/people/[id]">) {
  const { id } = await params;
  const token = await readSessionToken();
  const result = token ? await getProfile(token, id) : ({ kind: "unauthenticated" } as const);
  if (result.kind === "ok") return Response.json(result.profile);
  return Response.json({ kind: result.kind }, { status: ERROR_STATUS[result.kind] });
}

const ERROR_STATUS = { unauthenticated: 401, not_found: 404, failure: 502 } as const;
