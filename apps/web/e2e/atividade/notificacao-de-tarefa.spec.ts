// spec: e2e/plano-de-testes-f12.md
// seed: e2e/seed.spec.ts
import type { Page } from "@playwright/test";
import { expect, logIn, test } from "../fixtures";
import { botTask, requestByApi } from "../support/bot";
import { insertBot, type TestChannel, type TestPerson } from "../support/database";
import { waitForRealtime } from "../support/realtime";

// A Ana delega ao Bruno pela rota do bot, sem o modelo.
async function delegate(page: Page, channel: TestChannel, assignee: TestPerson, title: string) {
  const bot = await insertBot();
  const requestId = await requestByApi(page, channel.id, bot.username);
  return botTask(requestId, assignee.username, title);
}

function activityItem(page: Page, title: string) {
  return page.getByRole("list", { name: "Notificações" }).getByRole("listitem").filter({ hasText: title });
}

test.describe("Notificações de Tarefa", () => {
  test("a Notificação de Tarefa chega, conta e abre a Tarefa", async ({
    page,
    person,
    otherPage,
    otherPerson,
    sharedChannel,
  }) => {
    // 1. O Bruno está em Atividade → Todas; a Ana delega a ele
    await logIn(page, person);
    await otherPage.goto("/atividade");
    await waitForRealtime(otherPage);
    const title = `Revisar o contrato ${crypto.randomUUID().slice(0, 8)}`;
    await delegate(page, sharedChannel, otherPerson, title);

    // 2. O item chega não lido, e os contadores da aba Tarefas e do rail sobem
    const item = activityItem(otherPage, title);
    await expect(item).toContainText(`${person.name} delegou uma Tarefa a você`);
    await expect(item.getByRole("link")).toHaveAttribute("data-read", "false");
    const tabs = otherPage.getByRole("navigation", { name: "Tipos de atividade" });
    await expect(tabs.getByRole("link", { name: /^Tarefas\s*, 1 não lida/ })).toBeVisible();
    await expect(otherPage.getByRole("link", { name: /^Atividade\s*, 1 não lida/ })).toBeVisible();

    // 3. Clicar abre a aba Tarefas com a Tarefa em destaque, e o contador zera
    await item.getByRole("link").click();
    await expect(otherPage).toHaveURL(/aba=tarefas&tarefa=/);
    await expect(otherPage.locator("[data-highlighted]")).toContainText(title);
    await expect(tabs.getByRole("link", { name: "Tarefas", exact: true })).toBeVisible();
  });

  test("o Alerta da Tarefa recebida e da concluída", async ({
    page,
    person,
    otherPage,
    otherPerson,
    sharedChannel,
  }) => {
    // 1. Cada um numa Conversa; a Ana delega ao Bruno, que vê o Alerta
    await logIn(page, person);
    await page.goto(`/conversas/${sharedChannel.id}`);
    await otherPage.goto(`/conversas/${sharedChannel.id}`);
    await waitForRealtime(page);
    await waitForRealtime(otherPage);
    const title = `Atualizar a planilha ${crypto.randomUUID().slice(0, 8)}`;
    const task = await delegate(page, sharedChannel, otherPerson, title);
    await expect(otherPage.getByText(`${person.name} delegou uma Tarefa a você`)).toBeVisible();

    // 2. O Bruno conclui pela aba Tarefas; a Ana vê o Alerta da conclusão
    await otherPage.goto(`/atividade?aba=tarefas&tarefa=${task.id}`);
    await otherPage.locator("[data-highlighted]").getByRole("button", { name: "Concluir" }).click();
    await expect(page.getByText(`${otherPerson.name} concluiu uma Tarefa`)).toBeVisible();
  });

  test("sem Alerta com a aba Tarefas aberta", async ({ page, person, otherPage, otherPerson, sharedChannel }) => {
    await logIn(page, person);
    await otherPage.goto("/atividade?aba=tarefas");
    await waitForRealtime(otherPage);
    const title = `Mandar o relatório ${crypto.randomUUID().slice(0, 8)}`;

    await delegate(page, sharedChannel, otherPerson, title);

    await expect(otherPage.getByRole("navigation", { name: "Tipos de atividade" }).getByRole("link", { name: /^Tarefas\s*, 1 não lida/ })).toBeVisible();
    await expect(otherPage.getByText(`${person.name} delegou uma Tarefa a você`)).toHaveCount(0);
  });
});
