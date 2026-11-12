// spec: e2e/plano-de-testes-f12.md
// seed: e2e/seed.spec.ts
import type { Page } from "@playwright/test";
import { expect, logIn, test } from "../fixtures";
import { expectNoViolationsInBothThemes } from "../support/accessibility";
import { botTask, requestByApi } from "../support/bot";
import { insertBot, type TestChannel, type TestPerson } from "../support/database";

// A Ana delega pela rota do bot, sem o modelo, com um bot só por teste.
function delegator(page: Page, channel: TestChannel) {
  const bot = insertBot();
  return async (assignee: TestPerson, title: string) => {
    const requestId = await requestByApi(page, channel.id, (await bot).username);
    return botTask(requestId, assignee.username, title);
  };
}

test.describe("Acessibilidade das Tarefas", () => {
  test("a aba Tarefas sem violações nos dois temas", async ({ page, person, otherPage, otherPerson, sharedChannel }) => {
    await logIn(page, person);
    const delegate = delegator(page, sharedChannel);
    const received = await delegate(person, "Atualizar o roteiro da demo");
    await delegate(otherPerson, "Revisar o contrato da Acme até sexta");
    const done = await delegate(otherPerson, "Validar a estimativa do composer");
    await otherPage.goto(`/atividade?aba=tarefas&tarefa=${done.id}`);
    await otherPage.locator("[data-highlighted]").getByRole("button", { name: "Concluir" }).click();
    await expect(otherPage.locator("[data-highlighted]").getByRole("button", { name: "Reabrir" })).toBeVisible();

    await page.goto(`/atividade?aba=tarefas&tarefa=${received.id}`);

    await expect(page.locator("[data-highlighted]")).toBeFocused();
    await expectNoViolationsInBothThemes(page);
  });

  test("a aba Todas com Notificações de Tarefa sem violações nos dois temas", async ({
    page,
    person,
    otherPage,
    otherPerson,
    sharedChannel,
  }) => {
    await logIn(page, person);
    await delegator(page, sharedChannel)(otherPerson, "Publicar as notas da versão");

    await otherPage.goto("/atividade");

    await expect(otherPage.getByRole("list", { name: "Notificações" })).toContainText("delegou uma Tarefa a você");
    await expectNoViolationsInBothThemes(otherPage);
  });
});
