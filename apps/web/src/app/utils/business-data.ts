import type { QuotePayload } from "chat-events";

// O aviso da Resposta bloqueada (spec da F13, "Cliente"), no lugar do texto da Mensagem e da
// citação, e o que "Copiar texto" copia nela.
export const BLOCKED_NOTICE = "Resposta com dados de negócio. Você não tem permissão para vê-la.";

// O texto que a Mensagem mostra e copia: o aviso, quando ela está bloqueada para quem lê.
export function messageDisplayText(message: { body: string; blocked: boolean }): string {
  return message.blocked ? BLOCKED_NOTICE : message.body;
}

// O texto da citação não apagada: o aviso, quando a citada está bloqueada para quem lê.
export function quoteDisplayText(quote: Extract<QuotePayload, { deleted: false }>): string {
  return quote.blocked ? BLOCKED_NOTICE : quote.body;
}
