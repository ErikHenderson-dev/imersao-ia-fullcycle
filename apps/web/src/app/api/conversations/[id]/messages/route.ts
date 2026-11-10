import { type NextRequest } from "next/server";
import { listMessages } from "@/app/services/chat-api";
import { readSessionToken } from "@/app/services/session-cookie";

// Páginas anteriores do histórico, lidas pelo cliente (LLD, "Cliente", "Leituras e tempo real"). A
// resposta já vem no formato da web, com as iniciais dos autores.
export async function GET(
  request: NextRequest,
  { params }: RouteContext<"/api/conversations/[id]/messages">,
) {
  const { id } = await params;
  const token = await readSessionToken();
  const before = request.nextUrl.searchParams.get("before") ?? undefined;
  // A ida até a Mensagem citada pede páginas maiores (spec da F06); a API valida o limite.
  const rawLimit = request.nextUrl.searchParams.get("limit");
  const limit = rawLimit && /^\d+$/.test(rawLimit) ? Number(rawLimit) : undefined;
  const result = token
    ? await listMessages(token, id, { before, limit })
    : ({ kind: "unauthenticated" } as const);
  if (result.kind === "ok") return Response.json(result.page);
  return Response.json({ kind: result.kind }, { status: ERROR_STATUS[result.kind] });
}

const ERROR_STATUS = { unauthenticated: 401, not_found: 404, failure: 502 } as const;
