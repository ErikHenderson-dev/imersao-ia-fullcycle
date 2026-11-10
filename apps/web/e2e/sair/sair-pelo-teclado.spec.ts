// spec: e2e/plano-de-testes-f01.md
// seed: e2e/seed.spec.ts
import { expect, test } from "../fixtures";
import { countSessionsOf } from "../support/database";
import { SESSION_COOKIE_NAME } from "../support/session-cookie";

test.describe("Sair", () => {
  test("sair-pelo-teclado", async ({ loggedInPage: page, person, context }) => {
    // 1. Do "Início", Tab passa por "Atividade" (F08) e leva ao avatar
    await page.getByRole("link", { name: "Início" }).focus();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: /^Atividade/ })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: `Menu de ${person.name}` })).toBeFocused();

    // 2. Enter abre o menu; End destaca o último item, "Sair do Full Cycle"; Enter sai
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menu")).toBeVisible();
    await page.keyboard.press("End");
    await expect(page.getByRole("menuitem", { name: "Sair do Full Cycle" })).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(page).toHaveURL("/entrar");
    const cookies = await context.cookies();
    expect(cookies.map((cookie) => cookie.name)).not.toContain(SESSION_COOKIE_NAME);
    expect(await countSessionsOf(person.id)).toBe(0);
  });
});
