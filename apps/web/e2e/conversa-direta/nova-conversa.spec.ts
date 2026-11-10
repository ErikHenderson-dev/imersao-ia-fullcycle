// spec: e2e/plano-de-testes-f05.md
// seed: e2e/seed.spec.ts
import type { Page } from "@playwright/test";
import { expect, test } from "../fixtures";
import { readyConversation } from "../support/conversation-page";
import { insertPerson } from "../support/database";
import { routeServerAction } from "../support/server-action";

function newConversationButton(page: Page) {
  return page
    .getByRole("region", { name: "Mensagens diretas" })
    .getByRole("button", { name: "Nova conversa" });
}

function newConversationDialog(page: Page) {
  return page.getByRole("dialog", { name: "Nova conversa" });
}

test.describe("Nova conversa", () => {
  test("busca pelo @usuário e escolhe pelas setas e Enter", async ({ loggedInPage: page }) => {
    // 1. Abrir "Nova conversa" pelo teclado: o foco vai para a busca
    const regina = await insertPerson("Regina Fonseca", { title: "Engenheira de Software" });
    await newConversationButton(page).focus();
    await page.keyboard.press("Enter");
    const dialog = newConversationDialog(page);
    const search = dialog.getByRole("combobox", { name: "Buscar pessoas" });
    await expect(search).toBeFocused();

    // 2. Buscar pelo @usuário: a linha traz o @usuário e o cargo
    await page.keyboard.type(`@${regina.username}`);
    const option = dialog.getByRole("option", { name: regina.name });
    await expect(option).toContainText(`@${regina.username} · Engenheira de Software`);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowUp");
    await expect(search).toHaveAttribute("aria-activedescendant", (await option.getAttribute("id"))!);

    // 3. Enter abre a Conversa direta
    await page.keyboard.press("Enter");

    await readyConversation(page, regina.name);
    await expect(dialog).toHaveCount(0);
  });

  test("a própria pessoa aparece com (você) e abre a Conversa consigo mesma", async ({
    loggedInPage: page,
    person,
  }) => {
    // 1. Buscar a própria pessoa
    await newConversationButton(page).click();
    const dialog = newConversationDialog(page);
    await dialog.getByRole("combobox", { name: "Buscar pessoas" }).fill(`@${person.username}`);
    const option = dialog.getByRole("option", { name: person.name });
    await expect(option).toContainText("(você)");

    // 2. Escolher
    await option.click();

    await readyConversation(page, person.name);
    await expect(page.getByRole("textbox", { name: "Mensagem para você" })).toBeVisible();
  });

  test("mostra Ninguém encontrado", async ({ loggedInPage: page }) => {
    // 1. Buscar um texto que ninguém tem
    await newConversationButton(page).click();
    const dialog = newConversationDialog(page);
    await dialog.getByRole("combobox", { name: "Buscar pessoas" }).fill("zzzz-ninguem-xyz");

    await expect(dialog.getByRole("heading", { name: "Ninguém encontrado" })).toBeVisible();
    await expect(dialog).toContainText('Nenhuma pessoa corresponde a "zzzz-ninguem-xyz".');
  });

  test("a falha ao abrir mantém o diálogo e tenta de novo", async ({ loggedInPage: page }) => {
    // 1. A primeira abertura falha
    const regina = await insertPerson("Regina Fonseca");
    let failures = 0;
    await routeServerAction(page, (route) => {
      if (failures++ === 0) return route.fulfill({ status: 500, body: "" });
      return route.fallback();
    });
    await newConversationButton(page).click();
    const dialog = newConversationDialog(page);
    await dialog.getByRole("combobox", { name: "Buscar pessoas" }).fill(`@${regina.username}`);
    await dialog.getByRole("option", { name: regina.name }).click();
    await expect(dialog.getByRole("alert")).toHaveText("Não foi possível abrir a conversa. Tente de novo.");

    // 2. Escolher de novo
    await dialog.getByRole("option", { name: regina.name }).click();

    await readyConversation(page, regina.name);
  });

  test("Esc fecha e devolve o foco", async ({ loggedInPage: page }) => {
    // 1. Abrir e fechar pelo Esc
    const button = newConversationButton(page);
    await button.click();
    await expect(newConversationDialog(page)).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(newConversationDialog(page)).toHaveCount(0);
    await expect(button).toBeFocused();
  });
});
