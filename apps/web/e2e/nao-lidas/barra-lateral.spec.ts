// spec: e2e/plano-de-testes-f07.md
// seed: e2e/seed.spec.ts
import { expect, logIn, test } from "../fixtures";
import {
  insertChannel,
  insertDirect,
  insertMention,
  insertMessages,
  type TestChannel,
  type TestPerson,
} from "../support/database";
import { readyHistory } from "../support/conversation-page";
import { sidebarLink, unreadRowName } from "../support/sidebar";


async function messagesFrom(channel: TestChannel, author: TestPerson, bodies: string[]) {
  const start = Date.now() - 60_000;
  return insertMessages(
    channel,
    bodies.map((body, index) => ({ author, body, at: new Date(start + index * 1000) })),
  );
}

test.describe("Não lidas na barra lateral", () => {
  test("mostra a Menção no Canal e as Não lidas na Conversa direta", async ({
    page,
    person,
    otherPerson,
  }) => {
    // O primeiro da lista, sem Mensagens: a Home o abre, e abrir uma Conversa a lê (F07-T02).
    const primeiro = await insertChannel([person], { name: `e2e-0-${Date.now()}` });
    const comMencao = await insertChannel([person, otherPerson], { name: `e2e-a-${Date.now()}` });
    const semMencao = await insertChannel([person, otherPerson], { name: `e2e-b-${Date.now()}` });
    const direta = await insertDirect(person, otherPerson);
    const [mencao] = await messagesFrom(comMencao, otherPerson, [`Oi @${person.username}`, "Mais uma"]);
    await insertMention(mencao.id, person);
    await messagesFrom(semMencao, otherPerson, ["Sem Menção"]);
    await messagesFrom(direta, otherPerson, ["Oi", "Tudo bem?"]);

    // 1. Entra; a Home abre outra Conversa, e a barra lateral já chega com os números
    await logIn(page, person);
    await readyHistory(page, primeiro.name);

    // 2. O Canal com a Menção: negrito e contador 1
    const canal = sidebarLink(page, unreadRowName(comMencao.name, ", não lidas, 1 menção"));
    await expect(canal).toBeVisible();
    await expect(canal).toHaveClass(/font-black/);
    await expect(canal.getByText("1", { exact: true })).toBeVisible();

    // 3. O Canal só com Não lidas: negrito, sem contador
    const soNaoLidas = sidebarLink(page, unreadRowName(semMencao.name, ", não lidas"));
    await expect(soNaoLidas).toHaveClass(/font-black/);
    await expect(soNaoLidas.locator("[aria-hidden]").filter({ hasText: /^\d/ })).toHaveCount(0);

    // 4. A Conversa direta: negrito e o número de Não lidas
    const conversa = sidebarLink(page, unreadRowName(otherPerson.name, ", 2 mensagens não lidas"));
    await expect(conversa).toHaveClass(/font-black/);
    await expect(conversa.getByText("2", { exact: true })).toBeVisible();
  });

  test("a seção recolhida mostra só as Conversas Não lidas", async ({ page, person, otherPerson }) => {
    const primeiro = await insertChannel([person], { name: `e2e-0-${Date.now()}` });
    const naoLido = await insertChannel([person, otherPerson], { name: `e2e-c-${Date.now()}` });
    const lido = await insertChannel([person], { name: `e2e-d-${Date.now()}` });
    await messagesFrom(naoLido, otherPerson, [`Oi @${person.username}`]);
    await logIn(page, person);
    await readyHistory(page, primeiro.name);
    const secao = page.getByRole("region", { name: "Canais" });
    await expect(secao.getByRole("link", { name: lido.name })).toBeVisible();

    // 1. Recolhe a seção "Canais"
    await secao.getByRole("button", { name: "Canais" }).click();

    // 2. Só o Canal com Não lidas continua visível, em negrito
    await expect(secao.getByRole("link", { name: unreadRowName(naoLido.name, ", não lidas") })).toBeVisible();
    await expect(secao.getByRole("link", { name: lido.name, exact: true })).toBeHidden();
  });
});
