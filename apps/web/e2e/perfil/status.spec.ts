// spec: e2e/plano-de-testes-f09.md
// seed: e2e/seed.spec.ts
import type { Page } from "@playwright/test";
import { expect, logIn, test } from "../fixtures";
import { readyHistory } from "../support/conversation-page";
import { insertDirect, insertHistory } from "../support/database";
import { authorButton, profilePanel } from "../support/profile-panel";
import { waitForRealtime } from "../support/realtime";
import { sidebarLink } from "../support/sidebar";

// Abre "Editar perfil" pelo menu do avatar, pelo teclado (o selo do next dev cobre o avatar).
async function openEditProfile(page: Page, name: string) {
  await page.getByRole("button", { name: `Menu de ${name}` }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("menuitem", { name: "Editar perfil" }).press("Enter");
  return page.getByRole("dialog", { name: "Editar perfil" });
}

async function setStatus(page: Page, name: string, emoji: string, text: string) {
  const dialog = await openEditProfile(page, name);
  await dialog.getByRole("radio", { name: emoji }).click();
  await dialog.getByRole("textbox", { name: "Mensagem de status (opcional)" }).fill(text);
  await dialog.getByRole("button", { name: "Salvar" }).click();
  await expect(dialog).toHaveCount(0);
}

test.describe("Status", () => {
  test("escolhe e limpa o Status pelo teclado", async ({ loggedInPage: page, person }) => {
    // 1. As setas mudam o emoji marcado
    const dialog = await openEditProfile(page, person.name);
    const group = dialog.getByRole("radiogroup", { name: "Status (opcional)" });
    await group.getByRole("radio", { name: "Conversando" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(group.getByRole("radio", { name: "Focado" })).toBeFocused();
    await expect(group.getByRole("radio", { name: "Focado" })).toBeChecked();

    // 2. A mensagem acima do limite mostra o erro embaixo dela
    const message = dialog.getByRole("textbox", { name: "Mensagem de status (opcional)" });
    await message.fill("s".repeat(101));
    await dialog.getByRole("button", { name: "Salvar" }).click();
    await expect(
      dialog.getByText("A mensagem de status pode ter no máximo 100 caracteres."),
    ).toBeVisible();
    await expect(message).toBeFocused();

    // 3. Salva com o emoji e a mensagem
    await message.fill("Focado, respondo em breve");
    await page.keyboard.press("Enter");
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("button", { name: `Menu de ${person.name}` })).toBeVisible();

    // 4. Espaço no marcado o desmarca, e salvar com a mensagem vazia limpa o Status
    const again = await openEditProfile(page, person.name);
    const checked = again.getByRole("radio", { name: "Focado" });
    await expect(checked).toBeChecked();
    await checked.focus();
    await page.keyboard.press("Space");
    await expect(again.getByRole("radio", { checked: true })).toHaveCount(0);
    await again.getByRole("textbox", { name: "Mensagem de status (opcional)" }).fill("");
    await again.getByRole("button", { name: "Salvar" }).click();
    await expect(again).toHaveCount(0);

    await page.getByRole("button", { name: `Menu de ${person.name}` }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menu").getByRole("img", { name: /^Status/ })).toHaveCount(0);
  });

  test("o Status chega sem recarregar, aparece onde o nome aparece e sai ao limpar", async ({
    page,
    person,
    otherPerson,
    sharedChannel,
    otherPage,
  }) => {
    // 1. O Bruno vê a Ana numa Mensagem, na barra lateral e no perfil
    await insertHistory(sharedChannel, person, 1);
    await insertDirect(person, otherPerson);
    await otherPage.goto(`/conversas/${sharedChannel.id}`);
    await readyHistory(otherPage, sharedChannel.name);
    await waitForRealtime(otherPage);
    await authorButton(otherPage, person.name).click();

    // 2. A Ana define o Status
    await logIn(page, person);
    await setStatus(page, person.name, "De férias", "De férias até sexta");

    // 3. O Bruno vê o emoji ao lado do nome, com a mensagem, sem recarregar
    const status = /^Status: De férias, De férias até sexta$/;
    const main = otherPage.getByRole("main");
    await expect(main.getByRole("img", { name: status }).first()).toBeVisible();
    await expect(
      otherPage.getByRole("navigation", { name: "Conversas" }).getByRole("img", { name: status }),
    ).toBeVisible();
    await expect(profilePanel(otherPage).getByText("De férias até sexta")).toBeVisible();
    await main.getByRole("img", { name: status }).first().hover();
    await expect(otherPage.getByRole("tooltip")).toHaveText("De férias até sexta");

    // 4. Nos Membros e no cabeçalho da Conversa direta
    await otherPage.getByRole("button", { name: "Membros: 2" }).click();
    const members = otherPage.getByRole("dialog", { name: `Membros de #${sharedChannel.name}` });
    await expect(members.getByRole("img", { name: status })).toBeVisible();
    await otherPage.keyboard.press("Escape");
    await sidebarLink(otherPage, new RegExp(person.name)).click();
    await expect(
      otherPage.getByRole("heading", { level: 1 }).getByRole("img", { name: status }),
    ).toBeVisible();

    // 5. A Ana limpa o Status, e o emoji some
    const dialog = await openEditProfile(page, person.name);
    await dialog.getByRole("radio", { name: "De férias" }).click();
    await dialog.getByRole("textbox", { name: "Mensagem de status (opcional)" }).fill("");
    await dialog.getByRole("button", { name: "Salvar" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(otherPage.getByRole("img", { name: status })).toHaveCount(0);
  });
});
