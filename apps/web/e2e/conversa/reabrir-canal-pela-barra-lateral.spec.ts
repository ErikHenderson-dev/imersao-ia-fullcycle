// spec: e2e/plano-de-testes-f02.md
// seed: e2e/seed.spec.ts
import { expect, test } from "../fixtures";
import { messageItem, readyHistory } from "../support/conversation-page";
import { insertChannel, insertMessages, setLastRead } from "../support/database";
import { sidebarLink } from "../support/sidebar";

test.describe("Reabrir um Canal", () => {
  test("reabrir-canal-pela-barra-lateral", async ({ page, person, loggedInPage }) => {
    void loggedInPage;
    const second = await insertChannel([person], { name: `e2e-b-${person.id}` });
    const first = await insertChannel([person], { name: `e2e-a-${person.id}` });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`/conversas/${first.id}`);
    // O primeiro histórico hidratado: trocar de Canal esconde uma página com o cache já montado.
    await readyHistory(page, first.name);

    // Abrir um Canal já aberto antes, pela barra lateral, várias vezes. A cada troca, confere os
    // erros, também os da página que a troca anterior escondeu.
    for (const channel of [second, first, second, first]) {
      await sidebarLink(page, channel.name).click();
      await expect(page).toHaveURL(`/conversas/${channel.id}`);
      await expect(page.getByRole("heading", { level: 1, name: channel.name })).toBeVisible();
      await readyHistory(page, channel.name);
      expect(errors).toEqual([]);
    }
  });

  test("reabrir-canal-comeca-do-servidor", async ({ page, person, loggedInPage }) => {
    void loggedInPage;
    const second = await insertChannel([person], { name: `e2e-b-${person.id}` });
    const first = await insertChannel([person], { name: `e2e-a-${person.id}` });
    const at = Date.now() - 60_000;
    const [toQuote] = await insertMessages(first, [
      { author: person, body: "Uma para citar", at: new Date(at) },
    ]);
    await setLastRead(first, person, toQuote.id);
    await page.goto(`/conversas/${first.id}`);
    await readyHistory(page, first.name);

    // 1. Começar uma Citação e trocar de Canal
    await messageItem(page, first.name, "Uma para citar").getByRole("button", { name: "Responder" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText(`Respondendo a ${person.name}`)).toBeVisible();
    await sidebarLink(page, second.name).click();
    await readyHistory(page, second.name);

    // 2. Uma Mensagem chega ao primeiro Canal enquanto ele está fora da tela, sem evento
    await insertMessages(first, [{ author: person, body: "Chegou enquanto estava fora", at: new Date() }]);

    // 3. Voltar ao primeiro Canal pela barra lateral
    await sidebarLink(page, first.name).click();
    await readyHistory(page, first.name);
    await expect(messageItem(page, first.name, "Chegou enquanto estava fora")).toBeVisible();
    await expect(page.getByText(`Respondendo a ${person.name}`)).toHaveCount(0);
  });
});
