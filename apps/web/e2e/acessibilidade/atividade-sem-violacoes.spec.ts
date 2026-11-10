// spec: e2e/plano-de-testes-f08.md
// seed: e2e/seed.spec.ts
import AxeBuilder from "@axe-core/playwright";
import { expect, logIn, test } from "../fixtures";
import { insertChannel, insertDirect, insertMention, insertMessages, setLastRead } from "../support/database";
import { readyHistory } from "../support/conversation-page";

test.describe("Acessibilidade", () => {
  test("a tela Atividade com itens lidos e não lidos não tem violações de acessibilidade", async ({
    page,
    person,
    otherPerson,
  }) => {
    const primeiro = await insertChannel([person], { name: `e2e-0-${crypto.randomUUID()}` });
    const canal = await insertChannel([person, otherPerson], { name: `e2e-a-${crypto.randomUUID()}` });
    const direta = await insertDirect(person, otherPerson);
    const at = Date.now() - 60_000;
    const [mencao] = await insertMessages(canal, [{ author: otherPerson, body: `Oi @${person.username}`, at: new Date(at) }]);
    await insertMention(mencao.id, person);
    const [lida] = await insertMessages(direta, [{ author: otherPerson, body: "Já li", at: new Date(at + 1000) }]);
    await setLastRead(direta, person, lida.id);
    await logIn(page, person);
    await readyHistory(page, primeiro.name);
    await page.goto("/atividade");
    const itens = page.getByRole("list", { name: "Notificações" }).getByRole("link");
    await expect(itens).toHaveCount(2);
    // A lida, já na primeira renderização, sem "não lida" no nome
    await expect(itens.nth(0)).toHaveAccessibleName(/^Bruno Lima enviou uma mensagem direta.*Já li$/);

    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
});
