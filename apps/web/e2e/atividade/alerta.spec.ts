// spec: e2e/plano-de-testes-f08.md
// seed: e2e/seed.spec.ts
import type { Page } from "@playwright/test";
import { expect, logIn, test } from "../fixtures";
import { sendByApi } from "../support/chat-api";
import { composer, messageList, readyHistory } from "../support/conversation-page";
import { insertChannel, insertDirect, type TestPerson } from "../support/database";
import { waitForRealtime } from "../support/realtime";
import { controlTabFocus, setTabFocus } from "../support/tab-focus";
import { unreadRowName } from "../support/sidebar";

function alerts(page: Page) {
  return page.locator("[data-sonner-toast]");
}

function activityLink(page: Page) {
  return page.getByRole("navigation", { name: "Seções" }).getByRole("link", { name: /^Atividade/ });
}

// A Pessoa num Canal vazio, que a Home abre, com o tempo real conectado.
async function inFirstChannel(page: Page, person: TestPerson) {
  const primeiro = await insertChannel([person], { name: `e2e-0-${crypto.randomUUID()}` });
  await logIn(page, person);
  await readyHistory(page, primeiro.name);
  await waitForRealtime(page);
  return primeiro;
}

test.describe("Alerta na tela", () => {
  test("a Menção e a Mensagem direta alertam na aba em foco", async ({ page, person, otherPerson, otherPage }) => {
    const canal = await insertChannel([person, otherPerson], { name: `e2e-a-${crypto.randomUUID()}` });
    const direta = await insertDirect(person, otherPerson);
    await inFirstChannel(page, person);

    await sendByApi(otherPage, canal.id, `Oi @${person.username}, revisa o PR?`);
    await sendByApi(otherPage, direta.id, "Tudo bem por aí?");

    await expect(alerts(page).filter({ hasText: `${otherPerson.name} mencionou você em #${canal.name}` })).toContainText(
      "revisa o PR?",
    );
    await expect(alerts(page).filter({ hasText: `${otherPerson.name} enviou uma mensagem direta` })).toContainText(
      "Tudo bem por aí?",
    );
    await expect(alerts(page).first().getByRole("button", { name: "Abrir" })).toBeVisible();
  });

  test("o Alerta fica acima do campo de envio e fecha", async ({ page, person, otherPerson, otherPage }) => {
    const canal = await insertChannel([person, otherPerson], { name: `e2e-a-${crypto.randomUUID()}` });
    const primeiro = await inFirstChannel(page, person);
    // O campo cresce com várias linhas, e o Alerta acompanha.
    const caixa = composer(page, primeiro.name);
    await caixa.fill("Linha 1\nLinha 2\nLinha 3\nLinha 4\nLinha 5\nLinha 6");

    await sendByApi(otherPage, canal.id, `Oi @${person.username}`);

    const alerta = alerts(page).first();
    await expect(alerta).toBeVisible();
    // O toast entra subindo: a posição vale depois da animação.
    const composerTop = (await caixa.boundingBox())!.y;
    await expect
      .poll(async () => {
        const box = await alerta.boundingBox();
        return box ? box.y + box.height : Infinity;
      })
      .toBeLessThanOrEqual(composerTop);
    await caixa.click();
    await expect(caixa).toBeFocused();
    await alerta.getByRole("button", { name: /fechar|close/i }).click();
    await expect(alerts(page)).toHaveCount(0);
  });

  test("o Alerta não tira o foco e é alcançável pelo teclado", async ({ page, person, otherPerson, otherPage }) => {
    const canal = await insertChannel([person, otherPerson], { name: `e2e-a-${crypto.randomUUID()}` });
    const primeiro = await inFirstChannel(page, person);
    const caixa = composer(page, primeiro.name);
    await caixa.click();

    await sendByApi(otherPage, canal.id, `Oi @${person.username}`);

    await expect(alerts(page).first()).toBeVisible();
    await expect(caixa).toBeFocused();
    await expect(page.locator("section[aria-live='polite']")).toHaveCount(1);
    await page.keyboard.press("Alt+T");
    await expect(page.locator("[data-sonner-toaster]")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.locator(":focus")).toHaveAttribute("data-sonner-toast", "");
  });

  test("Abrir leva à Mensagem e baixa o rail", async ({ page, person, otherPerson, otherPage }) => {
    const canal = await insertChannel([person, otherPerson], { name: `e2e-a-${crypto.randomUUID()}` });
    await inFirstChannel(page, person);
    const outra = await page.context().newPage();
    await outra.goto("/atividade");
    await waitForRealtime(outra);
    await page.bringToFront();

    await sendByApi(otherPage, canal.id, `Abre aqui, @${person.username}`);
    await alerts(page).first().getByRole("button", { name: "Abrir" }).click();

    await readyHistory(page, canal.name);
    await expect(messageList(page, canal.name).getByText(`Abre aqui, @${person.username}`)).toBeVisible();
    await expect(activityLink(page)).toHaveAccessibleName("Atividade");
    await expect(activityLink(outra)).toHaveAccessibleName("Atividade");
  });

  test("só a aba em foco alerta", async ({ browser, baseURL, person, otherPerson, otherPage }) => {
    const canal = await insertChannel([person, otherPerson], { name: `e2e-a-${crypto.randomUUID()}` });
    const context = await browser.newContext({ baseURL });
    await controlTabFocus(context);
    const emFoco = await context.newPage();
    await inFirstChannel(emFoco, person);
    const semFoco = await context.newPage();
    await semFoco.goto("/atividade");
    await waitForRealtime(semFoco);
    await setTabFocus(semFoco, false);

    await sendByApi(otherPage, canal.id, `Oi @${person.username}`);

    await expect(alerts(emFoco)).toHaveCount(1);
    await expect(activityLink(semFoco)).toHaveAccessibleName(unreadRowName("Atividade", ", 1 não lida"));
    await expect(alerts(semFoco)).toHaveCount(0);
    await context.close();
  });

  test("a Conversa aberta em foco não alerta", async ({ page, person, otherPerson, otherPage }) => {
    const canal = await insertChannel([person, otherPerson], { name: `e2e-a-${crypto.randomUUID()}` });
    await logIn(page, person);
    await page.goto(`/conversas/${canal.id}`);
    await readyHistory(page, canal.name);
    await waitForRealtime(page);

    await sendByApi(otherPage, canal.id, `Aqui mesmo, @${person.username}`);

    await expect(messageList(page, canal.name).getByText(`Aqui mesmo, @${person.username}`)).toBeVisible();
    await page.waitForTimeout(500);
    await expect(alerts(page)).toHaveCount(0);
  });

  test("o que chegou durante a queda não alerta", async ({ page, context, person, otherPerson, otherPage }) => {
    const canal = await insertChannel([person, otherPerson], { name: `e2e-a-${crypto.randomUUID()}` });
    await inFirstChannel(page, person);
    await context.setOffline(true);
    await waitForRealtime(page, "disconnected");

    await sendByApi(otherPage, canal.id, `Durante a queda, @${person.username}`);
    await context.setOffline(false);

    await waitForRealtime(page);
    await expect(activityLink(page)).toHaveAccessibleName(unreadRowName("Atividade", ", 1 não lida"));
    await page.waitForTimeout(500);
    await expect(alerts(page)).toHaveCount(0);
  });
});
