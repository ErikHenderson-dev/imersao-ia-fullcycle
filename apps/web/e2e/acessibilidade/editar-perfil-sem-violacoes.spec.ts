// spec: e2e/plano-de-testes-f09.md
// seed: e2e/seed.spec.ts
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "../fixtures";

test.describe("Acessibilidade", () => {
  test("editar-perfil-sem-violacoes", async ({ loggedInPage: page, person }) => {
    // 1. Abrir "Editar perfil", com o erro de campo na tela, e analisar nos dois temas
    await page.getByRole("button", { name: `Menu de ${person.name}` }).click();
    await page.getByRole("menuitem", { name: "Editar perfil" }).click();
    const dialog = page.getByRole("dialog", { name: "Editar perfil" });
    await dialog.getByRole("textbox", { name: "Nome completo" }).fill("");
    await dialog.getByRole("button", { name: "Salvar" }).click();
    await expect(dialog.getByText("Informe seu nome completo.")).toBeVisible();

    for (const theme of ["light", "dark"]) {
      await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    }
  });
});
