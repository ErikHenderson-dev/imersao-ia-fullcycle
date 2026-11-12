import { getTask } from "@/app/services/chat-api";
import { readSessionToken } from "@/app/services/session-cookie";
import { taskResponse } from "../task-response";

// Uma Tarefa, pedida pelo cliente para o destaque fora da primeira página (spec da F12, "Cliente
// (web)").
export async function GET(_request: Request, { params }: RouteContext<"/api/tasks/[id]">) {
  const token = await readSessionToken();
  if (!token) return Response.json({ kind: "unauthenticated" }, { status: 401 });
  return taskResponse(await getTask(token, (await params).id));
}
