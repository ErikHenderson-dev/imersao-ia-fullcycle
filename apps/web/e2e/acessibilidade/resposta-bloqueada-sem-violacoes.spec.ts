// spec: e2e/plano-de-testes-f13.md
// seed: e2e/seed.spec.ts
import AxeBuilder from "@axe-core/playwright";
import { expect, logIn, test } from "../fixtures";
import { botReply, requestByApi } from "../support/bot";
import { messageItem, readyHistory } from "../support/conversation-page";
import { insertBot } from "../support/database";

const NOTICE = "Resposta com dados de negócio. Você não tem permissão para vê-la.";

test.describe("Acessibilidade", () => {
  test("resposta-bloqueada-sem-violacoes", async ({ page, person, otherPage, sharedChannel }) => {
    // 1. O Bruno pede duas vezes; o bot responde uma sem e uma com a marca. A Ana, sem Permissão de
    //    dados, abre a Conversa
    const bot = await insertBot("Analista");
    await otherPage.goto(`/conversas/${sharedChannel.id}`);
    const first = await requestByApi(otherPage, sharedChannel.id, bot.username);
    await botReply(first, "Resumo de hoje: nada novo.");
    const second = await requestByApi(otherPage, sharedChannel.id, bot.username);
    await botReply(second, "Faturamento de março de 2026: R$ 1.234.567,89.", { businessData: true });
    await logIn(page, person);
    await page.goto(`/conversas/${sharedChannel.id}`);
    await readyHistory(page, sharedChannel.name);
    await expect(messageItem(page, sharedChannel.name, "Resumo de hoje: nada novo.")).toBeVisible();
    await expect(messageItem(page, sharedChannel.name, NOTICE)).toBeVisible();

    // 2. A Conversa com a resposta completa e a bloqueada, nos dois temas
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
