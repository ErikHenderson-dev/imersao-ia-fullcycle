import type { Message, MessagePage } from "@/app/services/chat-api";

// Forma do cache do histórico (spec da F02, "Leituras"): pages[0] é a página mais recente, e as
// anteriores entram depois dela. A renderização recebe a lista cronológica.
export function flattenPages(pages: MessagePage[]): Message[] {
  return pages.toReversed().flatMap((page) => page.messages);
}

// A Mensagem gravada pelo envio entra em pages[0], na ordem do id (UUID v7, a ordem da Conversa),
// sem repetir uma que já está em alguma página. Quase sempre ela é a mais nova e vai para o fim;
// um reenvio que a API devolve já gravada pode ser mais antigo que outras do fim.
export function appendToLatestPage(pages: MessagePage[], message: Message): MessagePage[] {
  const [latest, ...older] = pages;
  if (!latest) return [{ messages: [message], hasMore: false }];
  if (pages.some((page) => page.messages.some((existing) => existing.id === message.id))) {
    return pages;
  }
  // Mais antiga que o começo de pages[0], com mais histórico atrás: entrar ali mudaria o cursor
  // da página seguinte (que sai do começo de pages[0]) e esconderia Mensagens. Ela fica de fora e
  // chega com a página do servidor que a contém.
  const hasOlder = pages.length > 1 || latest.hasMore;
  const start = latest.messages[0];
  if (hasOlder && start && message.id < start.id) return pages;
  return [{ ...latest, messages: insertById(latest.messages, message) }, ...older];
}

// Uma edição é mais nova que a Mensagem que a tela tem quando o editedAt dela é posterior (spec da
// F06, "Eventos no cliente"): uma edição atrasada, que chega depois de outra mais nova, não volta o
// texto antigo.
export function isNewerEdit(current: Message, edited: Message): boolean {
  if (!edited.editedAt) return false;
  return !current.editedAt || edited.editedAt > current.editedAt;
}

// A Mensagem editada no lugar da que está na lista, se ela estiver lá e a edição for mais nova; senão,
// a mesma lista. Uma Mensagem que não está na lista não entra: a edição não traz Mensagens de volta.
export function withEdit<T extends readonly Message[]>(messages: T, edited: Message): T | Message[] {
  const index = messages.findIndex((message) => message.id === edited.id);
  if (index < 0 || !isNewerEdit(messages[index], edited)) return messages;
  return messages.with(index, edited);
}

// Troca, pelo id, a Mensagem editada no cache, só se a edição for mais nova.
export function replaceEdited(pages: MessagePage[], edited: Message): MessagePage[] {
  const index = pages.findIndex((page) => page.messages.some((message) => message.id === edited.id));
  if (index < 0) return pages;
  const messages = withEdit(pages[index].messages, edited);
  if (messages === pages[index].messages) return pages;
  return pages.with(index, { ...pages[index], messages });
}

// As Citações das Mensagens carregadas acompanham a original (spec da F06, "Eventos no cliente"): a
// editada troca o texto, se a Citação não estiver apagada (uma edição atrasada já foi descartada por
// quem chama); a apagada vira a marca de apagada.
export function patchQuotes(
  pages: MessagePage[],
  original: { id: string; edited?: Message; deleted?: boolean },
): MessagePage[] {
  let changed = false;
  const next = pages.map((page) => {
    let pageChanged = false;
    const messages = page.messages.map((message) => {
      const quote = message.quote;
      if (!quote || quote.id !== original.id || quote.deleted) return message;
      if (original.deleted) {
        pageChanged = true;
        return { ...message, quote: { id: quote.id, deleted: true as const } };
      }
      const edited = original.edited;
      if (!edited || edited.body === quote.body) return message;
      pageChanged = true;
      return { ...message, quote: { ...quote, body: edited.body } };
    });
    if (!pageChanged) return page;
    changed = true;
    return { ...page, messages };
  });
  return changed ? next : pages;
}

// Tira a Mensagem apagada do cache, pelo id (spec da F06, "Eventos no cliente").
export function removeDeleted(pages: MessagePage[], messageId: string): MessagePage[] {
  const index = pages.findIndex((page) => page.messages.some((message) => message.id === messageId));
  if (index < 0) return pages;
  const page = pages[index];
  return pages.with(index, {
    ...page,
    messages: page.messages.filter((message) => message.id !== messageId),
  });
}

// Encaixa a Mensagem na ordem do id (UUID v7, a ordem da Conversa). Quem chama já descartou o id
// repetido.
export function insertById(messages: readonly Message[], message: Message): Message[] {
  const position = messages.findLastIndex((existing) => existing.id < message.id) + 1;
  return messages.toSpliced(position, 0, message);
}
