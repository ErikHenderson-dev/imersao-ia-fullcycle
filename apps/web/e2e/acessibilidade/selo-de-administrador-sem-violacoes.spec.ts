// spec: e2e/plano-de-testes-f10.md
// seed: e2e/seed.spec.ts
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "../fixtures";
import { profilePanel } from "../support/profile-panel";

test.describe("Acessibilidade", () => {
  test("selo-de-administrador-sem-violacoes", async ({ loggedInPage: page, person, makeAdmin }) => {
    // 1. O próprio Perfil de uma administradora, com o selo, nos dois temas
    await makeAdmin(person);
    await page.getByRole("button", { name: `Menu de ${person.name}` }).focus();
    await page.keyboard.press("Enter");
    await page.getByRole("menuitem", { name: "Perfil", exact: true }).press("Enter");
    const panel = profilePanel(page);
    await expect(panel.getByText("Administrador", { exact: true })).toBeVisible();

    for (const theme of ["light", "dark"]) {
      await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
      // A troca de tema anima as cores (transition-colors): o axe mede o contraste depois.
      await page.waitForFunction(() => document.getAnimations().every((a) => !(a instanceof CSSTransition) || a.playState !== "running"));
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    }
  });
});
