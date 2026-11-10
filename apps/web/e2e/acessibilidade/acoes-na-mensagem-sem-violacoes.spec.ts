// spec: e2e/plano-de-testes-f06.md
// seed: e2e/seed.spec.ts
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "../fixtures";
import { messageItem, readyHistory } from "../support/conversation-page";
import { insertHistory } from "../support/database";

test.describe("Acessibilidade", () => {
  test("a barra e o menu não têm violações de acessibilidade", async ({
    page,
    memberChannel,
    person,
    loggedInPage,
  }) => {
    void loggedInPage;
    await insertHistory(memberChannel, person, 2);
    await page.goto(`/conversas/${memberChannel.id}`);
    await readyHistory(page, memberChannel.name);
    const item = messageItem(page, memberChannel.name, "Mensagem 2");

    // 1. Com a barra à vista
    await item.hover();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

    // 2. Com o menu aberto
    await item.getByRole("button", { name: "Mais ações" }).click();
    await expect(page.getByRole("menu")).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
});
