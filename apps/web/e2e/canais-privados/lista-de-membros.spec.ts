// spec: e2e/plano-de-testes-f04.md
// seed: e2e/seed.spec.ts
import { expect, test } from "../fixtures";
import { addPeopleDialog, insertUniquePerson, loggedInContext } from "../support/add-people-step";
import { readyHistory } from "../support/conversation-page";
import { insertChannel } from "../support/database";
import { waitForRealtime } from "../support/realtime";

test.describe("Lista de Membros", () => {
  test("a lista mostra os Membros com (você) e adiciona pelo passo", async ({ browser, baseURL }) => {
    // 1. Um Canal privado com duas Pessoas; a primeira abre o Canal
    const owner = await insertUniquePerson("Ana");
    const member = await insertUniquePerson("Bruno");
    const guest = await insertUniquePerson("Carla");
    const channel = await insertChannel([owner, member], { kind: "private_channel" });
    const session = await loggedInContext(browser, baseURL, owner);
    const { page } = session;
    try {
      await page.goto(`/conversas/${channel.id}`);
      await readyHistory(page, channel.name);
      await waitForRealtime(page);

      // 2. O cabeçalho mostra a quantidade e abre a lista
      await page.getByRole("button", { name: "Membros: 2" }).click();
      const dialog = page.getByRole("dialog", { name: `Membros de #${channel.name}` });
      const list = dialog.getByRole("list", { name: "Membros" });
      await expect(list.getByRole("listitem")).toHaveCount(2);
      await expect(list).toContainText(`${owner.name} (você)`);
      await expect(list).toContainText(member.name);

      // 3. "Adicionar pessoas" abre o passo; adicionar volta à lista, já com a Pessoa nova
      await dialog.getByRole("button", { name: "Adicionar pessoas" }).click();
      const step = addPeopleDialog(page, channel.name);
      await step.getByRole("combobox", { name: "Buscar pessoas" }).fill(guest.name);
      await step.getByRole("option", { name: guest.name }).click();
      await step.getByRole("button", { name: "Adicionar" }).click();
      await expect(list.getByRole("listitem")).toHaveCount(3);
      await expect(list).toContainText(guest.name);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("button", { name: "Membros: 3" })).toBeVisible();

      // 4. "Voltar" no passo volta à lista sem adicionar
      await page.getByRole("button", { name: "Membros: 3" }).click();
      await dialog.getByRole("button", { name: "Adicionar pessoas" }).click();
      await step.getByRole("button", { name: "Voltar" }).click();
      await expect(list.getByRole("listitem")).toHaveCount(3);
    } finally {
      await session.context.close();
    }
  });

  test("a quantidade e a lista mudam sem recarregar na aba da outra Pessoa", async ({
    browser,
    baseURL,
  }) => {
    // 1. As duas Pessoas no Canal privado; a segunda com a lista de Membros aberta
    const owner = await insertUniquePerson("Ana");
    const member = await insertUniquePerson("Bruno");
    const guest = await insertUniquePerson("Carla");
    const channel = await insertChannel([owner, member], { kind: "private_channel" });
    const ownerSession = await loggedInContext(browser, baseURL, owner);
    const memberSession = await loggedInContext(browser, baseURL, member);
    try {
      for (const { page } of [ownerSession, memberSession]) {
        await page.goto(`/conversas/${channel.id}`);
        await readyHistory(page, channel.name);
        await waitForRealtime(page);
      }
      await memberSession.page.getByRole("button", { name: "Membros: 2" }).click();
      const memberList = memberSession.page
        .getByRole("dialog", { name: `Membros de #${channel.name}` })
        .getByRole("list", { name: "Membros" });
      await expect(memberList.getByRole("listitem")).toHaveCount(2);

      // 2. A primeira adiciona uma terceira pela lista de Membros
      await ownerSession.page.getByRole("button", { name: "Membros: 2" }).click();
      await ownerSession.page.getByRole("button", { name: "Adicionar pessoas" }).click();
      const step = addPeopleDialog(ownerSession.page, channel.name);
      await step.getByRole("combobox", { name: "Buscar pessoas" }).fill(guest.name);
      await step.getByRole("option", { name: guest.name }).click();
      await step.getByRole("button", { name: "Adicionar" }).click();

      // 3. Na aba da segunda, a lista e a quantidade mudam sem recarregar
      await expect(memberList.getByRole("listitem")).toHaveCount(3);
      await expect(memberList).toContainText(guest.name);
      await memberSession.page.keyboard.press("Escape");
      await expect(memberSession.page.getByRole("button", { name: "Membros: 3" })).toBeVisible();
    } finally {
      await ownerSession.context.close();
      await memberSession.context.close();
    }
  });
});
