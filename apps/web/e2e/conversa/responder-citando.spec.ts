// spec: e2e/plano-de-testes-f06.md
// seed: e2e/seed.spec.ts
import { expect, test } from "../fixtures";
import {
  composer,
  messageItem,
  openDeleteDialog,
  readyHistory,
} from "../support/conversation-page";
import { insertMessages, setLastRead, softDeleteMessage } from "../support/database";

test.describe("Responder citando uma Mensagem", () => {
  test.beforeEach(async ({ page, sharedChannel, person, otherPerson, loggedInPage }) => {
    void loggedInPage;
    const at = Date.now() - 120_000;
    const iniciais = await insertMessages(sharedChannel, [
      { author: otherPerson, body: "Alguém viu o aviso de acessibilidade?", at: new Date(at) },
      { author: person, body: "Uma minha para citar", at: new Date(at + 1_000) },
    ]);
    // Tudo lido: abrir com Não lidas mostraria o divisor de novas Mensagens (F07).
    await setLastRead(sharedChannel, person, iniciais.at(-1)!.id);
    await page.goto(`/conversas/${sharedChannel.id}`);
    await readyHistory(page, sharedChannel.name);
  });

  test("responde citando só pelo teclado", async ({ page, sharedChannel, otherPerson }) => {
    const original = messageItem(page, sharedChannel.name, "Alguém viu o aviso");
    const responder = original.getByRole("button", { name: "Responder" });
    await responder.focus();
    await page.keyboard.press("Enter");

    const caixa = composer(page, sharedChannel.name);
    await expect(caixa).toBeFocused();
    await expect(page.getByText(`Respondendo a ${otherPerson.name}`)).toBeVisible();

    await caixa.pressSequentially("Vi sim, já abri uma correção.");
    await page.keyboard.press("Enter");

    const resposta = messageItem(page, sharedChannel.name, "Vi sim, já abri uma correção.");
    await expect(resposta).toContainText(otherPerson.name);
    await expect(resposta).toContainText("Alguém viu o aviso de acessibilidade?");
    await expect(resposta).toHaveAttribute("data-status", "sent");
    await expect(page.getByText(`Respondendo a ${otherPerson.name}`)).toHaveCount(0);
  });

  test("Cancelar resposta e Esc desistem sem apagar o texto", async ({
    page,
    sharedChannel,
    otherPerson,
  }) => {
    const original = messageItem(page, sharedChannel.name, "Alguém viu o aviso");
    const caixa = composer(page, sharedChannel.name);
    const respondendo = page.getByText(`Respondendo a ${otherPerson.name}`);

    await original.hover();
    await original.getByRole("button", { name: "Responder" }).click();
    await caixa.fill("Texto que fica");
    await page.getByRole("button", { name: "Cancelar resposta" }).click();
    await expect(respondendo).toHaveCount(0);
    await expect(caixa).toHaveValue("Texto que fica");

    await original.hover();
    await original.getByRole("button", { name: "Mais ações" }).click();
    await page.getByRole("menuitem", { name: "Responder" }).click();
    await expect(respondendo).toBeVisible();
    await caixa.press("Escape");
    await expect(respondendo).toHaveCount(0);
    await expect(caixa).toHaveValue("Texto que fica");
  });

  test("responder a outra troca a Citação", async ({ page, sharedChannel, person, otherPerson }) => {
    const primeira = messageItem(page, sharedChannel.name, "Alguém viu o aviso");
    const segunda = messageItem(page, sharedChannel.name, "Uma minha para citar");
    await primeira.hover();
    await primeira.getByRole("button", { name: "Responder" }).click();
    await expect(page.getByText(`Respondendo a ${otherPerson.name}`)).toBeVisible();
    await segunda.hover();
    await segunda.getByRole("button", { name: "Responder" }).click();
    await expect(page.getByText(`Respondendo a ${person.name}`)).toBeVisible();
    await expect(page.getByText(`Respondendo a ${otherPerson.name}`)).toHaveCount(0);
  });

  test("a Citação apagada em outra aba sai da caixa, com aviso", async ({
    page,
    sharedChannel,
    person,
  }) => {
    const minha = messageItem(page, sharedChannel.name, "Uma minha para citar");
    await minha.hover();
    await minha.getByRole("button", { name: "Responder" }).click();
    await expect(page.getByText(`Respondendo a ${person.name}`)).toBeVisible();

    const outra = await page.context().newPage();
    await outra.goto(`/conversas/${sharedChannel.id}`);
    await readyHistory(outra, sharedChannel.name);
    const dialogo = await openDeleteDialog(
      outra,
      messageItem(outra, sharedChannel.name, "Uma minha para citar"),
    );
    await dialogo.getByRole("button", { name: "Apagar" }).click();

    await expect(page.getByText(`Respondendo a ${person.name}`)).toHaveCount(0);
    await expect(page.getByText("A mensagem que você estava respondendo foi apagada.")).toBeVisible();
    await outra.close();
  });

  test("a Citação apagada antes do envio vira falha no envio", async ({
    page,
    sharedChannel,
    otherPerson,
  }) => {
    const original = messageItem(page, sharedChannel.name, "Alguém viu o aviso");
    const id = await original.getAttribute("data-message-id");
    await original.hover();
    await original.getByRole("button", { name: "Responder" }).click();
    await softDeleteMessage(id!);

    const caixa = composer(page, sharedChannel.name);
    await caixa.fill("Resposta tardia");
    await caixa.press("Enter");

    const pendente = messageItem(page, sharedChannel.name, "Resposta tardia");
    await expect(pendente).toContainText(otherPerson.name);
    await expect(pendente).toContainText(
      "Não foi possível enviar: a mensagem citada foi apagada.",
    );
  });
});
