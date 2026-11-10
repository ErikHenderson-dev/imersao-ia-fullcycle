import { type NextRequest } from "next/server";
import { markActivityRead } from "@/app/services/chat-api";
import { readSessionToken } from "@/app/services/session-cookie";

// Marca tudo como lido em Atividade, pedido pelo cliente (spec da F08, "BFF"): rota, e não Server
// Action, pelo mesmo motivo da rota de leitura da F07.
export async function PUT(request: NextRequest) {
  const token = await readSessionToken();
  const body = (await request.json().catch(() => null)) as { messageId?: unknown } | null;
  if (typeof body?.messageId !== "string") return Response.json({ kind: "invalid" }, { status: 400 });
  const result = token
    ? await markActivityRead(token, body.messageId)
    : ({ kind: "unauthenticated" } as const);
  if (result.kind === "ok") return Response.json(result.unread);
  return Response.json({ kind: result.kind }, { status: ERROR_STATUS[result.kind] });
}

const ERROR_STATUS = { unauthenticated: 401, not_found: 404, invalid: 400, failure: 502 } as const;
