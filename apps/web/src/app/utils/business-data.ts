// O aviso da Resposta bloqueada (spec da F13, "Cliente"), no lugar do texto da Mensagem e da
// citação, e o que "Copiar texto" copia nela.
export const BLOCKED_NOTICE = "Resposta com dados de negócio. Você não tem permissão para vê-la.";

// O texto que a Mensagem ou a citação mostra (e a Mensagem copia): o aviso, quando ela está
// bloqueada para quem lê. O evento guardado antes da F13 não traz `blocked`.
export function displayText(content: { body: string; blocked?: boolean }): string {
  return content.blocked ? BLOCKED_NOTICE : content.body;
}
