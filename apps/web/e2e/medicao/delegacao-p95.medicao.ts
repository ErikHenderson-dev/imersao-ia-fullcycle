// A medição do p95 do Pedido de delegação completo (F12-T06, CA4): da Mensagem enviada até a
// confirmação da Tarefa aparecer para quem pediu, com o modelo padrão. Roda fora da suíte
// (playwright.medicao.config.ts) e imprime uma linha JSON por amostra e o resumo no fim; o registro
// fica na pasta da tarefa (medicao-p95.md).
import { expect, logIn, test } from "../fixtures";
import { isConnected, setConnected } from "../support/agents";
import { agentMessage, composer, readyHistory } from "../support/conversation-page";
import { insertBot, insertChannel, insertPerson, latestAgentRequestOf } from "../support/database";

const SAMPLES = 20;
// Folga do modelo por amostra; um Pedido que não responde nela falha a medição em vez de sumir dela.
const MODEL_TIMEOUT_MS = 60_000;
// Espaço mínimo entre dois Pedidos da Ana, abaixo do limite de pedidos por Pessoa (10 por minuto).
const MIN_GAP_MS = 7_000;

const TASKS = [
  "revisar o contrato da Acme até sexta",
  "atualizar a planilha de custos",
  "publicar as notas da versão",
  "corrigir o bug do envio de anexos",
  "marcar a retrospectiva de segunda",
];

declare global {
  interface Window {
    __sentAt?: number;
    __agentReplyAt?: number;
  }
}

// Marca na página o envio (a Mensagem do pedido entra na lista) e a resposta (entra o primeiro nó
// com o botão do nome do Agente), como a medição da F11.
function markSendAndAgentReply({ listName, requestText }: { listName: string; requestText: string }): void {
  const list = document.querySelector(`[aria-label="${listName}"]`);
  if (!list) throw new Error("lista de Mensagens não encontrada");
  window.__sentAt = undefined;
  window.__agentReplyAt = undefined;
  const isAgentButton = (element: Element) =>
    element.matches("button") && element.textContent?.trim() === "Assistente";
  const isAgentItem = (node: Node) =>
    node instanceof Element && [node, ...node.querySelectorAll("button")].some(isAgentButton);
  const isRequest = (node: Node) => node instanceof Element && !!node.textContent?.includes(requestText);
  const observer = new MutationObserver((records) => {
    const added = records.flatMap((record) => [...record.addedNodes]);
    if (window.__sentAt === undefined && added.some(isRequest)) window.__sentAt = performance.now();
    if (window.__sentAt !== undefined && added.some(isAgentItem)) {
      window.__agentReplyAt = performance.now();
      observer.disconnect();
    }
  });
  observer.observe(list, { childList: true, subtree: true });
}

test("p95 da delegação de Tarefa", async ({ page, person, agentsLock }) => {
  void agentsLock;
  test.setTimeout(SAMPLES * 90_000);
  const wasConnected = await isConnected("assistente");
  await insertBot("Assistente", "assistente");
  await setConnected("assistente", true);
  try {
    const bruno = await insertPerson("Bruno Lima");
    await logIn(page, person, { waitForRealtime: false });
    const durations: number[] = [];
    let lastSend = 0;

    for (let sample = 1; sample <= SAMPLES; sample += 1) {
      // 1. Um Canal novo com a Ana e o Bruno: a confirmação de uma amostra não se confunde com outra
      const channel = await insertChannel([person, bruno]);
      await page.goto(`/conversas/${channel.id}`);
      await readyHistory(page, channel.name);

      // 2. A Ana pede a delegação, e o relógio corre da Mensagem dela até a do Agente
      const request = `@assistente delega pra @${bruno.username} ${TASKS[sample % TASKS.length]}`;
      const box = composer(page, channel.name);
      await box.fill(request);
      await box.press("Escape");
      await page.waitForTimeout(Math.max(0, lastSend + MIN_GAP_MS - Date.now()));
      await page.evaluate(markSendAndAgentReply, {
        listName: `Mensagens em #${channel.name}`,
        requestText: request,
      });
      lastSend = Date.now();
      await box.press("Enter");
      const reply = agentMessage(page, channel.name);
      await expect(reply).toHaveCount(1, { timeout: MODEL_TIMEOUT_MS });
      // Só a confirmação vale como amostra: a recusa e o "não consegui" seriam outro caminho.
      await expect(reply, "a resposta é a confirmação da Tarefa").toContainText("Tarefa delegada a");
      const ms = Math.round(await page.evaluate(() => window.__agentReplyAt! - window.__sentAt!));
      expect(Number.isFinite(ms), "o envio e a resposta marcados na página").toBe(true);

      const agentRequest = await latestAgentRequestOf(channel);
      durations.push(ms);
      console.log(JSON.stringify({ sample, requestId: agentRequest!.id, ms }));
    }

    // 3. O p50 e o p95 pelo posto mais próximo
    const sorted = durations.sort((a, b) => a - b);
    const rank = (p: number) => sorted[Math.ceil(p * sorted.length) - 1];
    console.log(JSON.stringify({ p50: rank(0.5), p95: rank(0.95), max: sorted.at(-1), min: sorted[0] }));
  } finally {
    await setConnected("assistente", wasConnected);
  }
});
