// spec: e2e/plano-de-testes-f06.md
// seed: e2e/seed.spec.ts
import type { Locator, Page } from "@playwright/test";
import { expect, test } from "../fixtures";
import {
  composer,
  messageItem,
  openDeleteDialog as openDelete,
  readyHistory,
  routeSendMessage,
} from "../support/conversation-page";
import { insertMessages } from "../support/database";

// A linha da Mensagem pelo id, que continua valendo enquanto ela está em edição.
async function byId(page: Page, item: Locator): Promise<Locator> {
  const id = await item.getAttribute("data-message-id");
  return page.locator(`[data-message-id="${id}"]`);
}

test.describe("Apagar a própria Mensagem", () => {
  test.beforeEach(async ({ page, sharedChannel, person, otherPerson, loggedInPage }) => {
    void loggedInPage;
    const at = Date.now() - 120_000;
    await insertMessages(sharedChannel, [
      { author: person, body: "Primeira minha", at: new Date(at) },
      { author: otherPerson, body: "Da outra Pessoa", at: new Date(at + 1_000) },
      { author: person, body: "Última minha", at: new Date(at + 2_000) },
    ]);
    await page.goto(`/conversas/${sharedChannel.id}`);
    await readyHistory(page, sharedChannel.name);
  });

  test("abre a confirmação com o foco em Cancelar e cancela", async ({ page, sharedChannel }) => {
    const item = await byId(page, messageItem(page, sharedChannel.name, "Primeira minha"));
    const dialogo = await openDelete(page, item);

    await expect(dialogo).toContainText("Ela some da conversa para todo mundo. Não dá para desfazer.");
    await expect(dialogo).toContainText("Primeira minha");
    await expect(dialogo.getByRole("button", { name: "Cancelar" })).toBeFocused();

    // O clique fora não fecha; o Esc fecha, e a Mensagem continua
    await page.mouse.click(5, 5);
    await expect(dialogo).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialogo).toHaveCount(0);
    await expect(item).toBeVisible();
  });

  test("apaga e o foco vai para a seguinte", async ({ page, sharedChannel, otherPerson }) => {
    const item = messageItem(page, sharedChannel.name, "Primeira minha");
    const dialogo = await openDelete(page, item);

    await dialogo.getByRole("button", { name: "Apagar" }).click();

    await expect(dialogo).toHaveCount(0);
    await expect(messageItem(page, sharedChannel.name, "Primeira minha")).toHaveCount(0);
    const seguinte = messageItem(page, sharedChannel.name, "Da outra Pessoa");
    await expect(seguinte.getByRole("button", { name: otherPerson.name })).toBeFocused();
  });

  test("apagar a última leva o foco à caixa de mensagem", async ({ page, sharedChannel }) => {
    const dialogo = await openDelete(page, messageItem(page, sharedChannel.name, "Última minha"));

    await dialogo.getByRole("button", { name: "Apagar" }).click();

    await expect(messageItem(page, sharedChannel.name, "Última minha")).toHaveCount(0);
    await expect(composer(page, sharedChannel.name)).toBeFocused();
  });

  test("mostra a falha e tenta de novo", async ({ page, sharedChannel }) => {
    // Pelo id: com o diálogo aberto, o resto da página fica escondido dos papéis (aria-hidden).
    const item = await byId(page, messageItem(page, sharedChannel.name, "Primeira minha"));
    const dialogo = await openDelete(page, item);

    // 1. Com a rede presa, "Apagando"; abortada, o erro, e a Mensagem continua
    const restore = await routeSendMessage(page, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      await route.abort();
    });
    await dialogo.getByRole("button", { name: "Apagar" }).click();
    await expect(dialogo.getByRole("button", { name: "Apagar" })).toHaveAttribute("aria-busy", "true");
    await expect(dialogo.getByRole("alert")).toHaveText("Não foi possível apagar a mensagem.");
    await expect(item).toBeVisible();

    // 2. Com a rede de volta, "Tentar de novo" apaga
    await restore();
    await dialogo.getByRole("button", { name: "Tentar de novo" }).click();
    await expect(dialogo).toHaveCount(0);
    await expect(messageItem(page, sharedChannel.name, "Primeira minha")).toHaveCount(0);
  });

  test("apaga só pelo teclado", async ({ page, sharedChannel }) => {
    const item = messageItem(page, sharedChannel.name, "Última minha");
    const mais = item.getByRole("button", { name: "Mais ações" });
    await mais.focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("End");
    await expect(page.getByRole("menuitem", { name: "Apagar" })).toBeFocused();
    await page.keyboard.press("Enter");
    const dialogo = page.getByRole("alertdialog", { name: "Apagar mensagem?" });
    await expect(dialogo.getByRole("button", { name: "Cancelar" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(dialogo.getByRole("button", { name: "Apagar" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(messageItem(page, sharedChannel.name, "Última minha")).toHaveCount(0);
  });

  test("a Mensagem de outra Pessoa não tem Apagar", async ({ page, sharedChannel }) => {
    const item = messageItem(page, sharedChannel.name, "Da outra Pessoa");
    await item.hover();
    await item.getByRole("button", { name: "Mais ações" }).click();
    await expect(page.getByRole("menuitem")).toHaveText(["Responder", "Copiar texto"]);
  });

  test("a edição aberta fecha quando a Mensagem é apagada em outra aba", async ({
    page,
    sharedChannel,
  }) => {
    const item = await byId(page, messageItem(page, sharedChannel.name, "Primeira minha"));
    await item.hover();
    await item.getByRole("button", { name: "Editar" }).click();
    const caixa = page.getByRole("textbox", { name: "Editar mensagem" });
    await expect(caixa).toBeFocused();

    // Outra aba da mesma Pessoa apaga
    const outra = await page.context().newPage();
    await outra.goto(`/conversas/${sharedChannel.id}`);
    await readyHistory(outra, sharedChannel.name);
    const dialogo = await openDelete(outra, messageItem(outra, sharedChannel.name, "Primeira minha"));
    await dialogo.getByRole("button", { name: "Apagar" }).click();
    await expect(dialogo).toHaveCount(0);

    await expect(caixa).toHaveCount(0);
    await expect(item).toHaveCount(0);
    await expect(page.getByText("Essa mensagem foi apagada.")).toBeVisible();
    await outra.close();
  });
});
