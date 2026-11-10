import { type NextRequest } from "next/server";
import { listActivity } from "@/app/services/chat-api";
import { readSessionToken } from "@/app/services/session-cookie";
import { activityFilterFromParam } from "@/app/utils/activity";
import { isUuid } from "@/app/utils/uuid";

// Páginas anteriores de Atividade, lidas pelo cliente (spec da F08, "BFF"). A resposta já vem no
// formato da web.
export async function GET(request: NextRequest) {
  const token = await readSessionToken();
  const params = request.nextUrl.searchParams;
  const kind = activityFilterFromParam(params.get("kind"));
  if (!kind) return Response.json({ kind: "invalid" }, { status: 400 });
  const before = params.get("before") ?? undefined;
  if (before !== undefined && !isUuid(before)) {
    return Response.json({ kind: "invalid" }, { status: 400 });
  }
  const result = token
    ? await listActivity(token, { kind, before })
    : ({ kind: "unauthenticated" } as const);
  if (result.kind === "ok") return Response.json(result.page);
  return Response.json({ kind: result.kind }, { status: ERROR_STATUS[result.kind] });
}

const ERROR_STATUS = { unauthenticated: 401, failure: 502 } as const;
