// spec: e2e/plano-de-testes-f14.md
// seed: e2e/seed.spec.ts
import { readFile } from "node:fs/promises";
import type { Page } from "@playwright/test";
import { expect, logIn, test } from "../fixtures";
import { BLOCKED_NOTICE, botReportStarted, REPORT_NOTICE, requestByApi, workerReportDelivered } from "../support/bot";
import { messageItem, messageList, readyHistory } from "../support/conversation-page";
import { insertBot, setDataAccessOf, type TestChannel, type TestPerson } from "../support/database";
import { openSharedChannel } from "../support/realtime";
import { putSamplePdf } from "../support/s3";

const FILE_NAME = "relatorio-2026-03-01-a-2026-03-31.pdf";

// A Ana (com Permissão de dados) e o Bruno (sem) no Canal; o bot do teste grava o aviso, o PDF de
// exemplo vai para o S3 na chave do Pedido e o Worker entrega, pelas rotas, sem o modelo.
async function deliveredReport(page: Page, otherPage: Page, channel: TestChannel, person: TestPerson) {
  const bot = await insertBot("Relator");
  await setDataAccessOf(person.id, true);
  await logIn(page, person);
  await openSharedChannel(page, otherPage, channel, person, { history: 0 });
  const requestId = await requestByApi(page, channel.id, bot.username);
  await botReportStarted(requestId, REPORT_NOTICE);
  const sizeBytes = await putSamplePdf(`reports/${requestId}.pdf`);
  const delivery = await workerReportDelivered(requestId, { fileName: FILE_NAME, sizeBytes });
  return { bot, delivery };
}

test.describe("Entrega do Relatório", () => {
  test("a entrega mostra o cartão a quem tem permissão e a Resposta bloqueada à outra Pessoa", async ({
    page,
    person,
    otherPage,
    sharedChannel,
  }) => {
    // 1. O Worker entrega o Relatório
    await deliveredReport(page, otherPage, sharedChannel, person);

    // 2. A Ana vê o cartão com o nome, o tamanho e "Baixar", sem recarregar
    const toAna = messageItem(page, sharedChannel.name, "o relatório está pronto.");
    await expect(toAna).toContainText(`@${person.username}, o relatório está pronto.`);
    await expect(toAna).toContainText(FILE_NAME);
    await expect(toAna).toContainText("KB");
    await expect(toAna.getByRole("link", { name: `Baixar ${FILE_NAME}` })).toBeVisible();

    // 3. Depois de recarregar, o cartão continua lá
    await page.reload();
    await readyHistory(page, sharedChannel.name);
    await expect(page.getByRole("link", { name: `Baixar ${FILE_NAME}` })).toBeVisible();

    // 4. O Bruno vê a Resposta bloqueada, sem cartão
    const toBruno = messageList(otherPage, sharedChannel.name);
    await expect(toBruno.getByText(BLOCKED_NOTICE, { exact: true })).toHaveCount(2);
    await expect(toBruno).not.toContainText(FILE_NAME);
    await expect(otherPage.getByRole("link", { name: /^Baixar/ })).toHaveCount(0);
  });

  test("Baixar baixa o PDF para quem tem permissão", async ({ page, person, otherPage, sharedChannel }) => {
    // 1. O Worker entrega o Relatório
    await deliveredReport(page, otherPage, sharedChannel, person);
    const link = page.getByRole("link", { name: `Baixar ${FILE_NAME}` });
    await expect(link).toBeVisible();

    // 2. "Baixar" pelo teclado baixa o PDF
    const download = page.waitForEvent("download");
    await link.focus();
    await page.keyboard.press("Enter");
    const file = await download;

    // 3. O arquivo tem o nome do Relatório e é um PDF
    expect(file.suggestedFilename()).toBe(FILE_NAME);
    const content = await readFile((await file.path())!, "latin1");
    expect(content.startsWith("%PDF")).toBe(true);
  });

  test("o link do relatório responde 403 para quem não tem permissão e 404 sem relatório", async ({
    page,
    person,
    otherPage,
    sharedChannel,
  }) => {
    // 1. O Worker entrega o Relatório
    const { delivery } = await deliveredReport(page, otherPage, sharedChannel, person);

    // 2. O Bruno abre o link do BFF e recebe a página de permissão
    const forbidden = await otherPage.goto(`/api/messages/${delivery.id}/report`);
    expect(forbidden?.status()).toBe(403);
    await expect(otherPage.getByRole("heading", { name: "Você não tem permissão para baixar este relatório." })).toBeVisible();

    // 3. Um id sem relatório mostra "Relatório não encontrado."
    const missing = await otherPage.goto(`/api/messages/${crypto.randomUUID()}/report`);
    expect(missing?.status()).toBe(404);
    await expect(otherPage.getByRole("heading", { name: "Relatório não encontrado." })).toBeVisible();
  });
});
