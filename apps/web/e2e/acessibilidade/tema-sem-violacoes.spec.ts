// spec: e2e/plano-de-testes-f09.md
// seed: e2e/seed.spec.ts
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "../fixtures";
import { readyHistory } from "../support/conversation-page";

test.describe("Acessibilidade", () => {
  test("tema-sem-violacoes", async ({ loggedInPage: page, memberChannel }) => {
    // 1. A Conversa e a Atividade, no claro e depois no escuro, pelo botão de tema
    for (const label of ["Mudar para o tema escuro", "Mudar para o tema claro"]) {
      await page.goto(`/conversas/${memberChannel.id}`);
      await readyHistory(page, memberChannel.name);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.goto("/atividade");
      await expect(page.getByRole("heading", { name: "Atividade" })).toBeVisible();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.getByRole("button", { name: label }).focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("button", { name: label })).toHaveCount(0);
    }
  });
});
