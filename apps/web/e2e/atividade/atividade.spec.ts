// spec: e2e/plano-de-testes-f08.md
// seed: e2e/seed.spec.ts
import type { Page } from "@playwright/test";
import { expect, logIn, test } from "../fixtures";
import {
  insertChannel,
  insertDirect,
  insertMention,
  insertMessages,
  type TestChannel,
  type TestPerson,
} from "../support/database";
import { readyHistory } from "../support/conversation-page";
import { unreadRowName } from "../support/sidebar";

// Uma Menção num Canal e uma Mensagem numa Conversa direta para `person`, de `otherPerson`, e um
// primeiro Canal vazio, que a Home abre.
async function notificationsFor(person: TestPerson, otherPerson: TestPerson) {
  const primeiro = await insertChannel([person], { name: `e2e-0-${crypto.randomUUID()}` });
  const canal = await insertChannel([person, otherPerson], { name: `e2e-a-${crypto.randomUUID()}` });
  const direta = await insertDirect(person, otherPerson);
  const at = Date.now() - 5 * 60_000;
  const [mencao] = await insertMessages(canal, [
    { author: otherPerson, body: `Oi @${person.username}, revisa?`, at: new Date(at) },
  ]);
  await insertMention(mencao.id, person);
  await insertMessages(direta, [{ author: otherPerson, body: "Tudo bem por aí?", at: new Date(at + 1000) }]);
  return { primeiro, canal, direta };
}

function activityList(page: Page) {
  return page.getByRole("list", { name: "Notificações" });
}

async function openActivity(page: Page, person: TestPerson, primeiro: TestChannel, path = "/atividade") {
  await logIn(page, person);
  await readyHistory(page, primeiro.name);
  await page.goto(path);
  await expect(page.getByRole("heading", { name: "Atividade" })).toBeVisible();
}

