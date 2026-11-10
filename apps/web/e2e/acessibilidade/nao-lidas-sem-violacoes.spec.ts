// spec: e2e/plano-de-testes-f07.md
// seed: e2e/seed.spec.ts
import AxeBuilder from "@axe-core/playwright";
import { expect, logIn, test } from "../fixtures";
import { insertChannel, insertDirect, insertMention, insertMessages } from "../support/database";
import { readyHistory } from "../support/conversation-page";
import { sidebarLink, unreadRowName } from "../support/sidebar";

test.describe("Acessibilidade", () => {
  test("a barra lateral com Não lidas não tem violações de acessibilidade", async ({
    page,
    person,
    otherPerson,
  }) => {
    const canal = await insertChannel([person, otherPerson]);
    const direta = await insertDirect(person, otherPerson);
    const at = new Date(Date.now() - 60_000);
    const [mencao] = await insertMessages(canal, [
      { author: otherPerson, body: `Oi @${person.username}`, at },
    ]);
    await insertMention(mencao.id, person);
    await insertMessages(direta, [{ author: otherPerson, body: "Oi", at }]);
    await logIn(page, person);
    // A Home leva ao Canal, a primeira Conversa da lista.
    await readyHistory(page, canal.name);
    await expect(sidebarLink(page, unreadRowName(otherPerson.name, ", 1 mensagem não lida"))).toBeVisible();

    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
});
