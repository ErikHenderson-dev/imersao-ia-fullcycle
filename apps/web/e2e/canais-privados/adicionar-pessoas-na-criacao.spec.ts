// spec: e2e/plano-de-testes-f04.md
// seed: e2e/seed.spec.ts
import { expect, test } from "../fixtures";
import {
  createPrivateChannel,
  insertUniquePerson,
  loggedInContext,
} from "../support/add-people-step";
import { uniqueTypedChannelName } from "../support/create-channel-dialog";
import { composer, conversationIntro, messageItem } from "../support/conversation-page";
import { deleteChannelsNamed, membersOfChannelNamed } from "../support/database";
import { sendFromComposer } from "../support/realtime";

test.describe("Adicionar Pessoas ao Canal privado", () => {
  test("adiciona pela busca e o Canal aparece para quem entrou, com as Mensagens", async ({
    page,
    browser,
    baseURL,
  }) => {
    const { name } = uniqueTypedChannelName();
    const owner = await insertUniquePerson("Ana");
    const guest = await insertUniquePerson("Bruno");
    const ownerSession = await loggedInContext(browser, baseURL, owner);
    const guestSession = await loggedInContext(browser, baseURL, guest);
    void page;
    try {
      // 1. Quem cria passa ao passo, com o foco na busca, e escolhe pelo teclado
      const step = await createPrivateChannel(ownerSession.page, name);
      const searchBox = step.getByRole("combobox", { name: "Buscar pessoas" });
      await expect(searchBox).toBeFocused();
      await ownerSession.page.keyboard.type(guest.name);
      const option = step.getByRole("option", { name: guest.name });
      await expect(option).toBeVisible();
      // A primeira da lista já vem destacada: Enter a escolhe (combobox, F05).
      await ownerSession.page.keyboard.press("Enter");
      await expect(step.getByRole("list", { name: "Escolhidas" })).toContainText(guest.name);
      await expect(step.getByRole("button", { name: `Tirar ${guest.name}` })).toBeVisible();

      // 2. Adicionar abre o Canal, agora com as duas Pessoas
      await step.getByRole("button", { name: "Adicionar" }).click();
      await expect(conversationIntro(ownerSession.page, name)).toBeVisible();
      expect((await membersOfChannelNamed(name)).sort()).toEqual([owner.id, guest.id].sort());

      // 3. O Canal aparece para quem entrou sem recarregar, com o cadeado
      const link = guestSession.page
        .getByRole("navigation", { name: "Conversas" })
        .getByRole("link", { name });
      await expect(link).toBeVisible();
      await expect(link.locator("svg.lucide-lock")).toBeVisible();

      // 4. A Mensagem de antes aparece ao abrir, e a nova chega em tempo real
      await sendFromComposer(ownerSession.page, name, "Antes de abrir");
      await expect(messageItem(ownerSession.page, name, "Antes de abrir")).toHaveCount(1);
      await link.click();
      await expect(messageItem(guestSession.page, name, "Antes de abrir")).toHaveCount(1);
      await expect(composer(guestSession.page, name)).toBeVisible();
      await sendFromComposer(ownerSession.page, name, "Em tempo real");
      await expect(messageItem(guestSession.page, name, "Em tempo real")).toHaveCount(1);
    } finally {
      await ownerSession.context.close();
      await guestSession.context.close();
      await deleteChannelsNamed([name]);
    }
  });

  test("acha pelo @usuário", async ({ browser, baseURL }) => {
    // 1. Buscar a outra Pessoa pelo @usuário dela, com o @
    const { name } = uniqueTypedChannelName();
    const owner = await insertUniquePerson("Ana");
    const guest = await insertUniquePerson("Bruno");
    const ownerSession = await loggedInContext(browser, baseURL, owner);
    try {
      const step = await createPrivateChannel(ownerSession.page, name);
      await step.getByRole("combobox", { name: "Buscar pessoas" }).fill(`@${guest.username}`);

      const option = step.getByRole("option", { name: guest.name });
      await expect(option).toBeVisible();
      await expect(option).toContainText(`@${guest.username}`);
    } finally {
      await ownerSession.context.close();
      await deleteChannelsNamed([name]);
    }
  });
});

