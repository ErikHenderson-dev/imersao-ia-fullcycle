import type {
  ActivityFilter,
  ActivityItem,
  ActivityPage,
  Conversation,
  Message,
  NotificationKind,
} from "@/app/services/chat-api";
import { activityItemId } from "./activity";

// As chaves do cache do SWR da Atividade, por Pessoa: quem entra depois de outra na mesma aba não
// herda os números nem as páginas dela.
export function activityUnreadKey(personId: string): [string, string] {
  return ["activity-unread", personId];
}

// As abas carregadas guardam as páginas de Atividade como vieram da API: a primeira é a mais nova, e
// os itens de cada uma estão em ordem cronológica (spec da F08, "Tela Atividade").
type Page = ActivityPage;

// O tipo de Notificação que a Mensagem é para a Pessoa, ou nulo (spec da F08, "Notificações e
// contagem"): numa Conversa direta, a Mensagem de outro autor; num Canal, a que menciona a Pessoa.
// A decisão que a Atividade, o Alerta e a notificação do navegador usam.
export function notificationKindFor(
  message: Pick<Message, "author" | "mentions">,
  conversation: Pick<Conversation, "kind"> | undefined,
  personId: string,
): NotificationKind | null {
  if (!conversation || message.author.id === personId) return null;
  // A Mensagem de bot só é Notificação quando menciona a Pessoa num Canal, como a falha e a entrega
  // do Relatório (spec da F14, "Ações de bot do Relatório"); fora disso, nunca (spec da F11, "Autor
  // da Mensagem").
  if (conversation.kind === "direct") return message.author.kind === "bot" ? null : "direct";
  return message.mentions.some((mention) => mention.id === personId) ? "mention" : null;
}

// A Notificação de Tarefa só entra em Todas (spec da F12, "Atividade").
function belongsTo(kind: ActivityItem["kind"], filter: ActivityFilter): boolean {
  return filter === "all" || (filter === "mentions" ? kind === "mention" : kind === "direct");
}

function without(pages: readonly Page[], id: string): Page[] {
  return pages.map((page) => ({
    ...page,
    items: page.items.filter((item) => activityItemId(item) !== id),
  }));
}

function contains(pages: readonly Page[], id: string): boolean {
  return pages.some((page) => page.items.some((item) => activityItemId(item) === id));
}

// Põe o item no lugar dele pelo id. Mais antigo que tudo o que está carregado, com páginas por vir,
// ele fica para a página que trouxer aquela parte.
function inserted(pages: readonly Page[], item: ActivityItem): Page[] {
  if (pages.length === 0) return [{ items: [item], hasMore: false }];
  const id = activityItemId(item);
  const last = pages.at(-1)!;
  const oldest = last.items[0] && activityItemId(last.items[0]);
  if (last.hasMore && oldest !== undefined && id < oldest) return [...pages];
  const index = pages.findIndex((page) => (page.items[0] ? activityItemId(page.items[0]) : "") <= id);
  const target = index === -1 ? pages.length - 1 : index;
  return pages.map((page, position) =>
    position === target
      ? {
          ...page,
          items: [...page.items, item].sort((a, b) => {
            const [first, second] = [activityItemId(a), activityItemId(b)];
            return first < second ? -1 : first > second ? 1 : 0;
          }),
        }
      : page,
  );
}

// Uma Mensagem nova que é Notificação da aba, ou uma Notificação de Tarefa nova, entra no topo dela.
export function applyCreated(
  pages: readonly Page[],
  item: ActivityItem,
  filter: ActivityFilter,
): Page[] {
  if (!belongsTo(item.kind, filter) || contains(pages, activityItemId(item))) return [...pages];
  return inserted(pages, item);
}

// Uma Mensagem editada: o item troca o texto; se a Menção à Pessoa saiu, o item sai; se entrou, ele
// entra no lugar dele. `item` é nulo quando a Mensagem deixou de ser Notificação.
export function applyUpdated(
  pages: readonly Page[],
  message: Message,
  item: Extract<ActivityItem, { message: Message }> | null,
  filter: ActivityFilter,
): Page[] {
  if (!item || !belongsTo(item.kind, filter)) return without(pages, message.id);
  if (!contains(pages, message.id)) return inserted(pages, item);
  return pages.map((page) => ({
    ...page,
    items: page.items.map((entry) =>
      entry.kind !== "task" && entry.message.id === message.id ? { ...entry, message } : entry,
    ),
  }));
}

// Uma Mensagem apagada sai da Atividade.
export function applyDeleted(pages: readonly Page[], messageId: string): Page[] {
  return without(pages, messageId);
}