test.describe("Atividade ao carregar a página", () => {
  test("a Atividade lista as Menções e as Mensagens diretas", async ({ page, person, otherPerson }) => {
    const { primeiro, canal } = await notificationsFor(person, otherPerson);

    await openActivity(page, person, primeiro);

    // A mais nova em cima: a Mensagem direta e depois a Menção, as duas não lidas
    const itens = activityList(page).getByRole("link");
    await expect(itens).toHaveCount(2);
    await expect(itens.nth(0)).toHaveAccessibleName(
      new RegExp(`^${otherPerson.name} enviou uma mensagem direta\\s*há 5 min\\s*Tudo bem por aí\\?\\s*, não lida$`),
    );
    await expect(itens.nth(1)).toHaveAccessibleName(
      new RegExp(`^${otherPerson.name} mencionou você em #${canal.name}.*, não lida$`),
    );
    // Enter no item abre a Conversa dele
    await itens.nth(1).focus();
    await page.keyboard.press("Enter");
    await readyHistory(page, canal.name);
  });

  test("rolar carrega as Notificações mais antigas", async ({ page, person, otherPerson }) => {
    const primeiro = await insertChannel([person], { name: `e2e-0-${crypto.randomUUID()}` });
    const direta = await insertDirect(person, otherPerson);
    const start = Date.now() - 2 * 86_400_000;
    await insertMessages(
      direta,
      Array.from({ length: 60 }, (_, index) => ({
        author: otherPerson,
        body: `Mensagem ${index + 1}`,
        at: new Date(start + index * 60_000),
      })),
    );

    await openActivity(page, person, primeiro);

    const itens = activityList(page).getByRole("link");
    await expect(itens).toHaveCount(50);
    await itens.last().scrollIntoViewIfNeeded();
    await expect(itens).toHaveCount(60);
    await expect(itens.last()).toHaveAccessibleName(/enviou uma mensagem direta.*Mensagem 1\s*, não lida$/);
  });

  test("o rail mostra Atividade com o número de não lidas", async ({ page, person, otherPerson }) => {
    const { primeiro } = await notificationsFor(person, otherPerson);

    await logIn(page, person);
    await readyHistory(page, primeiro.name);

    const secoes = page.getByRole("navigation", { name: "Seções" });
    const atividade = secoes.getByRole("link", { name: /^Atividade/ });
    const inicio = secoes.getByRole("link", { name: /^Início/ });
    await expect(atividade).toHaveAccessibleName(unreadRowName("Atividade", ", 2 não lidas"));
    await expect(inicio).toHaveAttribute("aria-current", "page");
    await atividade.click();
    await expect(page).toHaveURL(/\/atividade$/);
    await expect(atividade).toHaveAttribute("aria-current", "page");
    await expect(inicio).not.toHaveAttribute("aria-current");
    // O marcador do Início da F07 vale também na tela Atividade
    await expect(inicio).toHaveAccessibleName("Início, há mensagens não lidas");
    await expect(inicio.locator("[data-unread-marker]")).toBeVisible();
  });

  test("as abas filtram por tipo e mostram os contadores", async ({ page, person, otherPerson }) => {
    const { primeiro } = await notificationsFor(person, otherPerson);

    await openActivity(page, person, primeiro);

    const abas = page.getByRole("navigation", { name: "Tipos de atividade" });
    await expect(abas.getByRole("link", { name: unreadRowName("Todas", ", 2 não lidas") })).toHaveAttribute("aria-current", "page");
    await expect(abas.getByRole("link", { name: unreadRowName("Menções", ", 1 não lida") })).toBeVisible();
    await expect(abas.getByRole("link", { name: unreadRowName("Mensagens diretas", ", 1 não lida") })).toBeVisible();
    await abas.getByRole("link", { name: /^Menções/ }).click();
    await expect(page).toHaveURL(/\/atividade\?aba=mencoes$/);
    await expect(activityList(page).getByRole("link")).toHaveCount(1);
    await expect(activityList(page).getByRole("link")).toHaveAccessibleName(/mencionou você/);
    await abas.getByRole("link", { name: /^Mensagens diretas/ }).click();
    await expect(page).toHaveURL(/\/atividade\?aba=diretas$/);
    await expect(activityList(page).getByRole("link")).toHaveAccessibleName(/enviou uma mensagem direta/);
  });

  test("cada aba vazia mostra o seu vazio", async ({ page, person }) => {
    const primeiro = await insertChannel([person], { name: `e2e-0-${crypto.randomUUID()}` });

    await openActivity(page, person, primeiro);

    await expect(page.getByRole("main").getByText("Menções e mensagens diretas aparecem aqui assim que chegam.")).toBeVisible();
    await page.goto("/atividade?aba=mencoes");
    await expect(page.getByRole("main").getByText("Quando alguém mencionar você com @, a mensagem aparece aqui.")).toBeVisible();
    await page.goto("/atividade?aba=diretas");
    await expect(page.getByRole("main").getByText("Novas mensagens diretas aparecem aqui.")).toBeVisible();
  });

  test("a falha ao carregar mais mostra o erro com Tentar de novo", async ({ page, person, otherPerson }) => {
    const primeiro = await insertChannel([person], { name: `e2e-0-${crypto.randomUUID()}` });
    const direta = await insertDirect(person, otherPerson);
    const start = Date.now() - 86_400_000;
    await insertMessages(
      direta,
      Array.from({ length: 55 }, (_, index) => ({
        author: otherPerson,
        body: `Mensagem ${index + 1}`,
        at: new Date(start + index * 60_000),
      })),
    );
    let failing = true;
    await page.route("**/api/activity?*", (route) =>
      failing ? route.fulfill({ status: 502, json: { kind: "failure" } }) : route.continue(),
    );

    await openActivity(page, person, primeiro);

    const itens = activityList(page).getByRole("link");
    await itens.last().scrollIntoViewIfNeeded();
    const alerta = page.getByRole("alert").filter({ hasText: "Não foi possível carregar mais notificações." });
    await expect(alerta).toBeVisible();
    failing = false;
    await alerta.getByRole("button", { name: "Tentar de novo" }).click();
    await expect(itens).toHaveCount(55);
  });

  test("tudo pelo teclado", async ({ page, person, otherPerson }) => {
    const { primeiro, direta } = await notificationsFor(person, otherPerson);

    await openActivity(page, person, primeiro);

    const abas = page.getByRole("navigation", { name: "Tipos de atividade" });
    await abas.getByRole("link", { name: /^Todas/ }).focus();
    await page.keyboard.press("Tab");
    await expect(abas.getByRole("link", { name: /^Menções/ })).toBeFocused();
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    // A aba Tarefas (F12-T02) vem depois de Mensagens diretas.
    await expect(abas.getByRole("link", { name: /^Tarefas/ })).toBeFocused();
    await page.keyboard.press("Tab");
    const primeiroItem = activityList(page).getByRole("link").first();
    await expect(primeiroItem).toBeFocused();
    await page.keyboard.press("Enter");
    // Na Conversa: a ida até a Mensagem (F08-T02) tira o `?mensagem=` ao terminar.
    await expect(page).toHaveURL(new RegExp(`/conversas/${direta.id}`));
  });
});
