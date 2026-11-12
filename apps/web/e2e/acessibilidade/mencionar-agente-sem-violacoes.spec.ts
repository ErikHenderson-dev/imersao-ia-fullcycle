// spec: e2e/plano-de-testes-f10.md
// seed: e2e/seed.spec.ts
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "../fixtures";
import { setConnected } from "../support/agents";
import { composer, readyHistory } from "../support/conversation-page";

test.describe("Acessibilidade", () => {
  test("mencionar-agente-sem-violacoes", async ({ loggedInPage: page, memberChannel, agentsLock }) => {
    void agentsLock;
    // 1. O autocompletar com o Agente conectado, nos dois temas
    await setConnected("assistente", true);
    try {
      await page.goto(`/conversas/${memberChannel.id}`);
      await readyHistory(page, memberChannel.name);
      await composer(page, memberChannel.name).fill("@ass");
      const list = page.getByRole("listbox");
      await expect(list.getByRole("option", { name: /@assistente · Agente/ })).toBeVisible();

      for (const theme of ["light", "dark"]) {
        await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
        // A troca de tema anima as cores (transition-colors): o axe mede o contraste depois.
        await page.waitForFunction(() =>
          document.getAnimations().every((a) => !(a instanceof CSSTransition) || a.playState !== "running"),
        );
        const results = await new AxeBuilder({ page }).include('[role="listbox"]').analyze();
        expect(results.violations).toEqual([]);
      }
    } finally {
      await setConnected("assistente", false);
    }
  });
});
