// spec: e2e/plano-de-testes-f12.md
// seed: e2e/seed.spec.ts
import { expect, logIn, test } from "../fixtures";
import { botQuestion, requestByApi } from "../support/bot";
import { messageItem } from "../support/conversation-page";
import { insertBot } from "../support/database";
import { openSharedChannel } from "../support/realtime";

test.describe("Pergunta de delegação", () => {
  test("a pergunta com os candidatos vale só para quem pediu", async ({
    page,
    person,
    otherPage,
    sharedChannel,
  }) => {
    // 1. A Ana pede; o bot do teste pergunta para quem é a Tarefa, com um botão por candidato
    await logIn(page, person);
    await openSharedChannel(page, otherPage, sharedChannel, person, { history: 0 });
    const bot = await insertBot();
    const requestId = await requestByApi(page, sharedChannel.id, bot.username);
    await botQuestion(requestId, "Para quem é a Tarefa?", ["Bruno Lima", "Caio Dias"]);

    // 2. Os botões estão ativos para a Ana e desativados para o Bruno
    const forAna = page.getByRole("button", { name: "Bruno Lima", exact: true });
    await expect(forAna).toBeEnabled();
    await expect(otherPage.getByRole("button", { name: /^Bruno Lima/ }).first()).toBeDisabled();

    // 3. O clique da Ana vira a Mensagem dela e desativa os botões para os dois
    await forAna.click();
    await expect(page.getByRole("button", { name: /^Caio Dias/ }).first()).toBeDisabled();
    await expect(otherPage.getByRole("button", { name: /^Caio Dias/ }).first()).toBeDisabled();
    await expect(messageItem(otherPage, sharedChannel.name, "Bruno Lima")).toHaveCount(1);
  });
});
