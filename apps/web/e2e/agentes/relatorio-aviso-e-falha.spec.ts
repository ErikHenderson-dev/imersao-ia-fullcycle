// spec: e2e/plano-de-testes-f14.md
// seed: e2e/seed.spec.ts
import type { Page } from "@playwright/test";
import { expect, logIn, test } from "../fixtures";
import { botReportStarted, requestByApi, workerReportFailed } from "../support/bot";
import { messageItem, messageList } from "../support/conversation-page";
import { insertBot, setDataAccessOf, type TestChannel, type TestPerson } from "../support/database";
import { openSharedChannel } from "../support/realtime";

const NOTICE = "Comecei a gerar o relatório de 01/03/2026 a 31/03/2026. Ele chega aqui quando ficar pronto.";
const BLOCKED = "Resposta com dados de negócio. Você não tem permissão para vê-la.";

// As Mensagens do bot do teste: os itens da lista com o nome dele.
function botMessages(page: Page, channel: TestChannel, botName: string) {
  return messageList(page, channel.name)
    .getByRole("listitem")
    .filter({ has: page.getByRole("button", { name: botName, exact: true }) });
}

// A Ana (com Permissão de dados) e o Bruno (sem) no Canal; o bot do teste grava o Aviso de início
// e o Worker, a falha, pelas rotas, sem o modelo nem o Serviço de agentes.
async function failedReport(page: Page, otherPage: Page, channel: TestChannel, person: TestPerson) {
  const bot = await insertBot("Relator");
  await setDataAccessOf(person.id, true);
  await logIn(page, person);
  await openSharedChannel(page, otherPage, channel, person, { history: 0 });
  const requestId = await requestByApi(page, channel.id, bot.username);
  await botReportStarted(requestId, NOTICE);
  const failure = await workerReportFailed(requestId);
  return { bot, failure };
}

test.describe("Aviso de início e falha do Relatório", () => {
  test("o aviso e a falha aparecem completos para quem tem permissão e bloqueados para a outra Pessoa", async ({
    page,
    person,
    otherPage,
    sharedChannel,
  }) => {
    // 1. O bot grava o aviso e o Worker, a falha
    const { bot } = await failedReport(page, otherPage, sharedChannel, person);

    // 2. A Ana vê o aviso e a falha, com a Menção a ela destacada
    const toAna = messageList(page, sharedChannel.name);
    await expect(toAna).toContainText(NOTICE);
    const failure = messageItem(page, sharedChannel.name, "não consegui gerar o relatório.");
    await expect(failure).toContainText(`@${person.username}, não consegui gerar o relatório.`);
    await expect(failure.getByRole("button", { name: `@${person.username}` })).toBeVisible();

    // 3. O Bruno vê as duas como Resposta bloqueada, sem recarregar
    const toBruno = messageList(otherPage, sharedChannel.name);
    await expect(toBruno.getByText(BLOCKED, { exact: true })).toHaveCount(2);
    await expect(toBruno).not.toContainText("não consegui gerar");
    await expect(toBruno).not.toContainText("Comecei a gerar");
  });

  test("a Notificação da falha leva à Mensagem", async ({ page, person, otherPage, sharedChannel }) => {
    // 1. O bot grava o aviso e a falha, que menciona a Ana
    const { bot } = await failedReport(page, otherPage, sharedChannel, person);
    await page.goto("/atividade");

    // 2. A Ana vê a Notificação do Agente e a abre pelo teclado
    const item = page
      .getByRole("list", { name: "Notificações" })
      .getByRole("link")
      .filter({ hasText: `${bot.name} mencionou você` });
    await expect(item).toContainText("não consegui gerar o relatório.");
    await item.focus();
    await page.keyboard.press("Enter");

    // 3. A Conversa abre na Mensagem da falha, destacada
    await expect(
      messageItem(page, sharedChannel.name, "não consegui gerar o relatório.").locator("[data-highlighted]"),
    ).toBeInViewport({ timeout: 15_000 });
  });
});
