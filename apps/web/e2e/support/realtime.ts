import { expect, type Page } from "@playwright/test";
import { composer, readyHistory } from "./conversation-page";
import { insertHistory, type TestChannel, type TestPerson } from "./database";

// Espera o socket da aba no estado dado (conectado, sem ele): o provedor do tempo real marca o
// estado em data-realtime.
export async function waitForRealtime(
  page: Page,
  status: "connected" | "disconnected" = "connected",
): Promise<void> {
  await expect(page.locator("[data-realtime]")).toHaveAttribute("data-realtime", status, {
    timeout: 15_000,
  });
}

// A faixa de conexão no topo da Casca.
export function connectionBanner(page: Page) {
  return page.getByRole("status").filter({ hasText: "Sem conexão em tempo real. Reconectando…" });
}

// Os WebSockets da página com a API do chat que estão abertos agora. Conta os abertos, e não os
// criados: no next dev, o modo estrito do React monta o provedor duas vezes, e o primeiro socket
// fecha logo.
export function openRealtimeSockets(page: Page): { count: () => number } {
  let open = 0;
  page.on("websocket", (socket) => {
    if (!socket.url().includes("/socket.io/")) return;
    open += 1;
    socket.on("close", () => {
      open -= 1;
    });
  });
  return { count: () => open };
}

// Escreve e envia uma Mensagem pela caixa de mensagem do Canal aberto.
export async function sendFromComposer(page: Page, channelName: string, text: string): Promise<void> {
  const box = composer(page, channelName);
  await box.fill(text);
  await box.press("Enter");
}

// As duas Pessoas no Canal em comum, conectadas, com histórico para rolar (sem ele, `history: 0`);
// devolve o histórico da primeira.
export async function openSharedChannel(
  page: Page,
  otherPage: Page,
  channel: TestChannel,
  person: TestPerson,
  { history = 40 }: { history?: number } = {},
) {
  if (history > 0) await insertHistory(channel, person, history);
  await page.goto(`/conversas/${channel.id}`);
  await otherPage.goto(`/conversas/${channel.id}`);
  await waitForRealtime(page);
  await waitForRealtime(otherPage);
  // As duas abas com a Conversa aberta no WebSocket (o histórico em dia com o tempo real): sem
  // isso, o primeiro "digitando" de uma aba que ainda não entrou na sala se perde.
  await readyHistory(otherPage, channel.name);
  return readyHistory(page, channel.name);
}
