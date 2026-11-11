// A medição do p95 do Pedido comum (F11-T08, CA2): da Mensagem enviada até a resposta do Agente
// aparecer para quem pediu, com o modelo padrão, numa Conversa de 500 Mensagens. Roda fora da suíte
// (playwright.medicao.config.ts) e imprime uma linha JSON por amostra e o resumo no fim; o registro
// fica na pasta da tarefa (medicao-p95.md).
import { expect, logIn, test } from "../fixtures";
import { isConnected, setConnected } from "../support/agents";
import { composer, messageList, readyHistory } from "../support/conversation-page";
import {
  insertBot,
  insertChannel,
  insertMessages,
  insertPerson,
  latestAgentRequestOf,
} from "../support/database";

const SAMPLES = 20;
const MESSAGES = 500;
// Folga do modelo por amostra; um Pedido que não responde nela falha a medição em vez de sumir dela.
const MODEL_TIMEOUT_MS = 60_000;
// Espaço mínimo entre dois Pedidos da Ana, abaixo do limite de pedidos por Pessoa (10 por minuto).
const MIN_GAP_MS = 7_000;
// O fuso padrão (LLD, "Valores e configuração"), sem horário de verão: UTC-3.
const DEFAULT_ZONE_OFFSET_MS = 3 * 3_600_000;
const DAY_MS = 86_400_000;

const LINES = [
  "Subi a correção do login em staging, podem testar.",
  "O deploy das 10h passou, mas o tempo de build subiu para 6 minutos.",
  "Revisei o PR do cadastro; falta só ajustar a validação do CPF.",
  "A reunião com o cliente ficou para quinta às 15h.",
  "Abri um chamado para o bug do envio de anexos acima de 10 MB.",
  "Atualizei a documentação da API com as rotas novas de relatórios.",
  "O banco de staging ficou lento de novo; vou olhar os índices.",
  "Combinamos congelar as mudanças na sexta antes da demo.",
  "Terminei a tela de configurações; o tema escuro está pronto.",
  "Os testes de ponta a ponta voltaram a passar depois do ajuste no seed.",
  "Preciso de alguém para revisar a migração da tabela de pedidos.",
  "O cliente pediu exportação em CSV no relatório mensal.",
  "Corrigi o fuso das notificações; agora seguem a hora local.",
  "A fila de e-mails acumulou 2 mil mensagens de manhã, já normalizou.",
  "Vou pegar a tarefa de paginação da busca hoje à tarde.",
  "O custo da nuvem caiu 12% depois que desligamos as máquinas ociosas.",
  "Marquei a retrospectiva para segunda às 10h.",
  "Encontrei um vazamento de memória no worker de imagens.",
  "A nova versão do app mobile entrou em revisão na loja.",
  "Fechei a lista de convidados da demo: 14 pessoas.",
];

test("p95 do resumo numa Conversa de 500 Mensagens", async ({ page, person, agentsLock }) => {
  void agentsLock;
  test.setTimeout(SAMPLES * 120_000);
  const wasConnected = await isConnected("assistente");
  await insertBot("Assistente", "assistente");
  await setConnected("assistente", true);
  try {
    const others = await Promise.all(["Bruno Lima", "Carla Dias", "Diego Rocha"].map((name) => insertPerson(name)));
    const authors = [person, ...others];
    await logIn(page, person, { waitForRealtime: false });
    const samples: { requestId: string; ms: number }[] = [];
    let lastSend = 0;

    for (let sample = 1; sample <= SAMPLES; sample += 1) {
      // 1. Um Canal novo com 500 Mensagens de hoje: o pedido de uma amostra não entra no Recorte de
      // outra
      const channel = await insertChannel(authors);
      const now = Date.now();
      const startOfToday =
        Math.floor((now - DEFAULT_ZONE_OFFSET_MS) / DAY_MS) * DAY_MS + DEFAULT_ZONE_OFFSET_MS;
      const start = Math.max(startOfToday + 60_000, now - 6 * 3_600_000);
      const step = (now - 60_000 - start) / MESSAGES;
      await insertMessages(
        channel,
        Array.from({ length: MESSAGES }, (_, index) => ({
          author: authors[index % authors.length],
          body: `${LINES[index % LINES.length]} (#${1000 + index})`,
          at: new Date(start + index * step),
        })),
      );
      await page.goto(`/conversas/${channel.id}`);
      await readyHistory(page, channel.name);

      // 2. A Ana pede o resumo de hoje, e o relógio corre do Enter até a Mensagem do Agente aparecer
      const box = composer(page, channel.name);
      await box.fill("@assistente resume hoje");
      await box.press("Escape");
      await page.waitForTimeout(Math.max(0, lastSend + MIN_GAP_MS - Date.now()));
      lastSend = Date.now();
      await box.press("Enter");
      const agentItem = messageList(page, channel.name)
        .getByRole("listitem")
        .filter({ has: page.getByRole("button", { name: "Assistente", exact: true }) });
      await expect(agentItem).toHaveCount(1, { timeout: MODEL_TIMEOUT_MS });
      const ms = Date.now() - lastSend;

      const request = await latestAgentRequestOf(channel);
      samples.push({ requestId: request!.id, ms });
      console.log(JSON.stringify({ sample, requestId: request!.id, ms }));
    }

    // 3. O p50 e o p95 pelo posto mais próximo
    const sorted = samples.map((entry) => entry.ms).sort((a, b) => a - b);
    const rank = (p: number) => sorted[Math.ceil(p * sorted.length) - 1];
    console.log(JSON.stringify({ p50: rank(0.5), p95: rank(0.95), max: sorted.at(-1), min: sorted[0] }));
  } finally {
    await setConnected("assistente", wasConnected);
  }
});
