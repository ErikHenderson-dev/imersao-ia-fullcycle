// spec: e2e/plano-de-testes-f07.md
// seed: e2e/seed.spec.ts
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "../fixtures";
import { messageItem, readyHistory } from "../support/conversation-page";
import { insertChannel, insertHistory, setLastRead } from "../support/database";

test.describe("Acessibilidade", () => {
  test("a Conversa com o divisor de novas Mensagens não tem violações de acessibilidade", async ({
    loggedInPage: page,
    person,
    otherPerson,
  }) => {
    const canal = await insertChannel([person, otherPerson], { name: `e2e-a-${crypto.randomUUID()}` });
    const historico = await insertHistory(canal, otherPerson, 10);
    await setLastRead(canal, person, historico[6].id);
    await page.goto(`/conversas/${canal.id}`);
    await readyHistory(page, canal.name);
    await expect(messageItem(page, canal.name, "Mensagem 8").locator("[data-unread-divider]")).toBeVisible();

    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
});
