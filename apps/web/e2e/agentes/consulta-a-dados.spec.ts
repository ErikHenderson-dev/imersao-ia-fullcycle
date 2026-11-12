// spec: e2e/plano-de-testes-f13.md
// seed: e2e/seed.spec.ts
import { expect, logIn, test } from "../fixtures";
import { isConnected, setConnected } from "../support/agents";
import { agentMessage, composer } from "../support/conversation-page";
import { insertBot, setDataAccessOf } from "../support/database";
import { openSharedChannel } from "../support/realtime";

// O modelo real responde em alguns segundos; a folga cobre a latência e as novas tentativas dele.
const MODEL_TIMEOUT_MS = 60_000;
const NOTICE = "Resposta com dados de negócio. Você não tem permissão para vê-la.";

test.describe("Consulta a dados de negócio", () => {
  test("a pergunta de faturamento responde com o número para quem tem permissão e bloqueada para o outro", async ({
    page,
    person,
    otherPage,
    sharedChannel,
    agentsLock,
  }) => {
    void agentsLock;
    test.setTimeout(120_000);
    // 1. O assistente conectado, com o bot criado; a Ana com Permissão de dados, o Bruno sem
    const wasConnected = await isConnected("assistente");
    await insertBot("Assistente", "assistente");
    await setConnected("assistente", true);
    await setDataAccessOf(person.id, true);
    try {
      await logIn(page, person);
      await openSharedChannel(page, otherPage, sharedChannel, person, { history: 0 });

      // 2. A Ana pergunta o faturamento de março de 2026
      const box = composer(page, sharedChannel.name);
      await box.fill("@assistente quanto faturamos em março de 2026?");
      await box.press("Escape");
      await box.press("Enter");

      // 3. A Ana vê o número e o que foi considerado; o Bruno, a Resposta bloqueada, sem recarregar
      const answer = agentMessage(page, sharedChannel.name);
      await expect(answer).toContainText("Faturamento de março de 2026: R$", { timeout: MODEL_TIMEOUT_MS });
      await expect(answer).toContainText("Considerado: faturamento líquido, pedidos pagos, de 01/03/2026 a 31/03/2026");
      const blocked = agentMessage(otherPage, sharedChannel.name);
      await expect(blocked).toContainText(NOTICE);
      await expect(blocked).not.toContainText("R$");
    } finally {
      await setConnected("assistente", wasConnected);
    }
  });
});
