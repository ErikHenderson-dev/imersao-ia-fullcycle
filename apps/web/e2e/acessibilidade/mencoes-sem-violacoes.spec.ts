// spec: e2e/plano-de-testes-f06.md
// seed: e2e/seed.spec.ts
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "../fixtures";
import { composer, readyHistory } from "../support/conversation-page";

test.describe("Acessibilidade", () => {
  test("a lista de menções não tem violações de acessibilidade", async ({
    page,
    sharedChannel,
    loggedInPage,
  }) => {
    void loggedInPage;
    await page.goto(`/conversas/${sharedChannel.id}`);
    await readyHistory(page, sharedChannel.name);
    await composer(page, sharedChannel.name).pressSequentially("@");
    await expect(page.getByRole("listbox", { name: "Pessoas para mencionar" })).toBeVisible();

    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
});
