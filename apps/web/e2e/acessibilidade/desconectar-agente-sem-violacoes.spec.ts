// spec: e2e/plano-de-testes-f10.md
// seed: e2e/seed.spec.ts
import AxeBuilder from "@axe-core/playwright";
import { expect, logIn, test } from "../fixtures";
import { setConnected } from "../support/agents";
import { agentsDialog, agentsSection } from "../support/agents-dialog";

test.describe("Acessibilidade", () => {
  test("desconectar-agente-sem-violacoes", async ({ page, person, makeAdmin, agentsLock }) => {
    void agentsLock;
    // 1. A confirmação de desconectar, nos dois temas
    await setConnected("assistente", true);
    try {
      await makeAdmin(person);
      await logIn(page, person);
      await agentsSection(page).getByRole("button", { name: "Gerenciar agentes" }).click();
      await agentsDialog(page).getByRole("button", { name: "Desconectar" }).click();
      await expect(page.getByRole("alertdialog", { name: "Desconectar Assistente?" })).toBeVisible();

      for (const theme of ["light", "dark"]) {
        await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
        // A troca de tema anima as cores (transition-colors): o axe mede o contraste depois.
        await page.waitForFunction(() => document.getAnimations().every((a) => !(a instanceof CSSTransition) || a.playState !== "running"));
        const results = await new AxeBuilder({ page }).include('[role="alertdialog"]').analyze();
        expect(results.violations).toEqual([]);
      }
    } finally {
      await setConnected("assistente", false);
    }
  });
});
