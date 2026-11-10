// spec: e2e/plano-de-testes-f09.md
// seed: e2e/seed.spec.ts
import type { Page } from "@playwright/test";
import { expect, logIn, test } from "../fixtures";
import { setThemeOf, themeOf } from "../support/database";
import { waitForRealtime } from "../support/realtime";
import { routeServerAction } from "../support/server-action";

function themeAttribute(page: Page) {
  return page.evaluate(() => document.documentElement.getAttribute("data-theme"));
}

// O botão de tema, pelo teclado.
async function toggleTheme(page: Page, label: string) {
  const button = page.getByRole("button", { name: label });
  await button.focus();
  await page.keyboard.press("Enter");
}

test.describe("Tema", () => {
  test("o tema vem aplicado num navegador novo, antes da hidratação", async ({
    browser,
    baseURL,
    person,
  }) => {
    // 1. O tema escuro gravado na Pessoa; ela entra num navegador novo
    await setThemeOf(person.id, "dark");
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    await logIn(page, person);
    expect(await themeAttribute(page)).toBe("dark");

    // 2. Sem o JavaScript da aplicação (sem hidratação), o script do <head> já aplica o tema
    await page.route("**/_next/static/**/*.js", (route) => route.abort());
    await page.reload();

    expect(await themeAttribute(page)).toBe("dark");
    expect(await page.evaluate(() => document.documentElement.style.colorScheme)).toBe("dark");
    await context.close();
  });

  test("Entrar fica no claro", async ({ page, baseURL }) => {
    await page.context().addCookies([{ name: "theme", value: "dark", url: baseURL! }]);

    await page.goto("/entrar");

    expect(await themeAttribute(page)).toBeNull();
  });

  test("troca o tema nas duas abas, pelo teclado, e a escolha fica na Pessoa", async ({
    loggedInPage: page,
    person,
    context,
  }) => {
    // 1. Uma segunda aba do mesmo navegador
    const second = await context.newPage();
    await second.goto("/");
    await expect(second.getByRole("button", { name: "Mudar para o tema escuro" })).toBeVisible();
    // Hidratada: o botão já aparece no HTML do servidor, antes de a aba ouvir o canal.
    await waitForRealtime(second);

    // 2. A lua troca para o escuro
    await toggleTheme(page, "Mudar para o tema escuro");

    await expect(page.getByRole("button", { name: "Mudar para o tema claro" })).toBeVisible();
    expect(await themeAttribute(page)).toBe("dark");
    await expect.poll(() => themeAttribute(second)).toBe("dark");
    await expect(second.getByRole("button", { name: "Mudar para o tema claro" })).toBeVisible();
    await expect.poll(() => themeOf(person.id)).toBe("dark");

    // 3. O sol volta ao claro
    await toggleTheme(page, "Mudar para o tema claro");
    await expect.poll(() => themeAttribute(second)).toBe("light");
  });

  test("a falha volta ao tema anterior", async ({ loggedInPage: page, person }) => {
    await routeServerAction(page, (route) => route.fulfill({ status: 500, body: "" }));

    await toggleTheme(page, "Mudar para o tema escuro");

    await expect(page.getByText("Não foi possível trocar o tema")).toBeVisible();
    expect(await themeAttribute(page)).toBe("light");
    await expect(page.getByRole("button", { name: "Mudar para o tema escuro" })).toBeVisible();
    expect(await themeOf(person.id)).toBe("light");
  });
});
