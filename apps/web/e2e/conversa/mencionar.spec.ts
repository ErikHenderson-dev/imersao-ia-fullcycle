// spec: e2e/plano-de-testes-f06.md
// seed: e2e/seed.spec.ts
import type { Locator, Page } from "@playwright/test";
import { expect, test } from "../fixtures";
import { composer, messageItem, readyHistory } from "../support/conversation-page";
import { insertMessages } from "../support/database";

function mentionList(page: Page): Locator {
  return page.getByRole("listbox", { name: "Pessoas para mencionar" });
}

test.describe("Mencionar um Membro", () => {
  test.beforeEach(async ({ page, sharedChannel, loggedInPage }) => {
    void loggedInPage;
    await page.goto(`/conversas/${sharedChannel.id}`);
    await readyHistory(page, sharedChannel.name);
  });

  test("menciona pela lista só pelo teclado", async ({ page, sharedChannel, otherPerson }) => {
    const caixa = composer(page, sharedChannel.name);
    await caixa.focus();

    // 1. "@" e o começo do nome abrem a lista com a outra Pessoa
    await caixa.pressSequentially("Oi @bru");
    const lista = mentionList(page);
    await expect(lista.getByRole("option", { name: new RegExp(otherPerson.name) })).toBeVisible();
    await expect(lista.getByRole("option").first()).toHaveAttribute("aria-selected", "true");

    // 2. Enter escolhe, sem enviar, e põe o @usuário com um espaço
    await page.keyboard.press("Enter");
    await expect(lista).toHaveCount(0);
    await expect(caixa).toHaveValue(`Oi @${otherPerson.username} `);

    // 3. Enviar mostra a Menção no texto
    await caixa.pressSequentially("tudo bem?");
    await page.keyboard.press("Enter");
    const item = messageItem(page, sharedChannel.name, "tudo bem?");
    await expect(item.getByRole("button", { name: `@${otherPerson.username}` })).toBeVisible();
  });

  test("Tab escolhe e as setas mudam a Pessoa destacada", async ({
    page,
    sharedChannel,
    person,
    otherPerson,
  }) => {
    const caixa = composer(page, sharedChannel.name);
    await caixa.fill("");
    await caixa.pressSequentially("@");
    const lista = mentionList(page);
    // Os dois Membros, em ordem alfabética: Ana Souza (a própria pessoa) e Bruno Lima.
    await expect(lista.getByRole("option")).toHaveCount(2);
    await page.keyboard.press("ArrowDown");
    await expect(lista.getByRole("option").nth(1)).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Tab");
    await expect(caixa).toHaveValue(`@${otherPerson.username} `);
    void person;
  });

  test("o botão @ abre a lista", async ({ page, sharedChannel }) => {
    const caixa = composer(page, sharedChannel.name);
    await caixa.fill("Oi");
    await page.getByRole("button", { name: "Mencionar alguém" }).click();
    await expect(caixa).toHaveValue("Oi @");
    await expect(caixa).toBeFocused();
    await expect(mentionList(page)).toBeVisible();
  });

  test("Esc fecha a lista sem mudar o texto, e sem resultado ela fecha", async ({
    page,
    sharedChannel,
  }) => {
    const caixa = composer(page, sharedChannel.name);
    await caixa.pressSequentially("Oi @");
    await expect(mentionList(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(mentionList(page)).toHaveCount(0);
    await expect(caixa).toHaveValue("Oi @");

    // Apagar o @ e digitar de novo abre a lista outra vez
    await caixa.press("Backspace");
    await caixa.pressSequentially("@");
    await expect(mentionList(page)).toBeVisible();

    await caixa.pressSequentially("ninguemmesmo");
    await expect(mentionList(page)).toHaveCount(0);
  });

  test("menciona na edição", async ({ page, sharedChannel, person, otherPerson }) => {
    await insertMessages(sharedChannel, [
      { author: person, body: "Texto para editar", at: new Date(Date.now() - 60_000) },
    ]);
    await page.reload();
    await readyHistory(page, sharedChannel.name);
    const id = await messageItem(page, sharedChannel.name, "Texto para editar").getAttribute(
      "data-message-id",
    );
    const item = page.locator(`[data-message-id="${id}"]`);
    await item.hover();
    await item.getByRole("button", { name: "Editar" }).click();
    const caixa = page.getByRole("textbox", { name: "Editar mensagem" });
    await caixa.press("End");
    await caixa.pressSequentially(" @bru");
    await expect(mentionList(page)).toBeVisible();
    await page.keyboard.press("Enter");
    await expect(caixa).toHaveValue(`Texto para editar @${otherPerson.username} `);
    await page.keyboard.press("Enter");
    await expect(item.getByRole("button", { name: `@${otherPerson.username}` })).toBeVisible();
  });
});
