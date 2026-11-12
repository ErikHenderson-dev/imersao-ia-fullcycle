import { type NextRequest } from "next/server";
import { listTasks } from "@/app/services/chat-api";
import { readSessionToken } from "@/app/services/session-cookie";

const ROLES = ["assigned", "delegated"] as const;
const CURSOR = /^(open|done)\.[0-9a-f-]{36}$/;

// As páginas das Tarefas recebidas ou delegadas, pedidas pelo cliente (spec da F12, "Cliente
// (web)"). A resposta já vem no formato da web.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const role = ROLES.find((entry) => entry === params.get("role"));
  const cursor = params.get("cursor") ?? undefined;
  if (!role || (cursor !== undefined && !CURSOR.test(cursor))) {
    return Response.json({ kind: "invalid" }, { status: 400 });
  }
  const token = await readSessionToken();
  const result = token ? await listTasks(token, { role, cursor }) : ({ kind: "unauthenticated" } as const);
  if (result.kind === "ok") return Response.json(result.page);
  return Response.json({ kind: result.kind }, { status: ERROR_STATUS[result.kind] });
}

const ERROR_STATUS = { unauthenticated: 401, failure: 502 } as const;
