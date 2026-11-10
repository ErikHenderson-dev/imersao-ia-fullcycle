// spec: e2e/plano-de-testes-f05.md
// seed: e2e/seed.spec.ts
import AxeBuilder from "@axe-core/playwright";
import { expect, logIn, test } from "../fixtures";
import { readyHistory } from "../support/conversation-page";
import { insertChannel, insertHistory, insertPerson } from "../support/database";
import { authorButton, profilePanel } from "../support/profile-panel";

test.describe("Acessibilidade", () => {
  test("perfil-sem-violacoes", async ({ page, person }) => {
    // 1. Abrir o Perfil completo de outra Pessoa e analisar
    const regina = await insertPerson("Regina Fonseca", {
      title: "Engenheira de Software",
      phone: "+55 11 98888-0001",
    });
    const channel = await insertChannel([person, regina]);
    await insertHistory(channel, regina, 1);
    await logIn(page, person);
    await page.goto(`/conversas/${channel.id}`);
    await readyHistory(page, channel.name);
    await authorButton(page, regina.name).click();
    await expect(profilePanel(page).getByText(`@${regina.username}`)).toBeVisible();

    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
});
