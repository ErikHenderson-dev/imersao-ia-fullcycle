import type { Message } from "@/app/services/chat-api";

// Tamanho da página da ida até a Mensagem citada: o máximo do histórico (LLD, "Valores e
// configuração", "Tamanho da página").
export const JUMP_PAGE_SIZE = 100;

export type JumpStep = "found" | "missing" | "continue";

// O próximo passo da ida até a Mensagem citada (spec da F06, "Ir até a Mensagem citada"), pela lista
// carregada em ordem cronológica: achou; parou sem achar (não há mais páginas, ou a lista já começa
// antes da original, pela ordem dos ids UUID v7, e ela não está lá: foi apagada); ou continua.
export function jumpStep(messages: readonly Message[], targetId: string, hasOlder: boolean): JumpStep {
  if (messages.some((message) => message.id === targetId)) return "found";
  const oldest = messages[0];
  if (!hasOlder || (oldest && oldest.id < targetId)) return "missing";
  return "continue";
}
