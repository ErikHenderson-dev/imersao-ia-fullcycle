// spec: e2e/plano-de-testes-f08.md
// seed: e2e/seed.spec.ts
import type { Page } from "@playwright/test";
import { expect, logIn, test } from "../fixtures";
import { deleteByApi, sendByApi } from "../support/chat-api";
import { readyHistory } from "../support/conversation-page";
import { insertChannel, insertDirect, insertMention, insertMessages, type TestPerson } from "../support/database";
import { waitForRealtime } from "../support/realtime";
import { unreadRowName } from "../support/sidebar";

function activityLink(page: Page) {
  return page.getByRole("navigation", { name: "Seções" }).getByRole("link", { name: /^Atividade/ });
}

function activityItems(page: Page) {
  return page.getByRole("list", { name: "Notificações" }).getByRole("link");
}

// A Pessoa com duas abas: a primeira na Atividade e a segunda num Canal vazio, que a Home abre.
async function twoTabs(page: Page, person: TestPerson) {
  const primeiro = await insertChannel([person], { name: `e2e-0-${crypto.randomUUID()}` });
  await logIn(page, person);
  await readyHistory(page, primeiro.name);
  const outra = await page.context().newPage();
  await outra.goto(`/conversas/${primeiro.id}`);
  await readyHistory(outra, primeiro.name);
  await waitForRealtime(outra);
  await page.goto("/atividade");
  await waitForRealtime(page);
  return { primeiro, outra };
}

test.describe("Atividade em tempo real", () => {
  test("a Notificação entra na Atividade e no rail das duas abas", async ({
    page,
    person,
    otherPerson,
    otherPage,
  }) => {
    const canal = await insertChannel([person, otherPerson], { name: `e2e-a-${crypto.randomUUID()}` });
    const direta = await insertDirect(person, otherPerson);
    const { outra } = await twoTabs(page, person);

    await sendByApi(otherPage, canal.id, `Oi @${person.username}`);
    await sendByApi(otherPage, direta.id, "Tudo bem?");

    await expect(activityItems(page)).toHaveCount(2);
    await expect(activityItems(page).first()).toHaveAccessibleName(/enviou uma mensagem direta/);
    await expect(activityLink(page)).toHaveAccessibleName(unreadRowName("Atividade", ", 2 não lidas"));
    await expect(activityLink(outra)).toHaveAccessibleName(unreadRowName("Atividade", ", 2 não lidas"));
  });

  test("a Mensagem apagada sai da Atividade", async ({ page, person, otherPerson, otherPage }) => {
    const canal = await insertChannel([person, otherPerson], { name: `e2e-a-${crypto.randomUUID()}` });
    await twoTabs(page, person);
    const id = await sendByApi(otherPage, canal.id, `Oi @${person.username}`);
    await expect(activityItems(page)).toHaveCount(1);

    await deleteByApi(otherPage, canal.id, id);

    await expect(activityItems(page)).toHaveCount(0);
    await expect(activityLink(page)).toHaveAccessibleName("Atividade");
  });

  test("ler a Conversa deixa o item lido e baixa o número nas duas abas", async ({
    page,
    person,
    otherPerson,
  }) => {
    const canal = await insertChannel([person, otherPerson], { name: `e2e-a-${crypto.randomUUID()}` });
    const [mencao] = await insertMessages(canal, [
      { author: otherPerson, body: `Oi @${person.username}`, at: new Date(Date.now() - 60_000) },
    ]);
    await insertMention(mencao.id, person);
    const { outra } = await twoTabs(page, person);
    await expect(activityItems(page)).toHaveCount(1);
    await expect(activityItems(page).first()).toHaveAttribute("data-read", "false");

    await outra.goto(`/conversas/${canal.id}`);

    await readyHistory(outra, canal.name);
    await expect(activityItems(page).first()).toHaveAttribute("data-read", "true");
    await expect(activityLink(page)).toHaveAccessibleName("Atividade");
    await expect(activityLink(outra)).toHaveAccessibleName("Atividade");
  });

  test("a queda de conexão termina com os números certos", async ({
    page,
    context,
    person,
    otherPerson,
    otherPage,
  }) => {
    const canal = await insertChannel([person, otherPerson], { name: `e2e-a-${crypto.randomUUID()}` });
    const primeiro = await insertChannel([person], { name: `e2e-0-${crypto.randomUUID()}` });
    await logIn(page, person);
    await readyHistory(page, primeiro.name);
    await context.setOffline(true);
    await waitForRealtime(page, "disconnected");

    await sendByApi(otherPage, canal.id, `Durante a queda, @${person.username}`);
    await context.setOffline(false);

    await waitForRealtime(page);
    await expect(activityLink(page)).toHaveAccessibleName(unreadRowName("Atividade", ", 1 não lida"));
  });
});
