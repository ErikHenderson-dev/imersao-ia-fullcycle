// spec: e2e/plano-de-testes-f06.md
// seed: e2e/seed.spec.ts
import { expect, test } from "../fixtures";
import {
  composer,
  messageItem,
  readyHistory,
  routeSendMessage,
} from "../support/conversation-page";
import { insertMessages } from "../support/database";

const TEXTO = "Primeira linha\ncom link https://example.com/a";

test.describe("Barra de ações e copiar o texto", () => {
  test.beforeEach(async ({ page, memberChannel, person, loggedInPage }) => {
    void loggedInPage;
    await insertMessages(memberChannel, [
      { author: person, body: TEXTO, at: new Date(Date.now() - 60_000) },
    ]);
    await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto(`/conversas/${memberChannel.id}`);
    await readyHistory(page, memberChannel.name);
  });

  test("mostra a barra no hover e no foco", async ({ page, memberChannel }) => {
    const item = messageItem(page, memberChannel.name, "Primeira linha");
    const copiar = item.getByRole("button", { name: "Copiar texto" });
    // A barra fica escondida sem sair da ordem do teclado (opacidade zero).
    const barra = item.locator("[data-message-actions]");
    await expect(barra).toHaveCSS("opacity", "0");

    // 1. O mouse sobre a Mensagem mostra a barra
    await item.hover();
    await expect(barra).toHaveCSS("opacity", "1");
    await expect(item.getByRole("button", { name: "Mais ações" })).toBeVisible();

    // 2. "Mais ações" abre o menu com "Copiar texto"
    await item.getByRole("button", { name: "Mais ações" }).click();
    const menu = page.getByRole("menu", { name: "Mais ações" });
    // A Mensagem é da própria Pessoa: o menu tem também "Editar" (F06-T03) e "Apagar" (F06-T04).
    await expect(menu.getByRole("menuitem")).toHaveText(["Copiar texto", "Editar", "Apagar"]);
    await page.keyboard.press("Escape");

    // 3. Fora do hover e sem foco, a barra some; o foco a mostra de novo
    await page.mouse.move(0, 0);
    // O Esc devolveu o foco a "Mais ações"; tirá-lo dali esconde a barra.
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    await expect(barra).toHaveCSS("opacity", "0");
    await copiar.focus();
    await expect(barra).toHaveCSS("opacity", "1");
  });

  test("mostra a dica dos botões da barra", async ({ page, memberChannel }) => {
    const item = messageItem(page, memberChannel.name, "Primeira linha");
    await item.hover();
    await item.getByRole("button", { name: "Copiar texto" }).hover();
    await expect(page.getByRole("tooltip")).toHaveText("Copiar texto");
  });

  test("copia o texto de uma Mensagem pela barra e pelo menu", async ({ page, memberChannel }) => {
    const item = messageItem(page, memberChannel.name, "Primeira linha");
    const lerAreaDeTransferencia = () => page.evaluate(() => navigator.clipboard.readText());

    // 1. Pela barra: o texto gravado, sem autor nem hora, e o aviso
    await item.hover();
    await item.getByRole("button", { name: "Copiar texto" }).click();
    const aviso = page.getByText("Texto copiado");
    await expect(aviso).toBeVisible();
    expect(await lerAreaDeTransferencia()).toBe(TEXTO);

    // 2. O aviso tem o botão de fechar
    await page.getByRole("button", { name: /fechar|close/i }).click();
    await expect(aviso).toHaveCount(0);

    // 3. Pelo menu, depois de limpar a área de transferência
    await page.evaluate(() => navigator.clipboard.writeText(""));
    await item.hover();
    await item.getByRole("button", { name: "Mais ações" }).click();
    await page.getByRole("menuitem", { name: "Copiar texto" }).click();
    await expect(aviso).toBeVisible();
    await expect.poll(lerAreaDeTransferencia).toBe(TEXTO);
  });

  test("mostra o erro quando o navegador recusa a cópia", async ({ page, memberChannel }) => {
    await page.evaluate(() => {
      navigator.clipboard.writeText = () => Promise.reject(new Error("recusada"));
    });
    const item = messageItem(page, memberChannel.name, "Primeira linha");
    await item.hover();
    await item.getByRole("button", { name: "Copiar texto" }).click();
    await expect(page.getByText("Não foi possível copiar o texto")).toBeVisible();
    await expect(page.getByText("Texto copiado")).toHaveCount(0);
  });

  test("usa a barra e o menu só pelo teclado", async ({ page, memberChannel }) => {
    const item = messageItem(page, memberChannel.name, "Primeira linha");
    // 1. Do último controle do texto (o link), o Tab chega a "Copiar texto" e a "Mais ações"
    await item.getByRole("link").focus();
    await page.keyboard.press("Tab");
    await expect(item.getByRole("button", { name: "Copiar texto" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(item.getByRole("button", { name: "Editar" })).toBeFocused();
    await page.keyboard.press("Tab");
    const mais = item.getByRole("button", { name: "Mais ações" });
    await expect(mais).toBeFocused();

    // 2. Enter abre o menu, as setas mudam o item, Esc fecha e devolve o foco
    await page.keyboard.press("Enter");
    const opcao = page.getByRole("menuitem", { name: "Copiar texto" });
    await expect(opcao).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("menuitem", { name: "Editar" })).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(opcao).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(mais).toBeFocused();

    // 3. Espaço também abre, e Enter no item copia
    await page.keyboard.press(" ");
    await page.keyboard.press("Enter");
    await expect(page.getByText("Texto copiado")).toBeVisible();
  });

  test("a Mensagem com falha no envio não tem barra", async ({ page, memberChannel }) => {
    const restore = await routeSendMessage(page, (route) => route.abort());
    const caixa = composer(page, memberChannel.name);
    await caixa.fill("Vai falhar");
    await caixa.press("Enter");
    const item = messageItem(page, memberChannel.name, "Vai falhar");
    await expect(item).toContainText("Não foi possível enviar.");
    await item.hover();
    await expect(item.getByRole("button", { name: "Copiar texto" })).toHaveCount(0);
    await expect(item.getByRole("button", { name: "Mais ações" })).toHaveCount(0);
    await restore();
  });
});
