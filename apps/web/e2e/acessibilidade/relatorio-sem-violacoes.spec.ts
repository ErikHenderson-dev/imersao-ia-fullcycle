// spec: e2e/plano-de-testes-f14.md
// seed: e2e/seed.spec.ts
import { expect, logIn, test } from "../fixtures";
import { expectNoViolationsInBothThemes } from "../support/accessibility";
import { BLOCKED_NOTICE, botReportStarted, REPORT_NOTICE, requestByApi, workerReportDelivered } from "../support/bot";
import { messageItem, messageList, readyHistory } from "../support/conversation-page";
import { insertBot, setDataAccessOf } from "../support/database";
import { putSamplePdf } from "../support/s3";

const FILE_NAME = "relatorio-2026-03-01-a-2026-03-31.pdf";

test.describe("Acessibilidade", () => {
  test("a Conversa com a entrega completa e a bloqueada passa no axe nos dois temas", async ({
    page,
    person,
    otherPerson,
    otherPage,
    sharedChannel,
  }) => {
    // 1. O Bruno (com Permissão de dados) pede o Relatório, e o Worker entrega; a Ana não tem a
    //    permissão
    const bot = await insertBot("Relator");
    await setDataAccessOf(otherPerson.id, true);
    await otherPage.goto(`/conversas/${sharedChannel.id}`);
    const requestId = await requestByApi(otherPage, sharedChannel.id, bot.username);
    await botReportStarted(requestId, REPORT_NOTICE);
    const sizeBytes = await putSamplePdf(`reports/${requestId}.pdf`);
    await workerReportDelivered(requestId, { fileName: FILE_NAME, sizeBytes });

    // 2. A entrega completa, na página de quem tem a permissão, nos dois temas
    await readyHistory(otherPage, sharedChannel.name);
    await expect(messageItem(otherPage, sharedChannel.name, "o relatório está pronto.")).toContainText(FILE_NAME);
    await expectNoViolationsInBothThemes(otherPage);

    // 3. A entrega bloqueada, na página da Ana, nos dois temas
    await logIn(page, person);
    await page.goto(`/conversas/${sharedChannel.id}`);
    await readyHistory(page, sharedChannel.name);
    await expect(messageList(page, sharedChannel.name).getByText(BLOCKED_NOTICE, { exact: true })).toHaveCount(2);
    await expectNoViolationsInBothThemes(page);
  });
});
