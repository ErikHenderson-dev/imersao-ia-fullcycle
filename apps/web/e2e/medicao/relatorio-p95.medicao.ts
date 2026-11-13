// A medição do p95 do Relatório em PDF (F14-T07, CA4): da Mensagem enviada até o Aviso de início e
// até a entrega aparecerem para quem pediu, com o modelo padrão, o Worker rodando e o Banco de
// negócio de desenvolvimento carregado. Roda fora da suíte (playwright.medicao.config.ts) e imprime
// uma linha JSON por amostra e o resumo no fim; o registro fica na pasta da tarefa (medicao-p95.md).
import { expect, logIn, test } from "../fixtures";
import { isConnected, setConnected } from "../support/agents";
import { composer, messageItem, readyHistory } from "../support/conversation-page";
import { insertBot, insertChannel, latestAgentRequestOf, setDataAccessOf } from "../support/database";

const SAMPLES = 10;
// Folga do modelo e do Worker por amostra; um Pedido que não chega nela falha a medição.
const TIMEOUT_MS = 90_000;
// Espaço mínimo entre dois Pedidos da Ana, abaixo do limite de pedidos por Pessoa (10 por minuto).
const MIN_GAP_MS = 7_000;

// Pedidos completos, de períodos diferentes, que a ferramenta atende sem pergunta.
const REQUESTS = [
  "me manda um relatório de março de 2026 em PDF",
  "gera o relatório em PDF de setembro de 2026",
  "relatório em PDF do primeiro trimestre de 2026",
  "me manda o relatório de vendas de 2025 em PDF",
  "relatório em PDF de agosto de 2026",
];
const DELIVERED = "o relatório está pronto.";

declare global {
  interface Window {
    __sentAt?: number;
    __noticeAt?: number;
    __deliveredAt?: number;
  }
}

// Marca na página o envio (a Mensagem do pedido entra na lista), o aviso (o primeiro nó do Agente)
// e a entrega (o texto da entrega), como a medição da F13.
function markSendNoticeAndDelivery({
  listName,
  requestText,
  deliveredText,
}: {
  listName: string;
  requestText: string;
  deliveredText: string;
}): void {
  const list = document.querySelector(`[aria-label="${listName}"]`);
  if (!list) throw new Error("lista de Mensagens não encontrada");
  window.__sentAt = undefined;
  window.__noticeAt = undefined;
  window.__deliveredAt = undefined;
  const isAgentButton = (element: Element) =>
    element.matches("button") && element.textContent?.trim() === "Assistente";
  const isAgentItem = (node: Node) =>
    node instanceof Element && [node, ...node.querySelectorAll("button")].some(isAgentButton);
  const has = (node: Node, text: string) => node instanceof Element && !!node.textContent?.includes(text);
  const observer = new MutationObserver((records) => {
    const added = records.flatMap((record) => [...record.addedNodes]);
    const now = performance.now();
    if (window.__sentAt === undefined && added.some((node) => has(node, requestText))) window.__sentAt = now;
    if (window.__sentAt === undefined) return;
    if (window.__noticeAt === undefined && added.some(isAgentItem)) window.__noticeAt = now;
    if (window.__deliveredAt === undefined && added.some((node) => has(node, deliveredText))) {
      window.__deliveredAt = now;
      observer.disconnect();
    }
  });
  observer.observe(list, { childList: true, subtree: true });
}

test("p95 do Relatório em PDF", async ({ page, person, agentsLock }) => {
  void agentsLock;
  test.setTimeout(SAMPLES * 150_000);
  const wasConnected = await isConnected("assistente");
  await insertBot("Assistente", "assistente");
  await setConnected("assistente", true);
  await setDataAccessOf(person.id, true);
  try {
    await logIn(page, person, { waitForRealtime: false });
    const notices: number[] = [];
    const deliveries: number[] = [];
    let lastSend = 0;

    for (let sample = 1; sample <= SAMPLES; sample += 1) {
      // 1. Um Canal novo com a Ana: o aviso e a entrega de uma amostra não se confundem com outra
      const channel = await insertChannel([person]);
      await page.goto(`/conversas/${channel.id}`);
      await readyHistory(page, channel.name);

      // 2. A Ana pede, e o relógio corre da Mensagem dela até o aviso e até a entrega
      const request = `@assistente ${REQUESTS[sample % REQUESTS.length]}`;
      const box = composer(page, channel.name);
      await box.fill(request);
      await box.press("Escape");
      await page.waitForTimeout(Math.max(0, lastSend + MIN_GAP_MS - Date.now()));
      await page.evaluate(markSendNoticeAndDelivery, {
        listName: `Mensagens em #${channel.name}`,
        requestText: request,
        deliveredText: DELIVERED,
      });
      lastSend = Date.now();
      await box.press("Enter");
      // Só a entrega vale como amostra: a recusa e o "não consegui" seriam outro caminho.
      await expect(messageItem(page, channel.name, DELIVERED)).toBeVisible({ timeout: TIMEOUT_MS });
      const { notice, delivered } = await page.evaluate(() => ({
        notice: Math.round(window.__noticeAt! - window.__sentAt!),
        delivered: Math.round(window.__deliveredAt! - window.__sentAt!),
      }));
      expect(Number.isFinite(notice) && Number.isFinite(delivered), "os três instantes marcados").toBe(true);

      const agentRequest = await latestAgentRequestOf(channel);
      notices.push(notice);
      deliveries.push(delivered);
      console.log(JSON.stringify({ sample, requestId: agentRequest!.id, notice, delivered }));
    }

    // 3. O p50 e o p95 pelo posto mais próximo, do aviso e da entrega
    const summary = (values: number[]) => {
      const sorted = values.toSorted((a, b) => a - b);
      const rank = (p: number) => sorted[Math.ceil(p * sorted.length) - 1];
      return { p50: rank(0.5), p95: rank(0.95), max: sorted.at(-1), min: sorted[0] };
    };
    console.log(JSON.stringify({ notice: summary(notices), delivered: summary(deliveries) }));
  } finally {
    await setConnected("assistente", wasConnected);
  }
});
