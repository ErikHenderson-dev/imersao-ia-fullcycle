import type {
  ActivityFilter,
  ActivityItem,
  ActivityUnread,
  Conversation,
} from "@/app/services/chat-api";
import { cachedFormatter } from "./date-formatters";
import { spoken } from "./unread";

// Uma aba da tela Atividade: um filtro da lista de Notificações, ou a aba Tarefas (spec da F12,
// "Cliente (web)").
export type ActivityTab = ActivityFilter | "tasks";

// As abas da tela Atividade (spec da F08, "Tela Atividade"): o valor de `?aba=` e o filtro da API.
// Todas fica sem query.
// `count` é o número de ActivityUnread que o contador da aba mostra; a aba Tarefas ainda não tem.
export const ACTIVITY_TABS = [
  { filter: "all", param: null, label: "Todas", count: "totalCount" },
  { filter: "mentions", param: "mencoes", label: "Menções", count: "mentionCount" },
  { filter: "direct", param: "diretas", label: "Mensagens diretas", count: "directCount" },
  { filter: "tasks", param: "tarefas", label: "Tarefas", count: null },
] as const satisfies readonly {
  filter: ActivityTab;
  param: string | null;
  label: string;
  count: keyof ActivityUnread | null;
}[];

const NOTIFICATION_FILTERS: readonly ActivityFilter[] = ["all", "mentions", "direct"];

// A aba pedida em `?aba=`; uma aba desconhecida vale como Todas.
export function activityTabFromParam(tab: string | string[] | undefined): ActivityTab {
  const value = Array.isArray(tab) ? tab[0] : tab;
  return ACTIVITY_TABS.find((entry) => entry.param !== null && entry.param === value)?.filter ?? "all";
}

// O caminho de cada aba.
export function activityTabHref(tab: ActivityTab): string {
  const param = ACTIVITY_TABS.find((entry) => entry.filter === tab)?.param;
  return param ? `/atividade?aba=${param}` : "/atividade";
}

// O filtro vindo da rota do BFF (`?kind=`), ou nulo quando é inválido; sem ele, Todas.
export function activityFilterFromParam(value: string | null): ActivityFilter | null {
  if (value === null) return "all";
  return NOTIFICATION_FILTERS.find((filter) => filter === value) ?? null;
}

// O título do item, que o Alerta reaproveita (F08-T05): "Rafael Trevisani mencionou você em #geral"
// ou "Regina Fonseca enviou uma mensagem direta".
export function notificationTitle(
  item: Pick<ActivityItem, "kind" | "message"> & { conversation: Pick<Conversation, "name"> },
): string {
  const author = item.message.author.name;
  return item.kind === "mention"
    ? `${author} mencionou você em #${item.conversation.name}`
    : `${author} enviou uma mensagem direta`;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// O tempo relativo do item: "agora" no primeiro minuto, "há N min" na primeira hora, "há N h" no
// primeiro dia e, depois, a data, como "3 de nov.", no fuso de quem vê.
export function relativeTime(isoDate: string, now: number, timeZone: string): string {
  const elapsed = Math.max(0, now - new Date(isoDate).getTime());
  if (elapsed < MINUTE) return "agora";
  if (elapsed < HOUR) return `há ${Math.floor(elapsed / MINUTE)} min`;
  if (elapsed < DAY) return `há ${Math.floor(elapsed / HOUR)} h`;
  return cachedFormatter(`day-month:${timeZone}`, () =>
    new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", timeZone }),
  ).format(new Date(isoDate));
}

// A Notificação está lida quando a Mensagem é igual ou anterior ao maior entre a Última leitura da
// Conversa e a marca de "Marcar tudo como lido" (spec da F08, "Tela Atividade"). Os ids são UUID v7,
// em ordem de criação, comparados como texto.
export function isNotificationRead(
  messageId: string,
  lastReadMessageId: string | null,
  activityReadMessageId: string | null = null,
): boolean {
  return [lastReadMessageId, activityReadMessageId].some((mark) => mark !== null && messageId <= mark);
}

// O que o leitor de tela ouve depois do texto visível do item, já que o ponto não tem texto: ",
// não lida".
export function notificationSuffix(isRead: boolean): string {
  return isRead ? "" : ", não lida";
}

// O que o leitor de tela ouve depois de "Atividade" ou do nome de uma aba, no lugar do número que o
// CountBadge esconde dele: ", 3 não lidas".
export function unreadSuffix(count: number): string {
  if (count <= 0) return "";
  return `, ${spoken(count)} ${count === 1 ? "não lida" : "não lidas"}`;
}
