import { type NextRequest } from "next/server";
import { searchPeople } from "@/app/services/chat-api";
import { readSessionToken } from "@/app/services/session-cookie";

// Busca de Pessoas, lida pelo cliente (spec da F04, "BFF"): para adicionar a uma Conversa, ou no
// "Nova conversa", sem not_member_of (spec da F05). A resposta já vem no formato da web, com as
// iniciais.
export async function GET(request: NextRequest) {
  const token = await readSessionToken();
  const params = request.nextUrl.searchParams;
  const result = token
    ? await searchPeople(token, {
        q: params.get("q") ?? "",
        notMemberOf: params.get("not_member_of") ?? undefined,
      })
    : ({ kind: "unauthenticated" } as const);
  if (result.kind === "ok") return Response.json(result.people);
  return Response.json({ kind: result.kind }, { status: ERROR_STATUS[result.kind] });
}

const ERROR_STATUS = { invalid: 400, unauthenticated: 401, not_found: 404, failure: 502 } as const;
