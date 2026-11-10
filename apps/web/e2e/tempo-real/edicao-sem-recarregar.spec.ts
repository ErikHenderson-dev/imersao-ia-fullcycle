// spec: e2e/plano-de-testes-f06.md
// seed: e2e/seed.spec.ts
import { expect, test } from "../fixtures";
import { messageItem, readyHistory } from "../support/conversation-page";
import { insertMessages } from "../support/database";

test.describe("Edição em tempo real", () => {
  test("a edição aparece para a outra Pessoa sem recarregar", async ({
    loggedInPage: page,
    otherPage,
    person,
    sharedChannel,
  }) => {
    await insertMessages(sharedChannel, [
      { author: person, body: "Antes da edição", at: new Date(Date.now() - 60_000) },
    ]);
    await page.goto(`/conversas/${sharedChannel.id}`);
    await otherPage.goto(`/conversas/${sharedChannel.id}`);
    await readyHistory(page, sharedChannel.name);
    await readyHistory(otherPage, sharedChannel.name);

    // 1. A autora edita
    const item = messageItem(page, sharedChannel.name, "Antes da edição");
    await item.hover();
    await item.getByRole("button", { name: "Editar" }).click();
    const caixa = page.getByRole("textbox", { name: "Editar mensagem" });
    await caixa.fill("Depois da edição");
    await caixa.press("Enter");

    // 2. A outra Pessoa vê o texto novo e "(editada)", sem recarregar
    const naOutra = messageItem(otherPage, sharedChannel.name, "Depois da edição");
    await expect(naOutra).toBeVisible();
    await expect(naOutra).toContainText("(editada)");
    await expect(messageItem(otherPage, sharedChannel.name, "Antes da edição")).toHaveCount(0);
  });
});
