// spec: e2e/plano-de-testes-f07.md
// seed: e2e/seed.spec.ts
import { expect, logIn, test } from "../fixtures";
import { composer, messageItem, openDeleteDialog, readyHistory } from "../support/conversation-page";
import { insertChannel, insertMention, insertMessages } from "../support/database";
import { sidebarLink, unreadRowName } from "../support/sidebar";

test.describe("Não lidas em tempo real", () => {
  test("a Menção sobe o contador sem recarregar", async ({ page, person, otherPerson, otherPage }) => {
    // O primeiro da lista, vazio: a Home o abre, e abrir uma Conversa a lê.
    const primeiro = await insertChannel([person], { name: `e2e-0-${crypto.randomUUID()}` });
    const canal = await insertChannel([person, otherPerson], { name: `e2e-a-${crypto.randomUUID()}` });
    await logIn(page, person);
    await readyHistory(page, primeiro.name);
    await otherPage.goto(`/conversas/${canal.id}`);
    await readyHistory(otherPage, canal.name);

    // 1. A outra Pessoa menciona a primeira
    const caixa = composer(otherPage, canal.name);
    await caixa.fill(`Oi @${person.username} olha isso`);
    await caixa.press("Enter");

    // 2. O Canal sobe em negrito com o contador 1, sem recarregar
    const linha = sidebarLink(page, unreadRowName(canal.name, ", não lidas, 1 menção"));
    await expect(linha).toBeVisible();
    await expect(linha.getByText("1", { exact: true })).toBeVisible();
  });

  test("ler numa aba tira o negrito na outra", async ({ page, person, otherPerson }) => {
    const primeiro = await insertChannel([person], { name: `e2e-0-${crypto.randomUUID()}` });
    const canal = await insertChannel([person, otherPerson], { name: `e2e-a-${crypto.randomUUID()}` });
    const [mencao] = await insertMessages(canal, [
      { author: otherPerson, body: `Oi @${person.username}`, at: new Date(Date.now() - 60_000) },
    ]);
    await insertMention(mencao.id, person);
    await logIn(page, person);
    await readyHistory(page, primeiro.name);
    const outraAba = await page.context().newPage();
    await outraAba.goto(`/conversas/${primeiro.id}`);
    await readyHistory(outraAba, primeiro.name);
    await expect(sidebarLink(page, unreadRowName(canal.name, ", não lidas, 1 menção"))).toBeVisible();

    // 1. A outra aba abre o Canal
    await outraAba.goto(`/conversas/${canal.id}`);
    await readyHistory(outraAba, canal.name);

    // 2. Na primeira aba, o Canal fica sem negrito e sem contador, sem recarregar
    await expect(sidebarLink(page, canal.name)).not.toHaveClass(/font-black/);
    await expect(sidebarLink(page, canal.name).getByText("1", { exact: true })).toHaveCount(0);
  });

  test("apagar a Mensagem com a Menção zera o contador", async ({ page, person, otherPerson, otherPage }) => {
    const primeiro = await insertChannel([person], { name: `e2e-0-${crypto.randomUUID()}` });
    const canal = await insertChannel([person, otherPerson], { name: `e2e-a-${crypto.randomUUID()}` });
    await logIn(page, person);
    await readyHistory(page, primeiro.name);
    await otherPage.goto(`/conversas/${canal.id}`);
    await readyHistory(otherPage, canal.name);
    const caixa = composer(otherPage, canal.name);
    await caixa.fill(`Oi @${person.username} vai sair`);
    await caixa.press("Enter");
    await expect(sidebarLink(page, unreadRowName(canal.name, ", não lidas, 1 menção"))).toBeVisible();

    // 1. A outra Pessoa apaga a Mensagem
    const dialogo = await openDeleteDialog(otherPage, messageItem(otherPage, canal.name, "vai sair"));
    await dialogo.getByRole("button", { name: "Apagar" }).click();

    // 2. O Canal deixa de estar Não lido, sem recarregar
    await expect(sidebarLink(page, canal.name)).not.toHaveClass(/font-black/);
    await expect(sidebarLink(page, canal.name).getByText("1", { exact: true })).toHaveCount(0);
  });
});
