// spec: e2e/plano-de-testes-f12.md
// seed: e2e/seed.spec.ts
import { expect, logIn, test } from "../fixtures";
import { isConnected, setConnected } from "../support/agents";
import { agentMessage, composer } from "../support/conversation-page";
import { insertBot, latestTaskOf } from "../support/database";
import { openSharedChannel } from "../support/realtime";

// O modelo real responde em alguns segundos; a folga cobre a latência e as novas tentativas dele.
const MODEL_TIMEOUT_MS = 60_000;

test.describe("Delegação de Tarefa", () => {
  test("a confirmação da Tarefa chega às duas Pessoas sem recarregar", async ({
    page,
    person,
    otherPage,
    otherPerson,
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

      // 2. A Ana pede ao assistente que delegue ao Bruno
      const box = composer(page, sharedChannel.name);
      await box.fill(`@assistente delega pra @${otherPerson.username} revisar o contrato`);
      await box.press("Escape");
      await box.press("Enter");

      // 3. A confirmação chega às duas abas como Mensagem do Agente, pelo modelo real
      for (const tab of [page, otherPage]) {
        const agentItem = agentMessage(tab, sharedChannel.name);
        await expect(agentItem).toHaveCount(1, { timeout: MODEL_TIMEOUT_MS });
        await expect(agentItem).toContainText(`Tarefa delegada a ${otherPerson.name}:`);
      }

      // 4. A Tarefa aberta é do Bruno, delegada pela Ana
      expect(await latestTaskOf(sharedChannel)).toMatchObject({
        assignee_id: otherPerson.id,
        delegator_id: person.id,
        status: "open",
      });
    } finally {
      await setConnected("assistente", wasConnected);
    }
  });
});
