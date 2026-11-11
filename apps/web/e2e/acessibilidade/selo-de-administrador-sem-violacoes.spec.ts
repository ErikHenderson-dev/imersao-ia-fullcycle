// spec: e2e/plano-de-testes-f10.md
// seed: e2e/seed.spec.ts
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "../fixtures";
import { setAdminOf } from "../support/database";
import { profilePanel } from "../support/profile-panel";

test.describe("Acessibilidade", () => {
  test("selo-de-administrador-sem-violacoes", async ({ loggedInPage: page, person }) => {
    // 1. O próprio Perfil de uma administradora, com o selo, nos dois temas
    await setAdminOf(person.id, true);
    await page.getByRole("button", { name: `Menu de ${person.name}` }).focus();
    await page.keyboard.press("Enter");
    await page.getByRole("menuitem", { name: "Perfil", exact: true }).press("Enter");
    const panel = profilePanel(page);
    await expect(panel.getByText("Administrador", { exact: true })).toBeVisible();

    for (const theme of ["light", "dark"]) {
      await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    }
  });
});
