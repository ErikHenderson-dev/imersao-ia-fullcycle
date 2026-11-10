import type { Message } from "@/app/services/chat-api";

// A primeira Não lida da lista carregada (spec da F07, "Abrir na primeira Não lida e o divisor"): a
// primeira Mensagem de outro autor depois da Última leitura guardada ao abrir, ou a primeira de
// outro autor, com ela nula. Os ids são UUID v7 em minúsculas: a ordem do texto é a de criação.
export function firstUnreadId(
  messages: readonly Message[],
  lastReadId: string | null,
  selfId: string,
): string | null {
  const first = messages.find(
    (message) => message.author.id !== selfId && (lastReadId === null || message.id > lastReadId),
  );
  return first?.id ?? null;
}

// Se é preciso carregar as páginas anteriores antes de posicionar: a lista começa depois da Última
// leitura, ou, com ela nula, ainda não chegou ao começo.
export function needsOlderForUnread(
  messages: readonly Message[],
  lastReadId: string | null,
  hasOlder: boolean,
): boolean {
  if (!hasOlder) return false;
  const oldest = messages[0];
  return lastReadId === null || !oldest || oldest.id > lastReadId;
}
