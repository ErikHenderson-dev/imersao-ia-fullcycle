import { changeTaskStatus } from "@/app/services/chat-api";
import { readSessionToken } from "@/app/services/session-cookie";
import { taskResponse } from "../../task-response";

// Conclui a Tarefa do Responsável, pedido pelo cliente (spec da F12, "Cliente (web)").
export async function POST(_request: Request, { params }: RouteContext<"/api/tasks/[id]/complete">) {
  const token = await readSessionToken();
  if (!token) return Response.json({ kind: "unauthenticated" }, { status: 401 });
  return taskResponse(await changeTaskStatus(token, (await params).id, "complete"));
}
