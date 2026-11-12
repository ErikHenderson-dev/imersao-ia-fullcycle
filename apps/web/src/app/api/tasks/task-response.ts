import type { TaskResult } from "@/app/services/chat-api";

// A resposta das rotas de uma Tarefa no BFF: a Tarefa, ou o erro com o status da API.
export function taskResponse(result: TaskResult): Response {
  if (result.kind === "ok") return Response.json(result.task);
  return Response.json({ kind: result.kind }, { status: ERROR_STATUS[result.kind] });
}

const ERROR_STATUS = { unauthenticated: 401, not_found: 404, not_assignee: 403, failure: 502 } as const;
