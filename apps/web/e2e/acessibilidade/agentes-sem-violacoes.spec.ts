// spec: e2e/plano-de-testes-f10.md
// seed: e2e/seed.spec.ts
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "../fixtures";
import { agentsDialog, agentsSection } from "../support/agents-dialog";

test.describe("Acessibilidade", () => {
  test("agentes-sem-violacoes", async ({ loggedInPage: page, otherPerson, makeAdmin }) => {
    // 1. O diálogo "Agentes" de quem não administra, com um administrador, nos dois temas
    await makeAdmin(otherPerson);
    await agentsSection(page).getByRole("button", { name: "Ver agentes" }).click();
    const dialog = agentsDialog(page);
    await expect(dialog.getByRole("list", { name: "Administradores" })).toBeVisible();

    // Só o diálogo: aberto, o Radix esconde o resto da página com aria-hidden.
    for (const theme of ["light", "dark"]) {
      await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
      const results = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
      expect(results.violations).toEqual([]);
    }
  });
});
