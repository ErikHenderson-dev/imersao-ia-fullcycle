// spec: e2e/plano-de-testes-f10.md
// seed: e2e/seed.spec.ts
import AxeBuilder from "@axe-core/playwright";
import { expect, logIn, test } from "../fixtures";
import { agentsDialog, agentsSection } from "../support/agents-dialog";

test.describe("Acessibilidade", () => {
  test("agentes-admin-sem-violacoes", async ({ page, person, makeAdmin }) => {
    // 1. O diálogo "Agentes" do administrador, nos dois temas
    await makeAdmin(person);
    await logIn(page, person);
    await agentsSection(page)
      .getByRole("button", { name: /^(Conectar agentes|Adicionar agente|Gerenciar agentes)/ })
      .click();
    const dialog = agentsDialog(page);
    await expect(dialog.getByRole("button", { name: /^(Conectar|Desconectar)$/ })).toBeVisible();

    for (const theme of ["light", "dark"]) {
      await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
      const results = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
      expect(results.violations).toEqual([]);
    }
  });
});
