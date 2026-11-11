// spec: e2e/plano-de-testes-f11.md
// seed: e2e/seed.spec.ts
import type { Page } from "@playwright/test";
import { expect, logIn, test } from "../fixtures";
import { isConnected, setConnected } from "../support/agents";
import { botReply } from "../support/bot";
import { composer, messageList } from "../support/conversation-page";
import { insertBot, latestAgentRequestOf } from "../support/database";
import { openSharedChannel } from "../support/realtime";

// O resumo em Markdown que o bot do teste grava, como o Agente escreve (spec da F11, "Cliente").
const SUMMARY = [
  "# Resumo de hoje · 10/11, 00:00 a 10/11, 15:00 · 3 Mensagens",
  "",
  "- **Bruno Lima:** publicou o login em staging.",
  "- **Carla Dias:** abriu um chamado, veja https://exemplo.com/chamado/42.",
  "",
  "Nada mais foi **decidido** hoje.",
].join("\n");

// A Mensagem do Agente na Conversa: o item da lista com o nome do Agente.
function agentMessage(page: Page, channelName: string) {
  return messageList(page, channelName)
    .getByRole("listitem")
    .filter({ has: page.getByRole("button", { name: "Assistente", exact: true }) });
}

test.describe("Resumo do Agente", () => {
  test("o resumo chega às duas Pessoas em blocos do AgentText", async ({
    page,
    person,
    otherPage,
    sharedChannel,
    agentsLock,
  }) => {
    void agentsLock;
    // 1. O assistente conectado, com o bot criado; as duas Pessoas no Canal
    const wasConnected = await isConnected("assistente");
    await insertBot("Assistente", "assistente");
    await setConnected("assistente", true);
    try {
      await logIn(page, person);
      await openSharedChannel(page, otherPage, sharedChannel, person, { history: 0 });

      // 2. A Ana pede o resumo de hoje, e o bot do teste responde ao Pedido pelas rotas, antes do modelo
      const box = composer(page, sharedChannel.name);
      await box.fill("@assistente resume hoje");
      await box.press("Escape");
      await box.press("Enter");
      await expect.poll(() => latestAgentRequestOf(sharedChannel)).toMatchObject({ kind: "new" });
      const request = (await latestAgentRequestOf(sharedChannel))!;
      await botReply(request.id, SUMMARY);

      // 3. As duas abas veem o cabeçalho, a lista, o negrito e o endereço como texto, sem link
      for (const tab of [page, otherPage]) {
        const item = agentMessage(tab, sharedChannel.name);
        await expect(item).toHaveCount(1);
        await expect(item.getByText("Resumo de hoje · 10/11, 00:00 a 10/11, 15:00 · 3 Mensagens")).toHaveClass(
          /font-bold/,
        );
        const points = item.getByRole("list").getByRole("listitem");
        await expect(points).toHaveCount(2);
        await expect(points.nth(0)).toHaveText("•Bruno Lima: publicou o login em staging.");
        await expect(points.nth(0).locator("strong")).toHaveText("Bruno Lima:");
        await expect(points.nth(1)).toContainText("https://exemplo.com/chamado/42");
        await expect(item.getByRole("link")).toHaveCount(0);
        await expect(item.locator("strong", { hasText: "decidido" })).toBeVisible();
        await expect(item.getByText("**")).toHaveCount(0);
      }
    } finally {
      await setConnected("assistente", wasConnected);
    }
  });
});
