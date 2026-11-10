// spec: e2e/plano-de-testes-f05.md
// seed: e2e/seed.spec.ts
import AxeBuilder from "@axe-core/playwright";
import { expect, logIn, test } from "../fixtures";
import { readyConversation, readyHistory } from "../support/conversation-page";
import { insertHistory } from "../support/database";
import { authorButton, profilePanel } from "../support/profile-panel";

test.describe("Acessibilidade", () => {
  test("conversa-direta-sem-violacoes", async ({ page, person, otherPerson, sharedChannel }) => {
    // 1. Abrir a Conversa direta e analisar
    await insertHistory(sharedChannel, otherPerson, 1);
    await logIn(page, person);
    await page.goto(`/conversas/${sharedChannel.id}`);
    await readyHistory(page, sharedChannel.name);
    await authorButton(page, otherPerson.name).click();
    await profilePanel(page).getByRole("button", { name: "Mensagem" }).click();
    await readyConversation(page, otherPerson.name);
    await expect(page).toHaveTitle(/.+/);

    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
});
