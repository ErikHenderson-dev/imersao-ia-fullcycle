// spec: e2e/plano-de-testes-f02.md
// seed: e2e/seed.spec.ts
import { expect, test } from "../fixtures";
import { conversationIntro, messageList, readyHistory } from "../support/conversation-page";
import { insertHistory } from "../support/database";

test.describe("Histórico até a primeira Mensagem", () => {
  test("carregar-anteriores-pelo-teclado", async ({
    page,
    person,
    memberChannel: channel,
    loggedInPage,
  }) => {
    void loggedInPage;
    // Sem o IntersectionObserver, só o teclado pede as anteriores: focar o link o rolaria para a
    // tela, e o sentinela carregaria sozinho.
    await page.addInitScript(() => {
      window.IntersectionObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords() {
          return [];
        }
      } as unknown as typeof IntersectionObserver;
    });
    // 1. Abrir um Canal com duas páginas de histórico
    await insertHistory(channel, person, 60);
    await page.goto(`/conversas/${channel.id}`);
    const historico = await readyHistory(page, channel.name);
    const mensagens = messageList(page, channel.name);
    const caixa = page.getByRole("textbox", { name: `Mensagem para #${channel.name}` });
    await expect(caixa).toBeFocused();

    // 2. A área de rolagem recebe o foco e rola pelas teclas. Entre a caixa e o botão ficam os
    // nomes da autora nas Mensagens que abrem um grupo, que abrem o Perfil (F05): um por dia à vista.
    const botao = page.getByRole("button", { name: "Carregar mensagens anteriores" });
    const nomes = page.getByRole("main").getByRole("button", { name: person.name, exact: true });
    const paradasDeNome = await nomes.count();
    expect(paradasDeNome).toBeGreaterThan(0);
    for (let i = 0; i < paradasDeNome; i += 1) {
      await page.keyboard.press("Shift+Tab");
      await expect(nomes.nth(paradasDeNome - 1 - i)).toBeFocused();
    }
    await page.keyboard.press("Shift+Tab");
    await expect(botao).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(historico).toBeFocused();
    await page.keyboard.press("End");
    // A rolagem pelo teclado é suave: espera chegar ao fim antes de medir.
    const fim = await historico.evaluate(
      (element) => element.scrollHeight - element.clientHeight,
    );
    await expect
      .poll(() => historico.evaluate((element) => element.scrollTop))
      .toBeGreaterThanOrEqual(fim - 1);
    await page.keyboard.press("PageUp");
    await expect.poll(() => historico.evaluate((element) => element.scrollTop)).toBeLessThan(fim);

    // 3. Tab até "Carregar mensagens anteriores" e Enter
    await page.keyboard.press("Tab");
    await expect(botao).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(mensagens.getByRole("listitem")).toHaveCount(60);
    // O botão sai com a última página, e o foco vai para a área do histórico.
    await expect(historico).toBeFocused();
    await expect(
      conversationIntro(page, channel.name),
    ).toBeVisible();
  });
});
