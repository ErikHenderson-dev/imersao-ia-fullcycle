// spec: e2e/plano-de-testes-f08.md
// seed: e2e/seed.spec.ts
import type { Page } from "@playwright/test";
import { expect, logIn, test } from "../fixtures";
import { clickNotification, instrumentNotifications, recordedNotifications } from "../support/browser-notifications";
import { sendByApi } from "../support/chat-api";
import { messageList, readyHistory } from "../support/conversation-page";
import { insertChannel, type TestPerson } from "../support/database";
import { waitForRealtime } from "../support/realtime";
import { controlTabFocus, setTabFocus } from "../support/tab-focus";

function accountMenu(page: Page, person: TestPerson) {
  return page.getByRole("button", { name: `Menu de ${person.name}` });
}

// Pelo teclado: no next dev, o selo de avisos fica sobre o avatar, no canto inferior esquerdo.
async function openMenu(page: Page, person: TestPerson) {
  await accountMenu(page, person).focus();
  await page.keyboard.press("Enter");
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  return menu;
}

// A Pessoa logada num Canal vazio, num contexto com a Notification instrumentada e o foco controlado.
async function setUp(
  browser: import("@playwright/test").Browser,
  baseURL: string | undefined,
  person: TestPerson,
  permission: NotificationPermission,
  answer?: NotificationPermission,
) {
  const context = await browser.newContext({ baseURL });
  await controlTabFocus(context);
  await instrumentNotifications(context, { permission, answer });
  const page = await context.newPage();
  const primeiro = await insertChannel([person], { name: `e2e-0-${crypto.randomUUID()}` });
  await logIn(page, person);
  await readyHistory(page, primeiro.name);
  await waitForRealtime(page);
  return { context, page, primeiro };
}

async function turnOn(page: Page, person: TestPerson) {
  const menu = await openMenu(page, person);
  await menu.getByRole("menuitem", { name: "Ativar notificações do navegador" }).click();
  const again = await openMenu(page, person);
  await expect(again.getByRole("menuitem", { name: "Desativar notificações do navegador" })).toBeVisible();
  await page.keyboard.press("Escape");
}

test.describe("Notificação do navegador", () => {
  test("ativar pede a permissão e liga a opção", async ({ browser, baseURL, person }) => {
    const { context, page } = await setUp(browser, baseURL, person, "default", "granted");

    await turnOn(page, person);

    await page.reload();
    await waitForRealtime(page);
    const menu = await openMenu(page, person);
    await expect(menu.getByRole("menuitem", { name: "Desativar notificações do navegador" })).toBeVisible();
    await context.close();
  });

  test("desativar desliga a opção", async ({ browser, baseURL, person }) => {
    const { context, page } = await setUp(browser, baseURL, person, "granted");
    await turnOn(page, person);

    const menu = await openMenu(page, person);
    await menu.getByRole("menuitem", { name: "Desativar notificações do navegador" }).click();

    const again = await openMenu(page, person);
    await expect(again.getByRole("menuitem", { name: "Ativar notificações do navegador" })).toBeVisible();
    await context.close();
  });

  test("com a permissão negada, a opção fica bloqueada", async ({ browser, baseURL, person }) => {
    const { context, page } = await setUp(browser, baseURL, person, "denied");

    const menu = await openMenu(page, person);

    const item = menu.getByRole("menuitem", { name: /Ativar notificações do navegador/ });
    await expect(item).toContainText("Bloqueadas neste navegador");
    await expect(item).toHaveAttribute("aria-disabled", "true");
    await context.close();
  });

  test("sem aba em foco sai uma notificação só", async ({ browser, baseURL, person, otherPerson, otherPage }) => {
    const canal = await insertChannel([person, otherPerson], { name: `e2e-a-${crypto.randomUUID()}` });
    const { context, page } = await setUp(browser, baseURL, person, "granted");
    await turnOn(page, person);
    const outra = await context.newPage();
    await outra.goto("/atividade");
    await waitForRealtime(outra);
    await setTabFocus(page, false);
    await setTabFocus(outra, false);

    const id = await sendByApi(otherPage, canal.id, `Oi @${person.username}`);

    await expect.poll(async () => (await recordedNotifications(page)).length).toBe(1);
    await expect.poll(async () => (await recordedNotifications(outra)).length).toBe(1);
    const tags = [...(await recordedNotifications(page)), ...(await recordedNotifications(outra))].map((n) => n.tag);
    expect(new Set(tags)).toEqual(new Set([id]));
    expect((await recordedNotifications(page))[0]).toMatchObject({
      title: `${otherPerson.name} mencionou você em #${canal.name}`,
      body: `Oi @${person.username}`,
    });
    await context.close();
  });

  test("com uma aba em foco não sai notificação", async ({ browser, baseURL, person, otherPerson, otherPage }) => {
    const canal = await insertChannel([person, otherPerson], { name: `e2e-a-${crypto.randomUUID()}` });
    const { context, page } = await setUp(browser, baseURL, person, "granted");
    await turnOn(page, person);
    const outra = await context.newPage();
    await outra.goto("/atividade");
    await waitForRealtime(outra);
    await setTabFocus(outra, false);

    await sendByApi(otherPage, canal.id, `Oi @${person.username}`);

    await expect(page.locator("[data-sonner-toast]")).toHaveCount(1);
    await page.waitForTimeout(500);
    expect(await recordedNotifications(page)).toEqual([]);
    expect(await recordedNotifications(outra)).toEqual([]);
    await context.close();
  });

  test("o clique abre a Mensagem", async ({ browser, baseURL, person, otherPerson, otherPage }) => {
    const canal = await insertChannel([person, otherPerson], { name: `e2e-a-${crypto.randomUUID()}` });
    const { context, page } = await setUp(browser, baseURL, person, "granted");
    await turnOn(page, person);
    await setTabFocus(page, false);
    const id = await sendByApi(otherPage, canal.id, `Clica aqui, @${person.username}`);
    await expect.poll(async () => (await recordedNotifications(page)).length).toBe(1);

    await clickNotification(page, id);

    await readyHistory(page, canal.name);
    await expect(messageList(page, canal.name).getByText(`Clica aqui, @${person.username}`)).toBeVisible();
    await context.close();
  });
});
