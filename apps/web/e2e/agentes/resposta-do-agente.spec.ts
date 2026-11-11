// spec: e2e/plano-de-testes-f11.md
// seed: e2e/seed.spec.ts
import { expect, logIn, test } from "../fixtures";
import { isConnected, setConnected } from "../support/agents";
import { botReply } from "../support/bot";
import { agentMessage, composer, messageItem } from "../support/conversation-page";
import { insertBot, latestAgentRequestOf } from "../support/database";
import { openSharedChannel } from "../support/realtime";

// O modelo real responde em alguns segundos; a folga cobre a latência e as novas tentativas dele.
const MODEL_TIMEOUT_MS = 60_000;

test.describe("Resposta do Agente", () => {
  test("a resposta do @assistente chega às duas Pessoas sem recarregar", async ({
    page,
    person,
    otherPage,
    sharedChannel,
    agentsLock,
  }) => {
    void agentsLock;
    test.setTimeout(120_000);
    // 1. O assistente conectado, com o bot criado; as duas Pessoas no Canal
    const wasConnected = await isConnected("assistente");
    await insertBot("Assistente", "assistente");
    await setConnected("assistente", true);
    try {
      await logIn(page, person);
      await openSharedChannel(page, otherPage, sharedChannel, person, { history: 0 });

      // 2. A Ana menciona o assistente
      const box = composer(page, sharedChannel.name);
      await box.fill("@assistente responda só com a palavra olá");
      await box.press("Escape");
      await box.press("Enter");

      // 3. A Mensagem do Agente chega às duas abas, com o AgentTag, pelo modelo real
      for (const tab of [page, otherPage]) {
        const agentItem = agentMessage(tab, sharedChannel.name);
        await expect(agentItem).toHaveCount(1, { timeout: MODEL_TIMEOUT_MS });
        await expect(agentItem.getByText("AGENTE", { exact: true })).toBeVisible();
      }

      // 4. O bot do teste responde de novo ao mesmo Pedido: a mesma Mensagem, sem duplicar
      await expect.poll(() => latestAgentRequestOf(sharedChannel)).toMatchObject({ kind: "new", status: "open" });
      const request = (await latestAgentRequestOf(sharedChannel))!;
      const shown = await agentMessage(otherPage, sharedChannel.name).innerText();
      const repeated = await botReply(request.id, "Outro texto");
      expect(repeated.body).not.toBe("Outro texto");
      expect(shown).toContain(repeated.body.slice(0, 20));
      await expect(messageItem(page, sharedChannel.name, "Outro texto")).toHaveCount(0);
    } finally {
      await setConnected("assistente", wasConnected);
    }
  });
});
