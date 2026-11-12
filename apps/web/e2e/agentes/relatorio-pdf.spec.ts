// spec: e2e/plano-de-testes-f14.md
// seed: e2e/seed.spec.ts
import { readFile } from "node:fs/promises";
import { expect, logIn, test } from "../fixtures";
import { isConnected, setConnected } from "../support/agents";
import { BLOCKED_NOTICE } from "../support/bot";
import { composer, messageItem, messageList } from "../support/conversation-page";
import { insertBot, setDataAccessOf } from "../support/database";
import { openSharedChannel, sendFromComposer } from "../support/realtime";

// O modelo real grava o aviso em alguns segundos, e o Worker entrega o PDF logo depois.
const MODEL_TIMEOUT_MS = 60_000;
const NOTICE = "Comecei a gerar o relatório de 01/03/2026 a 31/03/2026. Ele chega aqui quando ficar pronto.";
const FILE_NAME = "relatorio-2026-03-01-a-2026-03-31.pdf";

test.describe("Relatório em PDF pedido ao Agente", () => {
  test("a Pessoa com permissão pede o Relatório, segue conversando e baixa o PDF", async ({
    page,
    person,
    otherPage,
    sharedChannel,
    agentsLock,
  }) => {
    void agentsLock;
    test.setTimeout(180_000);
    // 1. O assistente conectado, com o bot criado; a Ana com Permissão de dados, o Bruno sem
    const wasConnected = await isConnected("assistente");
    await insertBot("Assistente", "assistente");
    await setConnected("assistente", true);
    await setDataAccessOf(person.id, true);
    try {
      await logIn(page, person);
      await openSharedChannel(page, otherPage, sharedChannel, person, { history: 0 });

      // 2. A Ana pede o Relatório de março de 2026 e vê o aviso
      const box = composer(page, sharedChannel.name);
      await box.fill("@assistente me manda um relatório de março de 2026 em PDF");
      await box.press("Escape");
      await box.press("Enter");
      await expect(messageList(page, sharedChannel.name)).toContainText(NOTICE, { timeout: MODEL_TIMEOUT_MS });

      // 3. A Ana segue conversando, e a entrega chega com o cartão
      await sendFromComposer(page, sharedChannel.name, "Enquanto isso, bora revisar o deploy");
      const delivery = messageItem(page, sharedChannel.name, "o relatório está pronto.");
      await expect(delivery).toContainText(FILE_NAME, { timeout: MODEL_TIMEOUT_MS });

      // 4. "Baixar" baixa um PDF
      const download = page.waitForEvent("download");
      await delivery.getByRole("link", { name: `Baixar ${FILE_NAME}` }).click();
      const file = await download;
      expect((await readFile((await file.path())!, "latin1")).startsWith("%PDF")).toBe(true);

      // 5. O Bruno vê o aviso e a entrega bloqueados, sem recarregar
      const toBruno = messageList(otherPage, sharedChannel.name);
      await expect(toBruno.getByText(BLOCKED_NOTICE, { exact: true })).toHaveCount(2);
      await expect(toBruno).not.toContainText(FILE_NAME);
    } finally {
      await setConnected("assistente", wasConnected);
    }
  });
});
