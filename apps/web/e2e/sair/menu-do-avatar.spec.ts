// spec: e2e/plano-de-testes-f01.md
// seed: e2e/seed.spec.ts
import { expect, test } from "../fixtures";

test.describe("Sair", () => {
  test("menu-do-avatar", async ({ loggedInPage: page, person }) => {
    const trigger = page.getByRole("button", { name: `Menu de ${person.name}` });

    // 1. Focar o avatar pelo teclado e apertar Enter
    await trigger.focus();
    await page.keyboard.press("Enter");

    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();
    await expect(menu.getByText(person.name)).toBeVisible();
    // "Perfil" (F05) e "Sair do Full Cycle".
    await expect(menu.getByRole("menuitem")).toHaveCount(2);
    await expect(menu.getByRole("menuitem", { name: "Sair do Full Cycle" })).toBeVisible();

    // 2. Esc fecha o menu e devolve o foco ao avatar
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();

    // 3. Clicar no avatar abre o menu de novo
    await trigger.click();
    await expect(page.getByRole("menuitem", { name: "Sair do Full Cycle" })).toBeVisible();
  });
});
