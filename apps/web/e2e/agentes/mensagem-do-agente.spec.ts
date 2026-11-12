// spec: e2e/plano-de-testes-f11.md
// seed: e2e/seed.spec.ts
import type { MessagePayload } from "chat-events";
import { expect, logIn, test } from "../fixtures";
import { agentsDialog } from "../support/agents-dialog";
import { messageItem, readyHistory } from "../support/conversation-page";
import { insertBot, insertMessages } from "../support/database";
import { openSharedChannel } from "../support/realtime";

const API = "http://localhost:3001/v1";

test.describe("Mensagem do Agente", () => {
  test("a Mensagem do Agente no histórico abre o diálogo Agentes", async ({ loggedInPage: page, memberChannel }) => {
    // 1. Uma Mensagem de bot no Canal
    const bot = await insertBot("Assistente");
    await insertMessages(memberChannel, [{ author: bot, body: "Resumo de hoje: nada novo.", at: new Date() }]);
    await page.goto(`/conversas/${memberChannel.id}`);
    await readyHistory(page, memberChannel.name);

    // 2. O nome, o AgentTag e o texto, sem o Status
    const item = messageItem(page, memberChannel.name, "Resumo de hoje: nada novo.");
    const name = item.getByRole("button", { name: "Assistente", exact: true });
    await expect(name).toBeVisible();
    await expect(item.getByText("AGENTE", { exact: true })).toBeVisible();

    // 3. Clicar no nome abre o diálogo; Esc devolve o foco ao nome
    await name.click();
    await expect(agentsDialog(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(agentsDialog(page)).toBeHidden();
    await expect(name).toBeFocused();

    // 4. Clicar no avatar também abre
    await item.locator('button[aria-hidden="true"]').click();
    await expect(agentsDialog(page)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(name).toBeFocused();

    // 5. Enter no nome abre
    await page.keyboard.press("Enter");
    await expect(agentsDialog(page)).toBeVisible();
  });

  test("a Mensagem do Agente chega à outra Pessoa sem recarregar", async ({
    page,
    person,
    otherPage,
    sharedChannel,
  }) => {
    // 1. O WebSocket do Bruno passa pelo teste, para receber o evento da Mensagem de bot
    let injectToOther: (frame: string) => void = () => {};
    await otherPage.routeWebSocket(/\/socket\.io\//, (socket) => {
      socket.connectToServer();
      injectToOther = (frame) => socket.send(frame);
    });
    await logIn(page, person);
    await openSharedChannel(page, otherPage, sharedChannel, person, { history: 0 });

    // 2. A Mensagem de bot gravada aparece para a Ana no histórico
    const bot = await insertBot("Assistente");
    const [inserted] = await insertMessages(sharedChannel, [
      { author: bot, body: "Resumo para as duas Pessoas.", at: new Date() },
    ]);
    await page.reload();
    await readyHistory(page, sharedChannel.name);
    const own = messageItem(page, sharedChannel.name, "Resumo para as duas Pessoas.");
    await expect(own.getByText("AGENTE", { exact: true })).toBeVisible();

    // 3. O message.created dela, com a Mensagem como a API do chat a devolve, chega ao Bruno
    const response = await page.request.get(`${API}/conversations/${sharedChannel.id}/messages`);
    const { messages } = (await response.json()) as { messages: MessagePayload[] };
    const payload = messages.find((message) => message.id === inserted.id)!;
    expect(payload.author).toEqual({ kind: "bot", id: bot.id, name: "Assistente", username: bot.username });
    injectToOther(`42${JSON.stringify(["message.created", { message: payload }])}`);

    const other = messageItem(otherPage, sharedChannel.name, "Resumo para as duas Pessoas.");
    await expect(other.getByRole("button", { name: "Assistente", exact: true })).toBeVisible();
    await expect(other.getByText("AGENTE", { exact: true })).toBeVisible();
  });
});
