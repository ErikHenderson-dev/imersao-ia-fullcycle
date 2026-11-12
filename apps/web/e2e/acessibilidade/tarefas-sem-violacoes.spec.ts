// spec: e2e/plano-de-testes-f12.md
// seed: e2e/seed.spec.ts
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { expect, logIn, test } from "../fixtures";
import { botTask, requestByApi } from "../support/bot";
import { insertBot, type TestChannel, type TestPerson } from "../support/database";

// A Ana delega pela rota do bot, sem o modelo.
async function delegate(page: Page, channel: TestChannel, assignee: TestPerson, title: string) {
  const bot = await insertBot();
  const requestId = await requestByApi(page, channel.id, bot.username);
  return botTask(requestId, assignee.username, title);
}

// O axe nos dois temas, depois das transições de cor (memória das armadilhas da F10).
async function expectNoViolations(page: Page) {
  for (const theme of ["light", "dark"]) {
    await page.evaluate((value) => document.documentElement.setAttribute("data-theme", value), theme);
    await page.waitForFunction(() =>
      document.getAnimations().every((a) => !(a instanceof CSSTransition) || a.playState !== "running"),
    );
    expect((await new AxeBuilder({ page }).analyze()).violations, theme).toEqual([]);
  }
}

test.describe("Acessibilidade das Tarefas", () => {
  test("a aba Tarefas sem violações nos dois temas", async ({ page, person, otherPage, otherPerson, sharedChannel }) => {
    await logIn(page, person);
    const received = await delegate(page, sharedChannel, person, "Atualizar o roteiro da demo");
    await delegate(page, sharedChannel, otherPerson, "Revisar o contrato da Acme até sexta");
    const done = await delegate(page, sharedChannel, otherPerson, "Validar a estimativa do composer");
    await otherPage.goto(`/atividade?aba=tarefas&tarefa=${done.id}`);
    await otherPage.locator("[data-highlighted]").getByRole("button", { name: "Concluir" }).click();
    await expect(otherPage.locator("[data-highlighted]").getByRole("button", { name: "Reabrir" })).toBeVisible();

    await page.goto(`/atividade?aba=tarefas&tarefa=${received.id}`);

    await expect(page.locator("[data-highlighted]")).toBeFocused();
    await expectNoViolations(page);
  });

  test("a aba Todas com Notificações de Tarefa sem violações nos dois temas", async ({
    page,
    person,
    otherPage,
    otherPerson,
    sharedChannel,
  }) => {
    await logIn(page, person);
    await delegate(page, sharedChannel, otherPerson, "Publicar as notas da versão");

    await otherPage.goto("/atividade");

    await expect(otherPage.getByRole("list", { name: "Notificações" })).toContainText("delegou uma Tarefa a você");
    await expectNoViolations(otherPage);
  });
});
