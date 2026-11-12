import { markTaskNotificationRead } from "@/app/services/chat-api";
import { readSessionToken } from "@/app/services/session-cookie";

// Abre uma Notificação de Tarefa, pedido pelo cliente (spec da F12, "Cliente (web)").
export async function PUT(_request: Request, { params }: RouteContext<"/api/activity/task-notifications/[id]/read">) {
  const token = await readSessionToken();
  if (!token) return Response.json({ kind: "unauthenticated" }, { status: 401 });
  const result = await markTaskNotificationRead(token, (await params).id);
  if (result.kind === "ok") return new Response(null, { status: 204 });
  return Response.json({ kind: result.kind }, { status: ERROR_STATUS[result.kind] });
}

const ERROR_STATUS = { unauthenticated: 401, not_found: 404, failure: 502 } as const;
