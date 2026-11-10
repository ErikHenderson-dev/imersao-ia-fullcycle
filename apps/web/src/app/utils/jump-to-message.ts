import type { Message } from "@/app/services/chat-api";
import { isUuid } from "./uuid";

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

// O alvo da ida ao abrir a Conversa: a original de uma Citação ou a Mensagem pedida, ou a primeira
// Não lida depois da Última leitura.
export type JumpTarget = { kind: "message"; id: string } | { kind: "unread"; lastReadId: string | null };

// Para onde a Conversa vai ao abrir (spec da F08, "Abrir a Conversa na Mensagem"): a Mensagem pedida
// em `?mensagem=` vence a primeira Não lida da F07; sem ela, a primeira Não lida, quando havia Não
// lidas ao abrir; sem as duas, nenhuma ida, e a Conversa abre no fim.
export function openingTarget(
  messageParam: string | null,
  dividerAfter: { lastReadId: string | null } | null,
): JumpTarget | null {
  // Os ids da API vêm em minúsculas, e a ida os compara como texto.
  if (messageParam && isUuid(messageParam)) return { kind: "message", id: messageParam.toLowerCase() };
  return dividerAfter ? { kind: "unread", lastReadId: dividerAfter.lastReadId } : null;
}
