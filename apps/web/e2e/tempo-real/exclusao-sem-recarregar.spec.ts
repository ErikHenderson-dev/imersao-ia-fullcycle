// spec: e2e/plano-de-testes-f06.md
// seed: e2e/seed.spec.ts
import { expect, test } from "../fixtures";
import { messageItem, readyHistory } from "../support/conversation-page";
import { insertMessages } from "../support/database";

test.describe("Exclusão em tempo real", () => {
  test("a Mensagem apagada some para a outra Pessoa sem recarregar", async ({
    loggedInPage: page,
    otherPage,
    person,
    sharedChannel,
  }) => {
    await insertMessages(sharedChannel, [
      { author: person, body: "Vai sumir para todos", at: new Date(Date.now() - 60_000) },
    ]);
    await page.goto(`/conversas/${sharedChannel.id}`);
    await otherPage.goto(`/conversas/${sharedChannel.id}`);
    await readyHistory(page, sharedChannel.name);
    await readyHistory(otherPage, sharedChannel.name);
    await expect(messageItem(otherPage, sharedChannel.name, "Vai sumir para todos")).toBeVisible();

    // 1. A autora apaga
    const item = messageItem(page, sharedChannel.name, "Vai sumir para todos");
    await item.hover();
    await item.getByRole("button", { name: "Mais ações" }).click();
    await page.getByRole("menuitem", { name: "Apagar" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Apagar" }).click();

    // 2. Some para a outra Pessoa, sem recarregar
    await expect(messageItem(otherPage, sharedChannel.name, "Vai sumir para todos")).toHaveCount(0);
  });
});
