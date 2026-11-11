// spec: e2e/plano-de-testes-f11.md
// seed: e2e/seed.spec.ts
import { expect, logIn, test } from "../fixtures";
import { isConnected, setConnected } from "../support/agents";
import { botReply, requestByApi } from "../support/bot";
import { composer, messageItem, messageList, readyHistory } from "../support/conversation-page";
import { insertBot, latestAgentRequestOf } from "../support/database";
import { openSharedChannel } from "../support/realtime";
import { breakAgentRequestLimit, fillAgentRequestLimit } from "../support/redis";

// O texto fixo do Agente quando não consegue atender (NAO_CONSEGUI, em app/agent_requests/execution.py).
const NAO_CONSEGUI = "Não consegui fazer o resumo agora. Tente de novo em instantes.";
const NAO_RECEBEU = "O Assistente não recebeu o pedido. Mencione de novo.";
const LIMITE = "Muitos pedidos em pouco tempo. Tente de novo em um minuto.";

test.describe("Erro do Agente", () => {
  test("o erro do Agente aparece só para quem pediu e o Pedido fica failed", async ({
    page,
    person,
    otherPage,
    sharedChannel,
    agentsLock,
  }) => {
    void agentsLock;
    // 1. O assistente conectado, e o Serviço de agentes sem conseguir contar o Pedido da Ana
    const wasConnected = await isConnected("assistente");
    await insertBot("Assistente", "assistente");
    await setConnected("assistente", true);
    try {
      await breakAgentRequestLimit(person.id);
      await logIn(page, person);
      await openSharedChannel(page, otherPage, sharedChannel, person, { history: 0 });

      // 2. A Ana menciona o assistente
      const box = composer(page, sharedChannel.name);
      await box.fill("@assistente resume hoje");
      await box.press("Escape");
      await box.press("Enter");

      // 3. A Ana vê a Mensagem gravada com o erro ao lado; o Bruno vê a Mensagem sem erro
      const sent = messageItem(page, sharedChannel.name, "resume hoje");
      await expect(sent.getByRole("alert")).toHaveText(NAO_RECEBEU);
      await expect(sent).toHaveAttribute("data-status", "sent");
      await expect(messageItem(otherPage, sharedChannel.name, "resume hoje")).toBeVisible();
      await expect(messageList(otherPage, sharedChannel.name).getByText(NAO_RECEBEU)).toHaveCount(0);

      // 4. O Pedido ficou failed
      await expect.poll(async () => (await latestAgentRequestOf(sharedChannel))?.status).toBe("failed");
    } finally {
      await setConnected("assistente", wasConnected);
    }
  });

  test("passar do limite mostra o erro de limite a quem pediu", async ({ page, person, memberChannel, agentsLock }) => {
    void agentsLock;
    // 1. O assistente conectado, e a Ana com os 10 Pedidos do minuto feitos
    const wasConnected = await isConnected("assistente");
    await insertBot("Assistente", "assistente");
    await setConnected("assistente", true);
    try {
      await fillAgentRequestLimit(person.id);
      await logIn(page, person);
      await page.goto(`/conversas/${memberChannel.id}`);
      await readyHistory(page, memberChannel.name);

      // 2. O 11º Pedido
      const box = composer(page, memberChannel.name);
      await box.fill("@assistente resume hoje");
      await box.press("Escape");
      await box.press("Enter");

      // 3. O erro de limite ao lado da Mensagem, e o Pedido failed
      await expect(messageItem(page, memberChannel.name, "resume hoje").getByRole("alert")).toHaveText(LIMITE);
      await expect.poll(async () => (await latestAgentRequestOf(memberChannel))?.status).toBe("failed");
    } finally {
      await setConnected("assistente", wasConnected);
    }
  });

  test("o não consegui do Agente aparece para as duas Pessoas", async ({ page, person, otherPage, sharedChannel }) => {
    // 1. As duas Pessoas no Canal, e um Pedido da Ana para o bot, sem o Serviço de agentes
    const bot = await insertBot("Assistente");
    await logIn(page, person);
    await openSharedChannel(page, otherPage, sharedChannel, person, { history: 0 });
    const requestId = await requestByApi(page, sharedChannel.id, bot.username);

    // 2. O bot grava o não consegui
    await botReply(requestId, NAO_CONSEGUI);

    // 3. A Mensagem do Agente aparece para as duas Pessoas
    for (const tab of [page, otherPage]) {
      const item = messageItem(tab, sharedChannel.name, NAO_CONSEGUI);
      await expect(item).toBeVisible();
      await expect(item.getByText("AGENTE", { exact: true })).toBeVisible();
    }
  });
});
