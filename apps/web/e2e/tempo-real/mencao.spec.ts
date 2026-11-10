// spec: e2e/plano-de-testes-f06.md
// seed: e2e/seed.spec.ts
import { expect, test } from "../fixtures";
import { composer, messageItem, readyHistory } from "../support/conversation-page";
import { profilePanel } from "../support/profile-panel";

test.describe("Menções em tempo real", () => {
  test("a Pessoa mencionada vê o destaque e abre o Perfil pela Menção", async ({
    loggedInPage: page,
    otherPage,
    otherPerson,
    sharedChannel,
  }) => {
    await page.goto(`/conversas/${sharedChannel.id}`);
    await otherPage.goto(`/conversas/${sharedChannel.id}`);
    await readyHistory(page, sharedChannel.name);
    await readyHistory(otherPage, sharedChannel.name);

    // 1. A autora menciona a outra Pessoa e alguém de fora
    const caixa = composer(page, sharedChannel.name);
    await caixa.fill(`Oi @${otherPerson.username} e @ninguem-de-fora, revisa?`);
    await caixa.press("Enter");

    // 2. A outra Pessoa vê a Mensagem com o destaque e a Menção; o @ de fora é texto
    const item = messageItem(otherPage, sharedChannel.name, "revisa?");
    await expect(item.locator("[data-mentions-me]")).toBeVisible();
    const mencao = item.getByRole("button", { name: `@${otherPerson.username}` });
    await expect(mencao).toBeVisible();
    await expect(item.getByRole("button", { name: "@ninguem-de-fora" })).toHaveCount(0);

    // 3. Clicar na Menção abre o Perfil
    await mencao.click();
    await expect(profilePanel(otherPage).getByText(`@${otherPerson.username}`)).toBeVisible();
  });

  test("a Menção acrescentada na edição destaca sem recarregar", async ({
    loggedInPage: page,
    otherPage,
    otherPerson,
    sharedChannel,
  }) => {
    await page.goto(`/conversas/${sharedChannel.id}`);
    await otherPage.goto(`/conversas/${sharedChannel.id}`);
    await readyHistory(page, sharedChannel.name);
    await readyHistory(otherPage, sharedChannel.name);
    const caixa = composer(page, sharedChannel.name);
    await caixa.fill("Sem menção ainda");
    await caixa.press("Enter");
    const naOutra = messageItem(otherPage, sharedChannel.name, "Sem menção ainda");
    await expect(naOutra).toBeVisible();
    await expect(naOutra.locator("[data-mentions-me]")).toHaveCount(0);

    const id = await messageItem(page, sharedChannel.name, "Sem menção ainda").getAttribute(
      "data-message-id",
    );
    const item = page.locator(`[data-message-id="${id}"]`);
    await item.hover();
    await item.getByRole("button", { name: "Editar" }).click();
    const edicao = page.getByRole("textbox", { name: "Editar mensagem" });
    // O texto depois da Menção deixa a lista de menções fechada.
    await edicao.fill(`Agora com @${otherPerson.username} ok`);
    await item.getByRole("button", { name: "Salvar" }).click();
    await expect(edicao).toHaveCount(0);

    const editada = otherPage.locator(`[data-message-id="${id}"]`);
    await expect(editada.locator("[data-mentions-me]")).toBeVisible();
  });
});
