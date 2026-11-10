// spec: e2e/plano-de-testes-f08.md
// seed: e2e/seed.spec.ts
import AxeBuilder from "@axe-core/playwright";
import { expect, logIn, test } from "../fixtures";
import { sendByApi } from "../support/chat-api";
import { readyHistory } from "../support/conversation-page";
import { insertChannel } from "../support/database";
import { waitForRealtime } from "../support/realtime";

test.describe("Acessibilidade", () => {
  test("o Alerta na tela não tem violações de acessibilidade", async ({ page, person, otherPerson, otherPage }) => {
    const primeiro = await insertChannel([person], { name: `e2e-0-${crypto.randomUUID()}` });
    const canal = await insertChannel([person, otherPerson], { name: `e2e-a-${crypto.randomUUID()}` });
    await logIn(page, person);
    await readyHistory(page, primeiro.name);
    await waitForRealtime(page);
    await sendByApi(otherPage, canal.id, `Oi @${person.username}`);
    await expect(page.locator("[data-sonner-toast]")).toHaveCount(1);

    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
});
