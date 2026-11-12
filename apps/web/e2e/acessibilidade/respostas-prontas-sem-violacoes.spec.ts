// spec: e2e/plano-de-testes-f11.md
// seed: e2e/seed.spec.ts
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "../fixtures";
import { botQuestion, requestByApi } from "../support/bot";
import { messageItem, readyHistory } from "../support/conversation-page";
import { insertBot } from "../support/database";

test.describe("Acessibilidade", () => {
  test("respostas-prontas-sem-violacoes", async ({ loggedInPage: page, memberChannel }) => {
    // 1. A pergunta do Agente com as Respostas prontas ativas para quem pediu
    const bot = await insertBot("Assistente");
    const requestId = await requestByApi(page, memberChannel.id, bot.username);
    await botQuestion(requestId, "De que período você quer o resumo? Você pode responder sem me mencionar.", [
      "Hoje (3)",
      "Desde ontem (5)",
      "A semana (12)",
      "Tudo (24)",
    ]);
    await page.goto(`/conversas/${memberChannel.id}`);
    await readyHistory(page, memberChannel.name);
    const question = messageItem(page, memberChannel.name, "De que período");
    await expect(question.getByRole("button", { name: "Hoje (3)" })).toBeEnabled();

    // 2. A Conversa com a pergunta, nos dois temas
    for (const theme of ["light", "dark"]) {
      await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
      // A troca de tema anima as cores (transition-colors): o axe mede o contraste depois.
      await page.waitForFunction(() =>
        document.getAnimations().every((a) => !(a instanceof CSSTransition) || a.playState !== "running"),
      );
      const results = await new AxeBuilder({ page }).include("main").analyze();
      expect(results.violations).toEqual([]);
    }
  });
});
