import { markConversationRead } from "@/app/services/chat-api";
import { readSessionToken } from "@/app/services/session-cookie";

// Ler a Conversa até uma Mensagem, pedido pelo cliente (spec da F07, "BFF"). É uma rota, e não um
// Server Action: os Server Actions de uma aba rodam em série, e o aviso de leitura, que sai sozinho
// a cada Mensagem que chega, seguraria o envio e a edição da Pessoa atrás dele.
export async function PUT(request: Request, { params }: RouteContext<"/api/conversations/[id]/read">) {
  const { id } = await params;
  const token = await readSessionToken();
  if (!token) return Response.json({ kind: "unauthenticated" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as { messageId?: unknown } | null;
  if (typeof body?.messageId !== "string") return Response.json({ kind: "invalid" }, { status: 400 });
  const result = await markConversationRead(token, id, body.messageId);
  if (result.kind === "ok") return Response.json(result.unread);
  return Response.json({ kind: result.kind }, { status: ERROR_STATUS[result.kind] });
}

const ERROR_STATUS = { unauthenticated: 401, not_found: 404, invalid: 400, failure: 502 } as const;
