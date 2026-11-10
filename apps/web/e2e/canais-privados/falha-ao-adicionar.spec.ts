// spec: e2e/plano-de-testes-f04.md
// seed: e2e/seed.spec.ts
import { expect, test } from "../fixtures";
import { createPrivateChannel, insertUniquePerson } from "../support/add-people-step";
import { uniqueTypedChannelName } from "../support/create-channel-dialog";
import { conversationIntro } from "../support/conversation-page";
import { deleteChannelsNamed, membersOfChannelNamed } from "../support/database";
import { routeServerAction } from "../support/server-action";

test.describe("Adicionar Pessoas ao Canal privado", () => {
  test("a falha mantém as escolhidas e a nova tentativa adiciona", async ({
    page,
    person,
    loggedInPage,
  }) => {
    void loggedInPage;
    const { name } = uniqueTypedChannelName();
    const guest = await insertUniquePerson();
    try {
      // 1. Com a adição fora do ar, escolher e adicionar
      const step = await createPrivateChannel(page, name);
      const restore = await routeServerAction(page, (route) => route.abort());
      await step.getByRole("combobox", { name: "Buscar pessoas" }).fill(guest.name);
      await step.getByRole("option", { name: guest.name }).click();
      await step.getByRole("button", { name: "Adicionar" }).click();

      // 2. O erro aparece, e a escolhida continua lá
      await expect(step.getByText("Não foi possível adicionar as pessoas. Tente de novo.")).toBeVisible();
      await expect(step.getByRole("list", { name: "Escolhidas" })).toContainText(guest.name);
      expect(await membersOfChannelNamed(name)).toEqual([person.id]);

      // 3. Com a rede de volta, a nova tentativa adiciona e abre o Canal
      await restore();
      await step.getByRole("button", { name: "Adicionar" }).click();
      await expect(conversationIntro(page, name)).toBeVisible();
      expect((await membersOfChannelNamed(name)).sort()).toEqual([person.id, guest.id].sort());
    } finally {
      await deleteChannelsNamed([name]);
    }
  });
});
