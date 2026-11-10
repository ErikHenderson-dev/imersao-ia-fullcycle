// spec: e2e/plano-de-testes-f06.md
// seed: e2e/seed.spec.ts
import { expect, test } from "../fixtures";
import {
  composer,
  messageItem,
  openDeleteDialog,
  readyHistory,
} from "../support/conversation-page";
import { insertMessages } from "../support/database";

test.describe("Citação em tempo real", () => {
  test("a Citação acompanha a edição e a exclusão da original", async ({
    loggedInPage: page,
    otherPage,
    person,
    otherPerson,
    sharedChannel,
  }) => {
    await insertMessages(sharedChannel, [
      { author: person, body: "A original", at: new Date(Date.now() - 60_000) },
    ]);
    await page.goto(`/conversas/${sharedChannel.id}`);
    await otherPage.goto(`/conversas/${sharedChannel.id}`);
    await readyHistory(page, sharedChannel.name);
    await readyHistory(otherPage, sharedChannel.name);

    // 1. A outra Pessoa responde citando
    const naOutra = messageItem(otherPage, sharedChannel.name, "A original");
    await naOutra.hover();
    await naOutra.getByRole("button", { name: "Responder" }).click();
    const caixa = composer(otherPage, sharedChannel.name);
    await caixa.fill("A resposta");
    await caixa.press("Enter");
    const resposta = messageItem(page, sharedChannel.name, "A resposta");
    await expect(resposta).toContainText("A original");
    void otherPerson;

    // 2. A autora edita a original: a Citação muda na outra Pessoa
    const id = await messageItem(page, sharedChannel.name, "A original").first().getAttribute(
      "data-message-id",
    );
    const original = page.locator(`[data-message-id="${id}"]`);
    await original.hover();
    await original.getByRole("button", { name: "Editar" }).click();
    const edicao = page.getByRole("textbox", { name: "Editar mensagem" });
    await edicao.fill("A original, editada");
    await edicao.press("Enter");
    const respostaNaOutra = messageItem(otherPage, sharedChannel.name, "A resposta");
    await expect(respostaNaOutra).toContainText("A original, editada");

    // 3. A autora apaga a original: a Citação vira a marca de apagada
    const dialogo = await openDeleteDialog(page, original);
    await dialogo.getByRole("button", { name: "Apagar" }).click();
    await expect(respostaNaOutra).toContainText("Em resposta a uma mensagem apagada");
  });
});
