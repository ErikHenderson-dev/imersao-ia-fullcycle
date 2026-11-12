// spec: e2e/plano-de-testes-f13.md
// seed: e2e/seed.spec.ts
import { expect, logIn, test } from "../fixtures";
import { botQuestion, requestByApi } from "../support/bot";
import { messageItem } from "../support/conversation-page";
import { insertBot } from "../support/database";
import { openSharedChannel } from "../support/realtime";

// O texto e os rótulos que a ferramenta perguntar_periodo grava (app/business/period_question.py).
const QUESTION = "De que período?";
const LABELS = ["Este mês", "Mês passado", "Este ano"];

test.describe("Pergunta de período", () => {
  test("os botões de período valem só para quem pediu", async ({ page, person, otherPage, sharedChannel }) => {
    // 1. A Ana e o Bruno no Canal; a Ana pede ao bot do teste, que pergunta o período pela rota
    const bot = await insertBot("Analista");
    await logIn(page, person);
    await openSharedChannel(page, otherPage, sharedChannel, person, { history: 0 });
    const requestId = await requestByApi(page, sharedChannel.id, bot.username);
    await botQuestion(requestId, QUESTION, LABELS);

    // 2. A Ana vê os botões ativos; o Bruno, desativados, com o motivo no rótulo acessível
    const asked = messageItem(page, sharedChannel.name, QUESTION);
    for (const label of LABELS) {
      await expect(asked.getByRole("button", { name: label, exact: true })).toBeEnabled();
    }
    const seen = messageItem(otherPage, sharedChannel.name, QUESTION);
    for (const label of LABELS) {
      await expect(seen.getByRole("button", { name: `${label}, só quem pediu pode responder` })).toBeDisabled();
    }
  });
});
