// spec: e2e/plano-de-testes-f04.md
// seed: e2e/seed.spec.ts
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "../fixtures";
import { createPrivateChannel, insertUniquePerson } from "../support/add-people-step";
import { uniqueTypedChannelName } from "../support/create-channel-dialog";
import { deleteChannelsNamed } from "../support/database";

test.describe("Acessibilidade", () => {
  test("adicionar-pessoas-sem-violacoes", async ({ page, loggedInPage }) => {
    void loggedInPage;
    const { name } = uniqueTypedChannelName();
    const guest = await insertUniquePerson();
    try {
      // 1. O passo com os resultados da busca e uma escolhida
      const step = await createPrivateChannel(page, name);
      await step.getByRole("combobox", { name: "Buscar pessoas" }).fill(guest.name);
      await step.getByRole("option", { name: guest.name }).click();
      await expect(step.getByRole("list", { name: "Escolhidas" })).toBeVisible();

      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);

      // 2. O passo sem ninguém encontrado
      await step.getByRole("combobox", { name: "Buscar pessoas" }).fill(`${guest.name} inexistente`);
      await expect(step.getByText("Ninguém encontrado.")).toBeVisible();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    } finally {
      await deleteChannelsNamed([name]);
    }
  });
});
