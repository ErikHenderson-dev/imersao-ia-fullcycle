// spec: e2e/plano-de-testes-f06.md
// seed: e2e/seed.spec.ts
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "../fixtures";
import { messageItem, openDeleteDialog, readyHistory } from "../support/conversation-page";
import { insertHistory } from "../support/database";

test.describe("Acessibilidade", () => {
  test("a confirmação de apagar não tem violações de acessibilidade", async ({
    page,
    memberChannel,
    person,
    loggedInPage,
  }) => {
    void loggedInPage;
    await insertHistory(memberChannel, person, 2);
    await page.goto(`/conversas/${memberChannel.id}`);
    await readyHistory(page, memberChannel.name);
    await openDeleteDialog(page, messageItem(page, memberChannel.name, "Mensagem 2"));
    await expect(page.getByRole("alertdialog")).toBeVisible();

    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
});
