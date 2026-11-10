// spec: e2e/plano-de-testes-f05.md
// seed: e2e/seed.spec.ts
import { expect, logIn, test } from "../fixtures";
import { readyConversation, readyHistory } from "../support/conversation-page";
import { insertChannel, insertHistory, insertPerson } from "../support/database";
import { authorButton, profilePanel } from "../support/profile-panel";
import { routeServerAction } from "../support/server-action";
import type { Page } from "@playwright/test";

function directMessages(page: Page) {
  return page.getByRole("region", { name: "Mensagens diretas" });
}

test.describe("Abrir a Conversa direta pelo Perfil", () => {
  test("abre a Conversa direta pelo Perfil e reabrir cai na mesma", async ({ page, person }) => {
    // 1. O Perfil da Regina, pelo nome dela numa Mensagem
    const regina = await insertPerson("Regina Fonseca");
    const channel = await insertChannel([person, regina]);
    await insertHistory(channel, regina, 1);
    await logIn(page, person);
    await page.goto(`/conversas/${channel.id}`);
    await readyHistory(page, channel.name);
    await authorButton(page, regina.name).click();

    // 2. "Mensagem", pelo teclado
    await profilePanel(page).getByRole("button", { name: "Mensagem" }).press("Enter");

    await readyConversation(page, regina.name);
    await expect(page).toHaveURL(/\/conversas\//);
    const conversationUrl = page.url();
    await expect(page.getByRole("textbox", { name: "Mensagem para Regina" })).toBeFocused();
    await expect(
      page.getByRole("heading", { name: `Este é o começo da sua conversa direta com ${regina.name}.` }),
    ).toBeVisible();
    await expect(directMessages(page).getByRole("link", { name: regina.name })).toBeVisible();
    await expect(page.getByRole("button", { name: /^Membros/ })).toHaveCount(0);

    // 3. Reabrir pelo Perfil, a partir do Canal, cai na mesma Conversa
    await page.goto(`/conversas/${channel.id}`);
    await readyHistory(page, channel.name);
    await authorButton(page, regina.name).click();
    await profilePanel(page).getByRole("button", { name: "Mensagem" }).click();
    await expect(page).toHaveURL(conversationUrl);
    await expect(directMessages(page).getByRole("link", { name: regina.name })).toHaveCount(1);
  });

  test("a Conversa consigo mesma aparece com você", async ({ loggedInPage: page, person }) => {
    // 1. O próprio Perfil, pelo menu do avatar
    await page.getByRole("button", { name: `Menu de ${person.name}` }).click();
    await page.getByRole("menuitem", { name: "Perfil", exact: true }).click();
    await profilePanel(page).getByRole("button", { name: "Mensagem" }).click();

    await expect(page.getByRole("textbox", { name: "Mensagem para você" })).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "Este é o seu espaço. Guarde lembretes e rascunhos aqui; só você vê.",
      }),
    ).toBeVisible();
    await expect(directMessages(page).getByRole("link", { name: `${person.name} você` })).toBeVisible();
  });

  test("o cabeçalho abre o Perfil da outra Pessoa", async ({ page, person, otherPerson, sharedChannel }) => {
    // 1. Abrir a Conversa direta com a outra Pessoa
    await insertHistory(sharedChannel, otherPerson, 1);
    await logIn(page, person);
    await page.goto(`/conversas/${sharedChannel.id}`);
    await readyHistory(page, sharedChannel.name);
    await authorButton(page, otherPerson.name).click();
    await profilePanel(page).getByRole("button", { name: "Mensagem" }).click();
    await readyConversation(page, otherPerson.name);
    await profilePanel(page).getByRole("button", { name: "Fechar perfil" }).click();

    // 2. O nome no cabeçalho
    await page.getByRole("heading", { level: 1 }).getByRole("button", { name: otherPerson.name }).click();

    await expect(profilePanel(page).getByText(`@${otherPerson.username}`)).toBeVisible();

    // 3. "Mensagem" na própria Conversa direta não prende o botão em "Abrindo"
    await profilePanel(page).getByRole("button", { name: "Mensagem" }).click();
    await expect(profilePanel(page).getByRole("button", { name: "Mensagem" })).toBeEnabled();
  });

  test("a Conversa aparece em outra aba sem recarregar", async ({ page, person, otherPerson, sharedChannel }) => {
    // 1. Uma segunda aba da mesma Pessoa, aberta antes
    await insertHistory(sharedChannel, otherPerson, 1);
    await logIn(page, person);
    const secondTab = await page.context().newPage();
    await secondTab.goto(`/conversas/${sharedChannel.id}`);
    await readyHistory(secondTab, sharedChannel.name);
    await page.goto(`/conversas/${sharedChannel.id}`);
    await readyHistory(page, sharedChannel.name);

    // 2. Abrir a Conversa direta na primeira aba
    await authorButton(page, otherPerson.name).click();
    await profilePanel(page).getByRole("button", { name: "Mensagem" }).click();

    await expect(directMessages(secondTab).getByRole("link", { name: otherPerson.name })).toBeVisible();
  });

  test("a falha ao abrir aparece no painel e tenta de novo", async ({ page, person, otherPerson, sharedChannel }) => {
    // 1. A primeira abertura falha
    await insertHistory(sharedChannel, otherPerson, 1);
    await logIn(page, person);
    await page.goto(`/conversas/${sharedChannel.id}`);
    await readyHistory(page, sharedChannel.name);
    let failures = 0;
    await routeServerAction(
      page,
      (route) => {
        if (failures++ === 0) return route.fulfill({ status: 500, body: "" });
        return route.fallback();
      },
      (url) => url.pathname.startsWith("/conversas"),
    );
    await authorButton(page, otherPerson.name).click();
    const panel = profilePanel(page);
    await panel.getByRole("button", { name: "Mensagem" }).click();
    await expect(panel.getByRole("alert")).toHaveText("Não foi possível abrir a conversa. Tente de novo.");

    // 2. "Mensagem" de novo
    await panel.getByRole("button", { name: "Mensagem" }).click();

    await readyConversation(page, otherPerson.name);
  });
});
