import { getMessageReportUrl } from "@/app/services/chat-api";
import { readSessionToken } from "@/app/services/session-cookie";
import { loginPath } from "@/app/utils/return-path";

// O download do PDF do Relatório (spec da F14, "Cliente (web)"): o link do ReportCard chega aqui, a
// API confere a Permissão de dados no clique, e a URL assinada só vai no 302, nunca no HTML.
export async function GET(request: Request, { params }: RouteContext<"/api/messages/[id]/report">) {
  const { id } = await params;
  const token = await readSessionToken();
  const result = token ? await getMessageReportUrl(token, id) : { kind: "unauthenticated" as const };
  switch (result.kind) {
    case "ok":
      return new Response(null, {
        status: 302,
        headers: { location: result.url, "cache-control": "no-store" },
      });
    case "unauthenticated":
      // Entra e volta ao download.
      return Response.redirect(new URL(loginPath(`/api/messages/${encodeURIComponent(id)}/report`), request.url), 302);
    case "forbidden":
      return errorPage(403, "Você não tem permissão para baixar este relatório.");
    case "not_found":
      return errorPage(404, "Relatório não encontrado.");
    default:
      return errorPage(502, "Não foi possível baixar o relatório agora.");
  }
}

// A página curta do erro, aberta no lugar do download.
function errorPage(status: number, message: string): Response {
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${message}</title></head><body><main><h1>${message}</h1><p><a href="/">Voltar ao chat</a></p></main></body></html>`;
  return new Response(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}
