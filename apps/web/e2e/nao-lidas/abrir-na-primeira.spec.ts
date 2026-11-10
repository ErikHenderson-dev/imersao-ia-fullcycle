// spec: e2e/plano-de-testes-f07.md
// seed: e2e/seed.spec.ts
import { expect, logIn, test } from "../fixtures";
import {
  composer,
  distanceToEnd,
  messageItem,
  messageList,
  readyHistory,
} from "../support/conversation-page";
import { insertChannel, insertHistory, setLastRead } from "../support/database";
import { controlTabFocus, setTabFocus } from "../support/tab-focus";

test.describe("Abrir na primeira Não lida", () => {
  test("vai até a primeira Não lida com mais Não lidas que uma página", async ({
    loggedInPage: page,
    person,
    otherPerson,
  }) => {
    const canal = await insertChannel([person, otherPerson], { name: `e2e-a-${crypto.randomUUID()}` });
    const historico = await insertHistory(canal, otherPerson, 160);
    await setLastRead(canal, person, historico[19].id);

    // As páginas anteriores ficam lentas, para "Indo até a mensagem" ficar à vista.
    await page.route("**/api/conversations/*/messages?*", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 400));
      await route.continue();
    });

    // 1. Abre o Canal: as anteriores carregam até a primeira Não lida
    await page.goto(`/conversas/${canal.id}`);
    await expect(page.getByRole("status").filter({ hasText: "Indo até a mensagem…" })).toBeVisible();
    const divisor = page.locator("[data-unread-divider]");

    // 2. O divisor fica à vista, logo acima da Mensagem 21
    await expect(divisor).toBeInViewport({ timeout: 15_000 });
    await expect(messageItem(page, canal.name, "Mensagem 21").locator("[data-unread-divider]")).toHaveCount(1);
    await expect(page.getByText("Indo até a mensagem…")).toHaveCount(0);
  });

  test("com poucas Não lidas abre no fim, com o divisor", async ({ loggedInPage: page, person, otherPerson }) => {
    const canal = await insertChannel([person, otherPerson], { name: `e2e-a-${crypto.randomUUID()}` });
    const historico = await insertHistory(canal, otherPerson, 30);
    await setLastRead(canal, person, historico[26].id);

    // 1. Abre o Canal
    await page.goto(`/conversas/${canal.id}`);
    const lista = await readyHistory(page, canal.name);

    // 2. O divisor fica acima da Mensagem 28, e a lista está no fim
    await expect(messageItem(page, canal.name, "Mensagem 28").locator("[data-unread-divider]")).toBeVisible();
    expect(await distanceToEnd(lista)).toBeLessThan(10);
  });

  test("ao voltar o foco, o divisor fica acima da primeira Mensagem que chegou sem foco", async ({
    browser,
    baseURL,
    person,
    otherPerson,
    otherPage,
  }) => {
    const canal = await insertChannel([person, otherPerson], { name: `e2e-a-${crypto.randomUUID()}` });
    await insertHistory(canal, otherPerson, 5);
    await setLastRead(canal, person, null);
    const context = await browser.newContext({ baseURL });
    await controlTabFocus(context);
    const page = await context.newPage();
    await logIn(page, person);
    const leitura = page.waitForResponse(
      (response) => response.url().endsWith(`/api/conversations/${canal.id}/read`) && response.ok(),
    );
    await page.goto(`/conversas/${canal.id}`);
    await readyHistory(page, canal.name);
    await otherPage.goto(`/conversas/${canal.id}`);
    await readyHistory(otherPage, canal.name);
    // Abriu com todas Não lidas: o divisor está no começo; depois de ler, a aba perde o foco.
    await expect(messageItem(page, canal.name, "Mensagem 1").locator("[data-unread-divider]")).toBeVisible();
    await leitura;
    await setTabFocus(page, false);

    // 1. Chega uma Mensagem com a aba sem foco
    const caixa = composer(otherPage, canal.name);
    await caixa.fill("Chegou sem foco");
    await caixa.press("Enter");
    await expect(messageItem(page, canal.name, "Chegou sem foco")).toBeVisible();

    // 2. O foco volta: o divisor passa para cima dela
    await setTabFocus(page, true);
    await expect(messageItem(page, canal.name, "Chegou sem foco").locator("[data-unread-divider]")).toBeVisible();
    await expect(messageList(page, canal.name).locator("[data-unread-divider]")).toHaveCount(1);
    await context.close();
  });
});
