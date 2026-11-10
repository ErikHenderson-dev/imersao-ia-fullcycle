// spec: e2e/plano-de-testes-f06.md
// seed: e2e/seed.spec.ts
import type { Locator, Page } from "@playwright/test";
import { expect, test } from "../fixtures";
import {
  composer,
  messageItem,
  readyHistory,
  routeSendMessage,
} from "../support/conversation-page";
import { insertMessages } from "../support/database";

// A linha da Mensagem pelo id: em edição, o texto vai para a caixa e sai do conteúdo da linha.
async function byId(page: Page, item: Locator): Promise<Locator> {
  const id = await item.getAttribute("data-message-id");
  return page.locator(`[data-message-id="${id}"]`);
}

test.describe("Editar a própria Mensagem", () => {
  test.beforeEach(async ({ page, sharedChannel, person, otherPerson, loggedInPage }) => {
    void loggedInPage;
    const at = Date.now() - 120_000;
    await insertMessages(sharedChannel, [
      { author: person, body: "Primeira minha", at: new Date(at) },
      { author: person, body: "Segunda minha", at: new Date(at + 1_000) },
      { author: otherPerson, body: "Da outra Pessoa", at: new Date(at + 2_000) },
    ]);
    await page.goto(`/conversas/${sharedChannel.id}`);
    await readyHistory(page, sharedChannel.name);
  });

  test("edita pela barra e cancela com Esc", async ({ page, sharedChannel }) => {
    const item = await byId(page, messageItem(page, sharedChannel.name, "Primeira minha"));
    const caixa = page.getByRole("textbox", { name: "Editar mensagem" });

    // 1. "Editar" troca o texto pela caixa, com o foco no fim
    await item.hover();
    await item.getByRole("button", { name: "Editar" }).click();
    await expect(caixa).toBeFocused();
    await expect(caixa).toHaveValue("Primeira minha");
    expect(await caixa.evaluate((el: HTMLTextAreaElement) => el.selectionStart)).toBe(
      "Primeira minha".length,
    );

    // 2. Esc cancela e devolve o foco à Mensagem
    await caixa.fill("Não vai ficar");
    await page.keyboard.press("Escape");
    await expect(caixa).toHaveCount(0);
    await expect(item).toContainText("Primeira minha");
    await expect(item.getByRole("button", { name: "Editar" })).toBeFocused();

    // 3. Shift+Enter quebra a linha e Enter salva, com "(editada)"
    await item.getByRole("button", { name: "Mais ações" }).click();
    await page.getByRole("menuitem", { name: "Editar" }).click();
    await caixa.press("End");
    await caixa.press("Shift+Enter");
    await caixa.pressSequentially("corrigida");
    await caixa.press("Enter");
    await expect(caixa).toHaveCount(0);
    await expect(item).toContainText("Primeira minha\ncorrigida");
    await expect(item).toContainText("(editada)");

    // 4. Editar outra fecha a primeira
    await item.hover();
    await item.getByRole("button", { name: "Editar" }).click();
    const segunda = await byId(page, messageItem(page, sharedChannel.name, "Segunda minha"));
    await segunda.hover();
    await segunda.getByRole("button", { name: "Editar" }).click();
    await expect(caixa).toHaveCount(1);
    await expect(caixa).toHaveValue("Segunda minha");
  });

  test("não salva vazio nem acima do limite", async ({ page, sharedChannel }) => {
    const item = await byId(page, messageItem(page, sharedChannel.name, "Primeira minha"));
    await item.hover();
    await item.getByRole("button", { name: "Editar" }).click();
    const caixa = page.getByRole("textbox", { name: "Editar mensagem" });
    const salvar = item.getByRole("button", { name: "Salvar" });

    await caixa.fill("   ");
    await expect(salvar).toBeDisabled();
    await caixa.press("Enter");
    await expect(caixa).toBeVisible();

    await caixa.fill("a".repeat(4002));
    await expect(item.getByText("2 caracteres acima do limite")).toBeVisible();
    await expect(salvar).toBeDisabled();
    await caixa.press("Enter");
    await expect(caixa).toBeVisible();
  });

  test("mostra a falha e tenta de novo", async ({ page, sharedChannel }) => {
    const item = await byId(page, messageItem(page, sharedChannel.name, "Primeira minha"));
    await item.hover();
    await item.getByRole("button", { name: "Editar" }).click();
    const caixa = page.getByRole("textbox", { name: "Editar mensagem" });

    // 1. Com a rede presa, "Salvando"; depois da falha, o erro com o texto mantido
    let release: () => void = () => {};
    const restore = await routeSendMessage(page, async (route) => {
      await new Promise<void>((resolve) => (release = resolve));
      await route.abort();
    });
    await caixa.fill("Texto que falha");
    await caixa.press("Enter");
    await expect(item.getByRole("button", { name: "Salvar" })).toHaveAttribute("aria-busy", "true");
    release();
    await expect(item.getByRole("alert")).toHaveText("Não foi possível salvar a edição.");
    await expect(caixa).toHaveValue("Texto que falha");

    // 2. Com a rede de volta, "Tentar de novo" salva
    await restore();
    await item.getByRole("button", { name: "Tentar de novo" }).click();
    await expect(caixa).toHaveCount(0);
    await expect(item).toContainText("Texto que falha");
    await expect(item).toContainText("(editada)");
  });

  test("edita só pelo teclado", async ({ page, sharedChannel }) => {
    const item = await byId(page, messageItem(page, sharedChannel.name, "Segunda minha"));
    await composer(page, sharedChannel.name).focus();
    // Da caixa de mensagem, Shift+Tab volta pela Mensagem da outra Pessoa até "Editar" da Segunda.
    const editar = item.getByRole("button", { name: "Editar" });
    for (let i = 0; i < 10 && !(await editar.evaluate((el) => el === document.activeElement)); i++) {
      await page.keyboard.press("Shift+Tab");
    }
    await expect(editar).toBeFocused();
    await page.keyboard.press("Enter");
    const caixa = page.getByRole("textbox", { name: "Editar mensagem" });
    await expect(caixa).toBeFocused();
    await caixa.pressSequentially(" pelo teclado");
    await page.keyboard.press("Enter");
    await expect(item).toContainText("Segunda minha pelo teclado");
    await expect(editar).toBeFocused();
  });

  test("a Mensagem de outra Pessoa não tem Editar", async ({ page, sharedChannel }) => {
    const item = messageItem(page, sharedChannel.name, "Da outra Pessoa");
    await item.hover();
    await expect(item.getByRole("button", { name: "Copiar texto" })).toBeVisible();
    await expect(item.getByRole("button", { name: "Editar" })).toHaveCount(0);
    await item.getByRole("button", { name: "Mais ações" }).click();
    await expect(page.getByRole("menuitem")).toHaveText(["Copiar texto"]);
  });
});
