// spec: e2e/plano-de-testes-f09.md
// seed: e2e/seed.spec.ts
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "../fixtures";

test.describe("Acessibilidade", () => {
  test("presenca-sem-violacoes", async ({ loggedInPage: page, person }) => {
    // 1. O menu do avatar aberto, com a Presença e a escolha, nos dois temas
    await page.getByRole("button", { name: `Menu de ${person.name}` }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menuitem", { name: "Definir como ausente" })).toBeVisible();

    // Só o menu: aberto, o Radix esconde o resto da página com aria-hidden, e o axe acusaria os
    // controles de lá.
    for (const theme of ["light", "dark"]) {
      await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
      const results = await new AxeBuilder({ page }).include('[role="menu"]').analyze();
      expect(results.violations).toEqual([]);
    }
  });
});
