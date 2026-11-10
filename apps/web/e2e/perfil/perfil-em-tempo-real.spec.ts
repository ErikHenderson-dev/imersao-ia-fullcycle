// spec: e2e/plano-de-testes-f09.md
// seed: e2e/seed.spec.ts
import type { Page } from "@playwright/test";
import { expect, logIn, test } from "../fixtures";
import { readyHistory } from "../support/conversation-page";
import { insertDirect, insertHistory } from "../support/database";
import { authorButton, profilePanel } from "../support/profile-panel";
import { waitForRealtime } from "../support/realtime";
import { sidebarLink } from "../support/sidebar";

// Salva o nome pelo diálogo "Editar perfil", aberto pelo menu do avatar (pelo teclado: o selo do
// next dev cobre o avatar num contexto novo).
async function renameTo(page: Page, currentName: string, name: string): Promise<void> {
  await page.getByRole("button", { name: `Menu de ${currentName}` }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("menuitem", { name: "Editar perfil" }).press("Enter");
  const dialog = page.getByRole("dialog", { name: "Editar perfil" });
  await dialog.getByRole("textbox", { name: "Nome completo" }).fill(name);
  await dialog.getByRole("button", { name: "Salvar" }).click();
  await expect(dialog).toHaveCount(0);
}

test.describe("Perfil em tempo real", () => {
  test("o nome novo aparece sem recarregar", async ({
    page,
    person,
    otherPerson,
    sharedChannel,
    otherPage,
  }) => {
    // 1. O Bruno vê a Ana numa Mensagem antiga, na Conversa direta da barra lateral e no perfil dela
    await insertHistory(sharedChannel, person, 1);
    await insertDirect(person, otherPerson);
    await otherPage.goto(`/conversas/${sharedChannel.id}`);
    await readyHistory(otherPage, sharedChannel.name);
    await waitForRealtime(otherPage);
    await expect(authorButton(otherPage, person.name)).toBeVisible();
    await expect(sidebarLink(otherPage, person.name)).toBeVisible();
    await authorButton(otherPage, person.name).click();
    await expect(profilePanel(otherPage).getByText(person.name, { exact: true })).toBeVisible();

    // 2. A Ana troca o nome
    await logIn(page, person);
    await renameTo(page, person.name, "Ana Lima");

    // 3. O Bruno vê o nome novo em todo lugar, sem recarregar
    await expect(authorButton(otherPage, "Ana Lima")).toBeVisible();
    await expect(sidebarLink(otherPage, "Ana Lima")).toBeVisible();
    await expect(profilePanel(otherPage).getByText("Ana Lima", { exact: true })).toBeVisible();
    await otherPage.getByRole("button", { name: "Membros: 2" }).click();
    const members = otherPage.getByRole("dialog", { name: `Membros de #${sharedChannel.name}` });
    await expect(members).toContainText("Ana Lima");
    await otherPage.keyboard.press("Escape");

    // 4. A Conversa direta mostra o nome novo no cabeçalho
    await sidebarLink(otherPage, "Ana Lima").click();
    await expect(otherPage.getByRole("heading", { level: 1, name: "Ana Lima" })).toBeVisible();
  });

  test("as outras abas de quem editou mudam o Rail e o menu do avatar", async ({
    loggedInPage: page,
    person,
    context,
  }) => {
    // 1. Uma segunda aba da mesma Sessão
    const second = await context.newPage();
    await second.goto("/");
    await expect(second.getByRole("button", { name: `Menu de ${person.name}` })).toBeVisible();
    await waitForRealtime(second);

    // 2. A primeira aba troca o nome
    await renameTo(page, person.name, "Ana Lima");

    // 3. A segunda aba mostra o nome novo, sem recarregar
    await expect(second.getByRole("button", { name: "Menu de Ana Lima" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Menu de Ana Lima" })).toBeVisible();
  });
});
