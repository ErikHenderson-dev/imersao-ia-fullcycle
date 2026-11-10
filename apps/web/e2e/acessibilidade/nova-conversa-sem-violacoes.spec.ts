// spec: e2e/plano-de-testes-f05.md
// seed: e2e/seed.spec.ts
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "../fixtures";
import { insertPerson } from "../support/database";

test.describe("Acessibilidade", () => {
  test("nova-conversa-sem-violacoes", async ({ loggedInPage: page }) => {
    // 1. Abrir "Nova conversa" com uma Pessoa nos resultados e analisar
    const regina = await insertPerson("Regina Fonseca", { title: "Engenheira de Software" });
    await page
      .getByRole("region", { name: "Mensagens diretas" })
      .getByRole("button", { name: "Nova conversa" })
      .click();
    const dialog = page.getByRole("dialog", { name: "Nova conversa" });
    await dialog.getByRole("combobox", { name: "Buscar pessoas" }).fill(`@${regina.username}`);
    await expect(dialog.getByRole("option", { name: regina.name })).toBeVisible();

    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
});
