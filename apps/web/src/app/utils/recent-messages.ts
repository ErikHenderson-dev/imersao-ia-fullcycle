import type { Message } from "@/app/services/chat-api";
import { insertById, isNewerEdit } from "./message-pages";

// Quantas Mensagens recebidas o provedor guarda por Conversa (spec da F03, "Cliente").
export const RECENT_MESSAGES_LIMIT = 100;

// As Mensagens recebidas de uma Conversa desde a conexão, em ordem de id, sem repetir e só as
// últimas `limit`: a Conversa que monta depois junta as que chegaram enquanto o servidor lia o
// histórico.
export function rememberMessage(
  recent: readonly Message[],
  message: Message,
  limit = RECENT_MESSAGES_LIMIT,
): readonly Message[] {
  if (recent.some((existing) => existing.id === message.id)) return recent;
  return insertById(recent, message).slice(-limit);
}

// A Mensagem editada no lugar da guardada, se ela estiver lá e a edição for mais nova: a Conversa
// que monta depois não mostra o texto antigo.
export function rememberEdit(recent: readonly Message[], edited: Message): readonly Message[] {
  const index = recent.findIndex((message) => message.id === edited.id);
  if (index < 0 || !isNewerEdit(recent[index], edited)) return recent;
  return recent.with(index, edited);
}

// As Mensagens mais novas que `newestId`, ou todas sem ele.
export function newerThan(recent: readonly Message[], newestId: string | undefined): Message[] {
  return newestId ? recent.filter((message) => message.id > newestId) : [...recent];
}
