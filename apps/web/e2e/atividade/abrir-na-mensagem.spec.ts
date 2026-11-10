// spec: e2e/plano-de-testes-f08.md
// seed: e2e/seed.spec.ts
import { expect, logIn, test } from "../fixtures";
import type { Page } from "@playwright/test";
import { distanceToEnd, messageList, readyHistory } from "../support/conversation-page";
import {
  insertChannel,
  insertHistory,
  insertMention,
  insertMessages,
  setLastRead,
  softDeleteMessage,
} from "../support/database";
import { sidebarLink, unreadRowName } from "../support/sidebar";

// A Mensagem pelo texto exato: "Mensagem 10" não casa com "Mensagem 100".
function messageItem(page: Page, channelName: string, body: string) {
  return messageList(page, channelName)
    .getByRole("listitem")
    .filter({ has: page.getByText(body, { exact: true }) });
}

test.describe("Abrir a Conversa na Mensagem", () => {
  test("vai até a Mensagem fora da primeira página e a destaca", async ({ loggedInPage: page, person, otherPerson }) => {
    const canal = await insertChannel([person, otherPerson], { name: `e2e-a-${crypto.randomUUID()}` });
    const historico = await insertHistory(canal, otherPerson, 160);
    await page.route("**/api/conversations/*/messages?*", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 400));
      await route.continue();
    });

    await page.goto(`/conversas/${canal.id}?mensagem=${historico[9].id}`);

    await expect(page.getByRole("status").filter({ hasText: "Indo até a mensagem…" })).toBeVisible();
    const alvo = messageItem(page, canal.name, "Mensagem 10");
    await expect(alvo.locator("[data-highlighted]")).toBeInViewport({ timeout: 15_000 });
    await expect(alvo.locator("[data-highlighted]")).toHaveCount(0, { timeout: 5_000 });
  });

  test("a URL perde o parâmetro e recarregar não vai de novo", async ({ loggedInPage: page, person, otherPerson }) => {
    const canal = await insertChannel([person, otherPerson], { name: `e2e-a-${crypto.randomUUID()}` });
    const historico = await insertHistory(canal, otherPerson, 160);

    await page.goto(`/conversas/${canal.id}?mensagem=${historico[9].id}`);

    await expect(messageItem(page, canal.name, "Mensagem 10").locator("[data-highlighted]")).toBeInViewport({
      timeout: 15_000,
    });
    await expect(page).toHaveURL(new RegExp(`/conversas/${canal.id}$`));
    await page.reload();
    const lista = await readyHistory(page, canal.name);
    await expect(messageItem(page, canal.name, "Mensagem 160")).toBeInViewport();
    expect(await distanceToEnd(lista)).toBeLessThan(10);
  });

  test("a Mensagem apagada mostra que não está mais disponível", async ({ loggedInPage: page, person, otherPerson }) => {
    const canal = await insertChannel([person, otherPerson], { name: `e2e-a-${crypto.randomUUID()}` });
    const historico = await insertHistory(canal, otherPerson, 20);
    await softDeleteMessage(historico[4].id);

    await page.goto(`/conversas/${canal.id}?mensagem=${historico[4].id}`);

    await expect(page.getByText("A mensagem não está mais disponível")).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(new RegExp(`/conversas/${canal.id}$`));
  });

  test("abrir na Mensagem lê a Conversa", async ({ page, person, otherPerson }) => {
    const primeiro = await insertChannel([person], { name: `e2e-0-${crypto.randomUUID()}` });
    const canal = await insertChannel([person, otherPerson], { name: `e2e-a-${crypto.randomUUID()}` });
    const [mencao] = await insertMessages(canal, [
      { author: otherPerson, body: `Oi @${person.username}`, at: new Date(Date.now() - 60_000) },
    ]);
    await insertMention(mencao.id, person);
    await logIn(page, person);
    await readyHistory(page, primeiro.name);
    await expect(sidebarLink(page, unreadRowName(canal.name, ", não lidas, 1 menção"))).toBeVisible();

    await page.goto(`/conversas/${canal.id}?mensagem=${mencao.id}`);

    await readyHistory(page, canal.name);
    await page.goto(`/conversas/${primeiro.id}`);
    await expect(sidebarLink(page, canal.name)).toBeVisible();
  });

  test("a Mensagem pedida vence a primeira Não lida, com o divisor no lugar", async ({
    loggedInPage: page,
    person,
    otherPerson,
  }) => {
    const canal = await insertChannel([person, otherPerson], { name: `e2e-a-${crypto.randomUUID()}` });
    const historico = await insertHistory(canal, otherPerson, 160);
    await setLastRead(canal, person, historico[19].id);

    await page.goto(`/conversas/${canal.id}?mensagem=${historico[9].id}`);

    const alvo = messageItem(page, canal.name, "Mensagem 10");
    await expect(alvo.locator("[data-highlighted]")).toBeInViewport({ timeout: 15_000 });
    await expect(messageItem(page, canal.name, "Mensagem 21").locator("[data-unread-divider]")).toHaveCount(1);
  });

  test("o item de Atividade leva à Mensagem", async ({ page, person, otherPerson }) => {
    const primeiro = await insertChannel([person], { name: `e2e-0-${crypto.randomUUID()}` });
    const canal = await insertChannel([person, otherPerson], { name: `e2e-a-${crypto.randomUUID()}` });
    const historico = await insertHistory(canal, otherPerson, 120);
    await insertMention(historico[4].id, person);
    await setLastRead(canal, person, historico[119].id);
    await logIn(page, person);
    await readyHistory(page, primeiro.name);
    await page.goto("/atividade");

    const item = page.getByRole("list", { name: "Notificações" }).getByRole("link");
    await item.focus();
    await page.keyboard.press("Enter");

    await expect(messageItem(page, canal.name, "Mensagem 5").locator("[data-highlighted]")).toBeInViewport({
      timeout: 15_000,
    });
  });
});
