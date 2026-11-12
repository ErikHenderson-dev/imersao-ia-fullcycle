// spec: e2e/plano-de-testes-f11.md
// seed: e2e/seed.spec.ts
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "../fixtures";
import { messageItem, readyHistory } from "../support/conversation-page";
import { insertBot, insertMessages } from "../support/database";

test.describe("Acessibilidade", () => {
  test("resumo-do-agente-sem-violacoes", async ({ loggedInPage: page, memberChannel }) => {
    // 1. Um resumo do Agente, com cabeçalho, parágrafo, lista e negrito, e uma recusa logo abaixo
    const bot = await insertBot("Assistente");
    const now = Date.now();
    await insertMessages(memberChannel, [
      {
        author: bot,
        body: [
          "# Resumo de tudo · 500 de 620 Mensagens",
          "O Recorte tem 620 Mensagens; este resumo cobre só as 500 mais recentes.",
          "- **Bruno Lima:** a virada da migração é no sábado às 8h.",
          "- **Carla Dias:** vai avisar o suporte.",
        ].join("\n"),
        at: new Date(now - 60_000),
      },
      {
        author: bot,
        body: "Por enquanto eu só resumo esta Conversa. Peça, por exemplo, o resumo de hoje ou da semana.",
        at: new Date(now - 30_000),
      },
    ]);
    await page.goto(`/conversas/${memberChannel.id}`);
    await readyHistory(page, memberChannel.name);
    await expect(messageItem(page, memberChannel.name, "Bruno Lima:").first()).toBeVisible();

    // 2. A Conversa com o resumo e a recusa, nos dois temas
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
