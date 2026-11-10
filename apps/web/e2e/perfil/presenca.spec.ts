// spec: e2e/plano-de-testes-f09.md
// seed: e2e/seed.spec.ts
import type { Page } from "@playwright/test";
import { expect, logIn, test } from "../fixtures";
import { readyHistory } from "../support/conversation-page";
import { insertDirect, insertHistory } from "../support/database";
import { authorButton, profilePanel } from "../support/profile-panel";
import { waitForRealtime } from "../support/realtime";
import { routeServerAction } from "../support/server-action";

// Abre o menu do avatar pelo teclado (o selo do next dev cobre o avatar num contexto novo).
async function openUserMenu(page: Page, name: string) {
  await page.getByRole("button", { name: `Menu de ${name}` }).focus();
  await page.keyboard.press("Enter");
  return page.getByRole("menu");
}

test.describe("Presença", () => {
  test("define como ausente e disponível pelo menu", async ({ loggedInPage: page, person }) => {
    // 1. O menu mostra Disponível e oferece "Definir como ausente"
    let menu = await openUserMenu(page, person.name);
    await expect(menu.getByText("Disponível", { exact: true })).toBeVisible();
    await menu.getByRole("menuitem", { name: "Definir como ausente" }).press("Enter");

    // 2. Agora Ausente, e o item oferece voltar
    menu = await openUserMenu(page, person.name);
    await expect(menu.getByText("Ausente", { exact: true })).toBeVisible();
    await menu.getByRole("menuitem", { name: "Definir como disponível" }).press("Enter");

    // 3. A escolha vale depois de recarregar
    menu = await openUserMenu(page, person.name);
    await menu.getByRole("menuitem", { name: "Definir como ausente" }).press("Enter");
    await expect(menu).toHaveCount(0);
    await page.reload();
    menu = await openUserMenu(page, person.name);
    await expect(menu.getByText("Ausente", { exact: true })).toBeVisible();
  });

  test("a falha volta à presença anterior", async ({ loggedInPage: page, person }) => {
    await routeServerAction(page, (route) => route.fulfill({ status: 500, body: "" }));

    const menu = await openUserMenu(page, person.name);
    await menu.getByRole("menuitem", { name: "Definir como ausente" }).press("Enter");

    await expect(page.getByText("Não foi possível mudar a presença")).toBeVisible();
    const again = await openUserMenu(page, person.name);
    await expect(again.getByText("Disponível", { exact: true })).toBeVisible();
  });

  test("a outra Pessoa vê a Presença mudar sem recarregar", async ({
    page,
    person,
    otherPerson,
    sharedChannel,
    otherPage,
  }) => {
    // 1. A Ana está conectada; o Bruno abre o perfil dela
    await insertHistory(sharedChannel, person, 1);
    await insertDirect(person, otherPerson);
    await logIn(page, person);
    await otherPage.goto(`/conversas/${sharedChannel.id}`);
    await readyHistory(otherPage, sharedChannel.name);
    await waitForRealtime(otherPage);
    await authorButton(otherPage, person.name).click();
    const panel = profilePanel(otherPage);
    await expect(panel.getByText("Disponível", { exact: true })).toBeVisible();

    // 2. A Ana se define como ausente
    const menu = await openUserMenu(page, person.name);
    await menu.getByRole("menuitem", { name: "Definir como ausente" }).press("Enter");

    // 3. O Bruno vê Ausente no perfil e no cabeçalho da Conversa direta, sem recarregar
    await expect(panel.getByText("Ausente", { exact: true })).toBeVisible();
    await otherPage.getByRole("navigation", { name: "Conversas" }).getByRole("link", { name: person.name }).click();
    await expect(
      otherPage.getByRole("heading", { level: 1 }).getByRole("img", { name: "Ausente" }),
    ).toBeVisible();
  });

  test("fechar todas as abas deixa ausente depois da carência", async ({
    browser,
    baseURL,
    person,
    otherPerson,
    sharedChannel,
    otherPage,
  }) => {
    // A carência real (30 s) mais a queda percebida pelo ping.
    test.setTimeout(90_000);
    await insertHistory(sharedChannel, person, 1);
    const anaContext = await browser.newContext({ baseURL });
    const ana = await anaContext.newPage();
    await logIn(ana, person);
    await otherPage.goto(`/conversas/${sharedChannel.id}`);
    await readyHistory(otherPage, sharedChannel.name);
    await waitForRealtime(otherPage);
    await authorButton(otherPage, person.name).click();
    const panel = profilePanel(otherPage);
    await expect(panel.getByText("Disponível", { exact: true })).toBeVisible();

    await anaContext.close();

    await expect(panel.getByText("Ausente", { exact: true })).toBeVisible({ timeout: 60_000 });
    void otherPerson;
  });
});
