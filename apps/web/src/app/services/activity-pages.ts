import { redirectToExpiredSession } from "@/app/utils/return-path";
import type { ActivityFilter, ActivityPage, ActivityUnread } from "@/app/services/chat-api";

// Uma página anterior de Atividade pela rota do BFF, no cliente (spec da F08, "BFF").
export async function fetchActivityPage([, , filter, before]: ActivityPageKey): Promise<ActivityPage> {
  const params = new URLSearchParams({ kind: filter });
  if (before) params.set("before", before);
  const response = await fetch(`/api/activity?${params.toString()}`);
  if (response.status === 401) return redirectToExpiredSession();
  if (!response.ok) throw new Error("Não foi possível carregar sua atividade.");
  return (await response.json()) as ActivityPage;
}

// A chave de uma página: a Pessoa, o filtro e o `before` (nulo na primeira).
export type ActivityPageKey = [string, string, ActivityFilter, string | null];

// Os números de Atividade pela rota do BFF, no cliente. Um 401 aqui é só uma falha, como a lista de
// Conversas na reconexão: quem leva a "Entrar" é o fim da Sessão no tempo real.
export async function fetchActivityUnread(): Promise<ActivityUnread> {
  const response = await fetch("/api/activity/unread");
  if (!response.ok) throw new Error("Não foi possível carregar os números de atividade.");
  return (await response.json()) as ActivityUnread;
}
