// spec: e2e/plano-de-testes-f08.md
// seed: e2e/seed.spec.ts
import type { Page } from "@playwright/test";
import { expect, logIn, test } from "../fixtures";
import { readyHistory } from "../support/conversation-page";
import { insertChannel, insertDirect, insertMention, insertMessages, type TestPerson } from "../support/database";
import { waitForRealtime } from "../support/realtime";
import { sidebarLink, unreadRowName } from "../support/sidebar";

function activityLink(page: Page) {
  return page.getByRole("navigation", { name: "Seções" }).getByRole("link", { name: /^Atividade/ });
}

function markAllButton(page: Page) {
  return page.getByRole("button", { name: "Marcar tudo como lido" });
}

async function openActivity(page: Page, person: TestPerson) {
  const primeiro = await insertChannel([person], { name: `e2e-0-${crypto.randomUUID()}` });
  await logIn(page, person);
  await readyHistory(page, primeiro.name);
  await page.goto("/atividade");
  await waitForRealtime(page);
  return primeiro;
}

test.describe("Marcar tudo como lido", () => {
  test("o botão fica desabilitado sem não lidas", async ({ page, person }) => {
    await openActivity(page, person);

    await expect(markAllButton(page)).toBeDisabled();
  });

  test("a falha mostra o toast de erro", async ({ page, person, otherPerson }) => {
    const direta = await insertDirect(person, otherPerson);
    await insertMessages(direta, [{ author: otherPerson, body: "Oi", at: new Date(Date.now() - 60_000) }]);
    await page.route("**/api/activity/read", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.fulfill({ status: 502, json: { kind: "failure" } });
    });
    await openActivity(page, person);

    await markAllButton(page).click();

    await expect(markAllButton(page)).toHaveAttribute("aria-busy", "true");
    await expect(page.getByText("Não foi possível marcar como lido.")).toBeVisible();
    await expect(markAllButton(page)).toBeEnabled();
  });

  test("marcar tudo zera o rail nas duas abas e mantém o negrito da barra lateral", async ({
    page,
    person,
    otherPerson,
  }) => {
    const canal = await insertChannel([person, otherPerson], { name: `e2e-a-${crypto.randomUUID()}` });
    const [mencao] = await insertMessages(canal, [
      { author: otherPerson, body: `Oi @${person.username}`, at: new Date(Date.now() - 60_000) },
    ]);
    await insertMention(mencao.id, person);
    await openActivity(page, person);
    const outra = await page.context().newPage();
    await outra.goto("/atividade");
    await waitForRealtime(outra);
    await expect(activityLink(outra)).toHaveAccessibleName(unreadRowName("Atividade", ", 1 não lida"));

    await markAllButton(page).click();

    await expect(activityLink(page)).toHaveAccessibleName("Atividade");
    await expect(activityLink(outra)).toHaveAccessibleName("Atividade");
    const item = page.getByRole("list", { name: "Notificações" }).getByRole("link");
    await expect(item).toHaveAttribute("data-read", "true");
    await expect(markAllButton(page)).toBeDisabled();
    await expect(sidebarLink(page, unreadRowName(canal.name, ", não lidas, 1 menção"))).toBeVisible();
  });
});
