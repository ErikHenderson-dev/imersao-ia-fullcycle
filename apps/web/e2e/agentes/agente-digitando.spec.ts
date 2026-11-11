// spec: e2e/plano-de-testes-f11.md
// seed: e2e/seed.spec.ts
import { expect, logIn, test } from "../fixtures";
import { botReply, botTyping, requestByApi } from "../support/bot";
import { messageItem, typingNotice } from "../support/conversation-page";
import { insertBot } from "../support/database";
import { openSharedChannel } from "../support/realtime";

test.describe("Agente digitando", () => {
  test("o Agente aparece digitando e some sem renovação", async ({ page, person, otherPage, sharedChannel }) => {
    // 1. As duas Pessoas no Canal, e um Pedido da Ana para o bot
    const bot = await insertBot("Assistente");
    await logIn(page, person);
    await openSharedChannel(page, otherPage, sharedChannel, person, { history: 0 });
    const requestId = await requestByApi(page, sharedChannel.id, bot.username);

    // 2. O bot avisa que digita: o Bruno vê o nome do Agente
    await botTyping(requestId);
    const typing = typingNotice(otherPage, "Assistente");
    await expect(typing).toBeVisible();

    // 3. Sem novo aviso, o aviso some depois da expiração do digitando
    await expect(typing).toHaveCount(0, { timeout: 8_000 });
  });

  test("o aviso do Agente some quando a resposta chega", async ({ page, person, otherPage, sharedChannel }) => {
    // 1. As duas Pessoas no Canal, e o bot digitando no Pedido da Ana
    const bot = await insertBot("Assistente");
    await logIn(page, person);
    await openSharedChannel(page, otherPage, sharedChannel, person, { history: 0 });
    const requestId = await requestByApi(page, sharedChannel.id, bot.username);
    await botTyping(requestId);
    const typing = typingNotice(otherPage, "Assistente");
    await expect(typing).toBeVisible();

    // 2. O bot grava a resposta: o aviso some na hora, antes da expiração, e a Mensagem aparece
    await botReply(requestId, "Hoje ninguém escreveu nada.");

    await expect(typing).toHaveCount(0, { timeout: 2_000 });
    await expect(messageItem(otherPage, sharedChannel.name, "Hoje ninguém escreveu nada.")).toBeVisible();
  });
});
