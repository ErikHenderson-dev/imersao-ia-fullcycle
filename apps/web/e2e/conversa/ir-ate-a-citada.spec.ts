// spec: e2e/plano-de-testes-f06.md
// seed: e2e/seed.spec.ts
import { expect, test } from "../fixtures";
import { composer, messageItem, readyHistory } from "../support/conversation-page";
import { insertMessages, softDeleteMessage } from "../support/database";

test.describe("Ir até a Mensagem citada", () => {
  test("vai até a original carregada e a destaca", async ({
    page,
    sharedChannel,
    person,
    otherPerson,
    loggedInPage,
  }) => {
    void loggedInPage;
    const at = Date.now() - 3_600_000;
    const [original] = await insertMessages(sharedChannel, [
      { author: otherPerson, body: "A original carregada", at: new Date(at) },
    ]);
    await insertMessages(sharedChannel, [
      ...Array.from({ length: 20 }, (_, index) => ({
        author: person,
        body: `Recheio ${index + 1}`,
        at: new Date(at + (index + 1) * 60_000),
      })),
      { author: person, body: "A resposta", at: new Date(at + 30 * 60_000), quotedMessageId: original.id },
    ]);
    await page.goto(`/conversas/${sharedChannel.id}`);
    await readyHistory(page, sharedChannel.name);

    // Pelo teclado: Enter na Citação
    const citacao = messageItem(page, sharedChannel.name, "A resposta").getByRole("button", {
      name: /Ir até a mensagem de/,
    });
    await citacao.focus();
    await page.keyboard.press("Enter");

    const alvo = page.locator(`[data-message-id="${original.id}"]`);
    await expect(alvo).toBeInViewport();
    await expect(alvo.locator("[data-highlighted]")).toBeVisible();
    await expect(alvo.locator("[data-highlighted]")).toHaveCount(0, { timeout: 5_000 });
  });

  test("carrega as anteriores até a original, sem a Mensagem nova puxar para o fim", async ({
    loggedInPage: page,
    otherPage,
    sharedChannel,
    person,
    otherPerson,
  }) => {
    const at = Date.now() - 7_200_000;
    const [original] = await insertMessages(sharedChannel, [
      { author: otherPerson, body: "A original antiga", at: new Date(at) },
    ]);
    await insertMessages(sharedChannel, [
      ...Array.from({ length: 120 }, (_, index) => ({
        author: person,
        body: `Recheio ${index + 1}`,
        at: new Date(at + (index + 1) * 30_000),
      })),
      { author: person, body: "A resposta", at: new Date(at + 121 * 30_000), quotedMessageId: original.id },
    ]);
    await page.goto(`/conversas/${sharedChannel.id}`);
    await otherPage.goto(`/conversas/${sharedChannel.id}`);
    await readyHistory(page, sharedChannel.name);
    await readyHistory(otherPage, sharedChannel.name);
    await expect(page.locator(`[data-message-id="${original.id}"]`)).toHaveCount(0);

    // A leitura das anteriores fica lenta, e uma Mensagem nova chega no meio da ida. As páginas da
    // ida são as maiores do histórico.
    const limits: (string | null)[] = [];
    await page.route("**/api/conversations/*/messages?*", async (route) => {
      limits.push(new URL(route.request().url()).searchParams.get("limit"));
      await new Promise((resolve) => setTimeout(resolve, 600));
      await route.continue();
    });
    await messageItem(page, sharedChannel.name, "A resposta")
      .getByRole("button", { name: /Ir até a mensagem de/ })
      .click();
    await expect(page.getByRole("status").filter({ hasText: "Indo até a mensagem…" })).toBeVisible();
    const caixa = composer(otherPage, sharedChannel.name);
    await caixa.fill("Chegou durante a ida");
    await caixa.press("Enter");

    const alvo = page.locator(`[data-message-id="${original.id}"]`);
    await expect(alvo).toBeInViewport({ timeout: 15_000 });
    await expect(alvo.locator("[data-highlighted]")).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Indo até a mensagem…" })).toHaveCount(0);
    expect(limits.length).toBeGreaterThan(0);
    expect(limits.every((limit) => limit === "100")).toBe(true);
  });

  test("avisa quando a original não está mais disponível", async ({
    page,
    sharedChannel,
    person,
    otherPerson,
    loggedInPage,
  }) => {
    void loggedInPage;
    const at = Date.now() - 7_200_000;
    const [original] = await insertMessages(sharedChannel, [
      { author: otherPerson, body: "A original que some", at: new Date(at) },
    ]);
    await insertMessages(sharedChannel, [
      ...Array.from({ length: 60 }, (_, index) => ({
        author: person,
        body: `Recheio ${index + 1}`,
        at: new Date(at + (index + 1) * 30_000),
      })),
      { author: person, body: "A resposta", at: new Date(at + 61 * 30_000), quotedMessageId: original.id },
    ]);
    await page.goto(`/conversas/${sharedChannel.id}`);
    await readyHistory(page, sharedChannel.name);
    // Apagada direto no banco, sem o evento: a tela ainda mostra a Citação.
    await softDeleteMessage(original.id);

    await messageItem(page, sharedChannel.name, "A resposta")
      .getByRole("button", { name: /Ir até a mensagem de/ })
      .click();

    await expect(page.getByText("A mensagem não está mais disponível")).toBeVisible();
  });
});
