// spec: e2e/plano-de-testes-f09.md
// seed: e2e/seed.spec.ts
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "../fixtures";

test.describe("Acessibilidade", () => {
  test("status-sem-violacoes", async ({ loggedInPage: page, person }) => {
    // 1. O diálogo com um emoji marcado e a mensagem, e depois o próprio perfil com o Status
    await page.getByRole("button", { name: `Menu de ${person.name}` }).focus();
    await page.keyboard.press("Enter");
    await page.getByRole("menuitem", { name: "Editar perfil" }).press("Enter");
    const dialog = page.getByRole("dialog", { name: "Editar perfil" });
    await dialog.getByRole("radio", { name: "Em reunião" }).click();
    await dialog.getByRole("textbox", { name: "Mensagem de status (opcional)" }).fill("Até as 15h");

    for (const theme of ["light", "dark"]) {
      await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    }

    await dialog.getByRole("button", { name: "Salvar" }).click();
    await expect(dialog).toHaveCount(0);
    await page.getByRole("button", { name: `Menu de ${person.name}` }).focus();
    await page.keyboard.press("Enter");
    await page.getByRole("menuitem", { name: "Perfil", exact: true }).press("Enter");
    await expect(page.getByRole("complementary", { name: "Perfil" }).getByText("Até as 15h")).toBeVisible();

    for (const theme of ["light", "dark"]) {
      await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    }
  });
});
