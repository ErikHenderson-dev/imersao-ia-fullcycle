// spec: e2e/plano-de-testes-f07.md
// seed: e2e/seed.spec.ts
import { expect, logIn, test } from "../fixtures";
import { readyHistory } from "../support/conversation-page";
import { insertChannel, insertMention, insertMessages } from "../support/database";
import { sidebarLink, unreadRowName } from "../support/sidebar";

test.describe("Ler a Conversa", () => {
  test("abrir o Canal o deixa lido", async ({ page, person, otherPerson }) => {
    const primeiro = await insertChannel([person, otherPerson], { name: `e2e-a-${Date.now()}` });
    const comMencao = await insertChannel([person, otherPerson], { name: `e2e-b-${Date.now()}` });
    const [mencao] = await insertMessages(comMencao, [
      { author: otherPerson, body: `Oi @${person.username}`, at: new Date(Date.now() - 60_000) },
    ]);
    await insertMention(mencao.id, person);
    await logIn(page, person);
    await readyHistory(page, primeiro.name);
    await expect(sidebarLink(page, unreadRowName(comMencao.name, ", não lidas, 1 menção"))).toBeVisible();

    // 1. Abre o Canal com a Menção: a linha aberta em foco não mostra nada de novo
    await sidebarLink(page, unreadRowName(comMencao.name, ", não lidas, 1 menção")).click();
    await readyHistory(page, comMencao.name);
    await expect(sidebarLink(page, comMencao.name)).not.toHaveClass(/font-black/);

    // 2. Volta ao primeiro Canal e recarrega: o Canal com a Menção ficou lido
    await expect
      .poll(async () => {
        await page.goto(`/conversas/${primeiro.id}`);
        await readyHistory(page, primeiro.name);
        return sidebarLink(page, comMencao.name).getAttribute("class");
      })
      .not.toMatch(/font-black/);
    await expect(sidebarLink(page, comMencao.name).getByText("1", { exact: true })).toHaveCount(0);
  });

  test("a aba em segundo plano não marca como lida", async ({ browser, baseURL, person, otherPerson }) => {
    const primeiro = await insertChannel([person, otherPerson], { name: `e2e-a-${Date.now()}` });
    const naoLido = await insertChannel([person, otherPerson], { name: `e2e-b-${Date.now()}` });
    await insertMessages(naoLido, [{ author: otherPerson, body: "Novidade", at: new Date(Date.now() - 60_000) }]);
    const context = await browser.newContext({ baseURL });
    // No Chromium sem interface toda página diz que está visível e em foco: aqui, ela não está.
    await context.addInitScript(() => {
      Object.defineProperty(document, "visibilityState", { get: () => "hidden" });
      Object.defineProperty(document, "hasFocus", { value: () => false });
    });
    const escondida = await context.newPage();
    await logIn(escondida, person);

    // 1. A aba escondida abre o Canal Não lido
    await escondida.goto(`/conversas/${naoLido.id}`);
    await readyHistory(escondida, naoLido.name);
    await escondida.waitForTimeout(1_500);
    await context.close();

    // 2. Numa aba em foco, o Canal continua Não lido
    const emFoco = await browser.newContext({ baseURL });
    const page = await emFoco.newPage();
    await logIn(page, person);
    await readyHistory(page, primeiro.name);
    await expect(sidebarLink(page, unreadRowName(naoLido.name, ", não lidas"))).toHaveClass(/font-black/);
    await emFoco.close();
  });
});
