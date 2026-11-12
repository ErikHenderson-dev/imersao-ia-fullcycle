// spec: e2e/plano-de-testes-f11.md
// seed: e2e/seed.spec.ts
import type { Page } from "@playwright/test";
import { expect, logIn, test } from "../fixtures";
import { isConnected, setConnected } from "../support/agents";
import { botQuestion, requestByApi } from "../support/bot";
import { messageItem, readyHistory } from "../support/conversation-page";
import { insertBot, latestAgentRequestOf, setQuestionExpiry, type TestChannel } from "../support/database";
import { openSharedChannel } from "../support/realtime";

// O texto da pergunta e os rótulos que a ferramenta perguntar_recorte grava (app/agent_requests/question.py).
const QUESTION = "De que período você quer o resumo? Você pode responder sem me mencionar.";
const LABELS = ["Hoje (3)", "Desde ontem (5)", "A semana (12)", "Tudo (24)"];

// A Mensagem da pergunta do Agente.
function question(page: Page, channel: TestChannel) {
  return messageItem(page, channel.name, "De que período");
}

// A Mensagem de uma Pessoa com o texto do botão, fora da pergunta.
function answer(page: Page, channel: TestChannel, label: string) {
  return messageItem(page, channel.name, label).filter({ hasNotText: "De que período" });
}

test.describe("Respostas prontas", () => {
  // O assistente desconectado: o clique de quem pediu vira continuação, que o Serviço de agentes
  // recusa com 409, e o BFF encerra sem erro e sem o modelo (spec da F11, "Disparo pelo BFF").
  let wasConnected = true;
  test.beforeEach(async ({ agentsLock }) => {
    void agentsLock;
    wasConnected = await isConnected("assistente");
    await insertBot("Assistente", "assistente");
    await setConnected("assistente", false);
  });
  test.afterEach(async () => {
    await setConnected("assistente", wasConnected);
  });

  test("os botões valem só para quem pediu e o clique vira Mensagem", async ({
    page,
    person,
    otherPage,
    sharedChannel,
  }) => {
    // 1. As duas Pessoas no Canal; a Ana pede e o bot pergunta
    await logIn(page, person);
    await openSharedChannel(page, otherPage, sharedChannel, person, { history: 0 });
    const requestId = await requestByApi(page, sharedChannel.id, "assistente");
    await botQuestion(requestId, QUESTION, LABELS);

    // 2. A Ana vê os botões ativos; o Bruno, desativados, com o motivo no rótulo acessível
    const asked = question(page, sharedChannel);
    for (const label of LABELS) {
      await expect(asked.getByRole("button", { name: label, exact: true })).toBeEnabled();
    }
    await expect(asked).toContainText("Aguardando sua resposta");
    const seen = question(otherPage, sharedChannel);
    for (const label of LABELS) {
      await expect(
        seen.getByRole("button", { name: `${label}, só quem pediu pode responder` }),
      ).toBeDisabled();
    }
    await expect(seen).toContainText("Só quem pediu pode responder");

    // 3. A Ana escolhe "Hoje (3)" pelo teclado
    await asked.getByRole("button", { name: "Hoje (3)", exact: true }).focus();
    await page.keyboard.press("Enter");

    // 4. A Mensagem dela aparece para as duas, e os botões se desativam para as duas, sem recarregar
    await expect(answer(page, sharedChannel, "Hoje (3)")).toBeVisible();
    await expect(answer(otherPage, sharedChannel, "Hoje (3)")).toBeVisible();
    for (const view of [asked, seen]) {
      for (const label of LABELS) {
        await expect(view.getByRole("button", { name: label, exact: true })).toBeDisabled();
      }
      await expect(view).toContainText("Encerrada");
    }

    // 5. A resposta virou a continuação do Pedido, que o Agente desconectado encerra sem erro na tela
    await expect
      .poll(async () => await latestAgentRequestOf(sharedChannel))
      .toMatchObject({ kind: "continuation", status: "cancelled" });
    await expect(answer(page, sharedChannel, "Hoje (3)").getByRole("alert")).toHaveCount(0);
  });

  test("a pergunta vencida desativa os botões", async ({ page, person, memberChannel }) => {
    // 1. Uma pergunta que vence em poucos segundos
    await logIn(page, person);
    const requestId = await requestByApi(page, memberChannel.id, "assistente");
    const questionId = await botQuestion(requestId, QUESTION, LABELS);
    await setQuestionExpiry(questionId, new Date(Date.now() + 6_000));

    // 2. A Ana abre a Conversa com os botões ativos
    await page.goto(`/conversas/${memberChannel.id}`);
    await readyHistory(page, memberChannel.name);
    const asked = question(page, memberChannel);
    await expect(asked.getByRole("button", { name: "Hoje (3)", exact: true })).toBeEnabled();

    // 3. No vencimento, os botões se desativam sem recarregar
    await expect(asked.getByRole("button", { name: "Hoje (3)", exact: true })).toBeDisabled({ timeout: 10_000 });
    await expect(asked).toContainText("Encerrada");
  });
});
