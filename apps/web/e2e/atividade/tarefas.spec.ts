// spec: e2e/plano-de-testes-f12.md
// seed: e2e/seed.spec.ts
import type { Page } from "@playwright/test";
import { expect, logIn, test } from "../fixtures";
import { botTask, requestByApi } from "../support/bot";
import { deleteByApi } from "../support/chat-api";
import { insertBot, type TestChannel, type TestPerson } from "../support/database";

// Um grupo da aba Tarefas pelo título.
function group(page: Page, name: "Recebidas" | "Delegadas") {
  return page.getByRole("region", { name });
}

function taskItem(page: Page, name: "Recebidas" | "Delegadas", title: string) {
  return group(page, name).getByRole("listitem").filter({ hasText: title });
}

// A Ana delega ao Bruno pela rota do bot, sem o modelo: o Pedido sai da página dela.
async function delegate(page: Page, channel: TestChannel, assignee: TestPerson, title: string) {
  const bot = await insertBot();
  const requestId = await requestByApi(page, channel.id, bot.username);
  return botTask(requestId, assignee.username, title);
}

test.describe("Atividade → Tarefas", () => {
  test("concluir e reabrir chegam a quem delegou", async ({
    page,
    person,
    otherPage,
    otherPerson,
    sharedChannel,
  }) => {
    // 1. A Ana delega ao Bruno; cada um abre a aba Tarefas
    await logIn(page, person);
    const title = `Revisar o contrato ${crypto.randomUUID().slice(0, 8)}`;
    await delegate(page, sharedChannel, otherPerson, title);
    await page.goto("/atividade?aba=tarefas");
    await otherPage.goto("/atividade?aba=tarefas");

    // 2. O Bruno vê a Tarefa em Recebidas e a conclui pelo teclado
    const received = taskItem(otherPage, "Recebidas", title);
    await expect(received).toContainText(sharedChannel.name);
    await received.getByRole("button", { name: "Concluir" }).focus();
    await otherPage.keyboard.press("Enter");
    await expect(received.getByRole("button", { name: "Reabrir" })).toBeVisible();
    await expect(received).toContainText("Concluída");

    // 3. Na aba da Ana, em Delegadas, o estado muda sem recarregar, sem botões
    const delegated = taskItem(page, "Delegadas", title);
    await expect(delegated).toContainText("Concluída");
    await expect(delegated.getByRole("button")).toHaveCount(0);

    // 4. O Bruno reabre, e a Ana vê aberta de novo
    await received.getByRole("button", { name: "Reabrir" }).click();
    await expect(received.getByRole("button", { name: "Concluir" })).toBeVisible();
    await expect(delegated).toContainText("Aberta");
  });

  test("a Tarefa com o Pedido apagado continua na aba", async ({ page, person, otherPerson, sharedChannel }) => {
    await logIn(page, person);
    const title = `Atualizar a planilha ${crypto.randomUUID().slice(0, 8)}`;
    const task = await delegate(page, sharedChannel, otherPerson, title);
    await deleteByApi(page, sharedChannel.id, task.trigger_message.id);

    await page.goto("/atividade?aba=tarefas");

    const delegated = taskItem(page, "Delegadas", title);
    await expect(delegated).toContainText("Mensagem apagada");
    await expect(delegated.getByRole("link", { name: "Ver Pedido" })).toHaveCount(0);
  });

  test("o link com a Tarefa a destaca", async ({ page, person, otherPage, otherPerson, sharedChannel }) => {
    await logIn(page, person);
    const title = `Mandar o relatório ${crypto.randomUUID().slice(0, 8)}`;
    const task = await delegate(page, sharedChannel, otherPerson, title);

    await otherPage.goto(`/atividade?aba=tarefas&tarefa=${task.id}`);

    const item = taskItem(otherPage, "Recebidas", title);
    await expect(item.locator("[data-highlighted]")).toBeVisible();
    await expect(item.locator("[data-highlighted]")).toBeFocused();
  });

  test("a aba vazia explica como pedir uma Tarefa", async ({ loggedInPage: page }) => {
    await page.goto("/atividade?aba=tarefas");

    await expect(page.getByText("Nenhuma Tarefa")).toBeVisible();
    await expect(page.getByText(/peça para delegar/)).toBeVisible();
  });
});
