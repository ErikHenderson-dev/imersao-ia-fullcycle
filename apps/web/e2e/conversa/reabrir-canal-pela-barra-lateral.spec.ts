// spec: e2e/plano-de-testes-f02.md
// seed: e2e/seed.spec.ts
import { expect, test } from "../fixtures";
import { insertChannel } from "../support/database";

test.describe("Abrir um Canal", () => {
  test("reabrir-canal-pela-barra-lateral", async ({ page, person, loggedInPage }) => {
    void loggedInPage;
    const second = await insertChannel([person], { name: `e2e-b-${person.id}` });
    const first = await insertChannel([person], { name: `e2e-a-${person.id}` });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`/conversas/${first.id}`);
    const canais = page.getByRole("region", { name: "Canais" });

    // Abrir um Canal já aberto antes, pela barra lateral, várias vezes.
    for (const channel of [second, first, second, first]) {
      await canais.getByRole("link", { name: channel.name }).click();
      await expect(page).toHaveURL(`/conversas/${channel.id}`);
      await expect(page.getByRole("heading", { level: 1, name: channel.name })).toBeVisible();
      await expect(page.getByRole("textbox", { name: `Mensagem para #${channel.name}` })).toBeVisible();
    }
    expect(errors).toEqual([]);
  });
});
