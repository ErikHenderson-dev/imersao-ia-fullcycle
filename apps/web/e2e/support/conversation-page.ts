import { routeServerAction } from "./server-action";
import type { Locator, Page } from "@playwright/test";

// O histórico da Conversa depois de hidratado e em dia com o tempo real: antes disso, rolar não
// pede as anteriores, a abertura leva a lista de volta ao fim, e o reset da conexão ainda recarrega
// a página mais recente.
export async function readyHistory(page: Page, channelName: string): Promise<Locator> {
  return readyConversation(page, `#${channelName}`);
}

// O mesmo para qualquer Conversa, pelo título dela: "#nome" no Canal e o nome da outra Pessoa na
// Conversa direta (F05).
export async function readyConversation(page: Page, title: string): Promise<Locator> {
  const history = page.getByRole("region", { name: `Histórico de ${title}` });
  await history.and(page.locator("[data-ready][data-synced]")).waitFor();
  return history;
}

export async function scrollHistoryToTop(history: Locator): Promise<void> {
  await history.evaluate((element) => {
    element.scrollTop = 0;
  });
}

export function messageList(page: Page, channelName: string): Locator {
  return page.getByRole("list", { name: `Mensagens em #${channelName}` });
}

// Os itens da lista de Mensagens com o texto dado.
export function messageItem(page: Page, channelName: string, text: string): Locator {
  return messageList(page, channelName).getByRole("listitem").filter({ hasText: text });
}

// A Mensagem do Agente na Conversa: o item da lista com o nome do Agente (F11).
export function agentMessage(page: Page, channelName: string): Locator {
  return messageList(page, channelName)
    .getByRole("listitem")
    .filter({ has: page.getByRole("button", { name: "Assistente", exact: true }) });
}

// Abre "Apagar mensagem?" pelo menu da Mensagem (F06) e devolve o diálogo.
export async function openDeleteDialog(page: Page, item: Locator): Promise<Locator> {
  await item.hover();
  await item.getByRole("button", { name: "Mais ações" }).click();
  await page.getByRole("menuitem", { name: "Apagar" }).click();
  return page.getByRole("alertdialog", { name: "Apagar mensagem?" });
}

// A caixa de mensagem do Canal.
export function composer(page: Page, channelName: string): Locator {
  return page.getByRole("textbox", { name: `Mensagem para #${channelName}` });
}

export function conversationIntro(page: Page, channelName: string): Locator {
  return page.getByRole("heading", { name: `Este é o começo do canal #${channelName}` });
}

// O envio de Mensagem é um Server Action na página da Conversa (support/server-action.ts).
export function routeSendMessage(
  page: Page,
  handler: Parameters<Page["route"]>[1],
): Promise<() => Promise<void>> {
  return routeServerAction(page, handler, (url) => url.pathname.startsWith("/conversas/"));
}

// Leva a lista para longe do fim (e longe do topo, para não pedir as anteriores) e devolve a
// posição da rolagem.
export async function scrollAwayFromEnd(history: Locator): Promise<number> {
  return history.evaluate((element) => {
    element.scrollTop = element.scrollHeight - element.clientHeight - 600;
    return element.scrollTop;
  });
}

// A distância da rolagem até o fim da lista.
export function distanceToEnd(history: Locator): Promise<number> {
  return history.evaluate(
    (element) => element.scrollHeight - element.scrollTop - element.clientHeight,
  );
}

export async function scrollHistoryToEnd(history: Locator): Promise<void> {
  await history.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
}

export function newMessagesPill(page: Page): Locator {
  return page.getByRole("button", { name: "Novas mensagens" });
}

// O aviso de "digitando" de uma Pessoa na Conversa aberta.
export function typingNotice(page: Page, name: string): Locator {
  return page.getByText(`${name} está digitando…`);
}
