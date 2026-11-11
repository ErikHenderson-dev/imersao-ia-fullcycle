// spec: e2e/plano-de-testes-f11.md
// seed: e2e/seed.spec.ts
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "../fixtures";
import { messageItem, readyHistory } from "../support/conversation-page";
import { insertBot, insertBotMessages } from "../support/database";

test.describe("Acessibilidade", () => {
  test("mensagem-do-agente-sem-violacoes", async ({ loggedInPage: page, memberChannel }) => {
    // 1. Duas Mensagens seguidas do bot: a completa e a compacta
    const bot = await insertBot("Assistente");
    const now = Date.now();
    await insertBotMessages(memberChannel, bot, [
      { body: "Por ora eu só resumo a Conversa.", at: new Date(now - 60_000) },
      { body: "Também consigo resumir a semana.", at: new Date(now - 30_000) },
    ]);
    await page.goto(`/conversas/${memberChannel.id}`);
    await readyHistory(page, memberChannel.name);
    await expect(messageItem(page, memberChannel.name, "Também consigo resumir a semana.")).toHaveAttribute(
      "data-layout",
      "compact",
    );

    // 2. A Conversa com as duas, nos dois temas
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
