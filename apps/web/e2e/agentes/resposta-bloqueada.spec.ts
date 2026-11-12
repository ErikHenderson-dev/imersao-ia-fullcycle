// spec: e2e/plano-de-testes-f13.md
// seed: e2e/seed.spec.ts
import type { Page } from "@playwright/test";
import { expect, logIn, test } from "../fixtures";
import { botReply, requestByApi } from "../support/bot";
import { messageItem, readyHistory } from "../support/conversation-page";
import { insertBot, setDataAccessOf, type TestChannel, type TestPerson } from "../support/database";
import { openSharedChannel, sendFromComposer } from "../support/realtime";

const ANSWER = "Faturamento de março de 2026: R$ 1.234.567,89.";
const NOTICE = "Resposta com dados de negócio. Você não tem permissão para vê-la.";

// A resposta do bot do teste: o item da lista com o nome dele.
function botMessage(page: Page, channel: TestChannel, botName: string) {
  return page
    .getByRole("list", { name: `Mensagens em #${channel.name}` })
    .getByRole("listitem")
    .filter({ has: page.getByRole("button", { name: botName, exact: true }) });
}

// A Ana (com Permissão de dados) e o Bruno (sem) no Canal; o bot do teste, com @usuário próprio,
// responde com a marca pela rota, sem o modelo nem o Serviço de agentes.
async function answered(page: Page, otherPage: Page, channel: TestChannel, person: TestPerson) {
  const bot = await insertBot("Analista");
  await setDataAccessOf(person.id, true);
  await logIn(page, person);
  await openSharedChannel(page, otherPage, channel, person, { history: 0 });
  const requestId = await requestByApi(page, channel.id, bot.username);
  await botReply(requestId, ANSWER, { businessData: true });
  return bot;
}

test.describe("Resposta bloqueada", () => {
  test("a resposta marcada aparece bloqueada para quem não tem Permissão de dados, sem recarregar e depois de recarregar", async ({
    page,
    person,
    otherPage,
    sharedChannel,
  }) => {
    // 1. O bot responde com a marca
    const bot = await answered(page, otherPage, sharedChannel, person);

    // 2. A Ana vê o número; o Bruno, o aviso, sem recarregar
    await expect(botMessage(page, sharedChannel, bot.name)).toContainText(ANSWER);
    const seen = botMessage(otherPage, sharedChannel, bot.name);
    await expect(seen).toContainText(NOTICE);
    await expect(seen).not.toContainText("1.234.567,89");

    // 3. Depois de recarregar, o Bruno continua vendo o aviso
    await otherPage.reload();
    await readyHistory(otherPage, sharedChannel.name);
    await expect(botMessage(otherPage, sharedChannel, bot.name)).toContainText(NOTICE);
    await expect(botMessage(otherPage, sharedChannel, bot.name)).not.toContainText("1.234.567,89");
  });

  test("a citação da resposta marcada aparece bloqueada", async ({ page, person, otherPage, sharedChannel }) => {
    // 1. O bot responde com a marca, e a Ana responde citando a resposta
    const bot = await answered(page, otherPage, sharedChannel, person);
    const answer = botMessage(page, sharedChannel, bot.name);
    await answer.hover();
    await answer.getByRole("button", { name: "Responder" }).click();
    await sendFromComposer(page, sharedChannel.name, "Bateu a meta");

    // 2. A Ana vê a citação com o número; o Bruno, com o aviso
    await expect(messageItem(page, sharedChannel.name, "Bateu a meta")).toContainText("1.234.567,89");
    const quoting = messageItem(otherPage, sharedChannel.name, "Bateu a meta");
    await expect(quoting.getByRole("button", { name: `Ir até a mensagem de ${bot.name}: ${NOTICE}` })).toBeVisible();
    await expect(quoting).not.toContainText("1.234.567,89");
  });

  test("copiar a resposta bloqueada copia o aviso", async ({ page, person, otherPage, sharedChannel }) => {
    // 1. O bot responde com a marca; o Bruno pode ler a área de transferência
    const bot = await answered(page, otherPage, sharedChannel, person);
    await otherPage.context().grantPermissions(["clipboard-read", "clipboard-write"]);
    const seen = botMessage(otherPage, sharedChannel, bot.name);
    await expect(seen).toContainText(NOTICE);

    // 2. "Copiar texto" pelo teclado copia o aviso
    await seen.getByRole("button", { name: "Copiar texto" }).focus();
    await otherPage.keyboard.press("Enter");
    await expect(otherPage.getByText("Texto copiado")).toBeVisible();
    await expect.poll(() => otherPage.evaluate(() => navigator.clipboard.readText())).toBe(NOTICE);
  });
});
