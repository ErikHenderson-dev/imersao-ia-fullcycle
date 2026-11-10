// spec: e2e/plano-de-testes-f07.md
// seed: e2e/seed.spec.ts
import { expect, logIn, test } from "../fixtures";
import { composer, readyHistory } from "../support/conversation-page";
import { insertChannel } from "../support/database";
import { sidebarLink, unreadRowName } from "../support/sidebar";

test.describe("Título da aba e marcador no rail", () => {
  test("o título e o marcador do Início avisam e somem ao ler", async ({
    page,
    person,
    otherPerson,
    otherPage,
  }) => {
    // O primeiro da lista, vazio: a Home o abre, e abrir uma Conversa a lê.
    const primeiro = await insertChannel([person], { name: `e2e-0-${crypto.randomUUID()}` });
    const canal = await insertChannel([person, otherPerson], { name: `e2e-a-${crypto.randomUUID()}` });
    await logIn(page, person);
    await readyHistory(page, primeiro.name);
    const inicio = page.getByRole("navigation", { name: "Seções" }).getByRole("link", { name: /^Início/ });
    await expect(page).toHaveTitle("Full Cycle Chat");
    await expect(inicio).toHaveAccessibleName("Início");
    await otherPage.goto(`/conversas/${canal.id}`);
    await readyHistory(otherPage, canal.name);

    // 1. A outra Pessoa menciona a primeira em outro Canal
    const caixa = composer(otherPage, canal.name);
    await caixa.fill(`Oi @${person.username}`);
    await caixa.press("Enter");

    // 2. O título passa a "(1) Full Cycle Chat", e o Início mostra o marcador
    await expect(page).toHaveTitle("(1) Full Cycle Chat");
    await expect(inicio).toHaveAccessibleName("Início, há mensagens não lidas");
    await expect(inicio.locator("[data-unread-marker]")).toBeVisible();

    // 3. Abrir o Canal tira os dois, e eles continuam fora ao voltar ao primeiro Canal: a leitura
    // chegou ao servidor, e não é só a Conversa aberta em foco
    await sidebarLink(page, unreadRowName(canal.name, ", não lidas, 1 menção")).click();
    await readyHistory(page, canal.name);
    await expect(page).toHaveTitle("Full Cycle Chat");
    await expect
      .poll(async () => {
        await page.goto(`/conversas/${primeiro.id}`);
        await readyHistory(page, primeiro.name);
        return page.title();
      })
      .toBe("Full Cycle Chat");
    await expect(inicio.locator("[data-unread-marker]")).toHaveCount(0);
    await expect(inicio).toHaveAccessibleName("Início");
  });
});
