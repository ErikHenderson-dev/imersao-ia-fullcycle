// spec: e2e/plano-de-testes-f05.md
// seed: e2e/seed.spec.ts
import { expect, logIn, test } from "../fixtures";
import { readyConversation, readyHistory } from "../support/conversation-page";
import { insertHistory } from "../support/database";
import { authorButton, profilePanel } from "../support/profile-panel";
import { waitForRealtime } from "../support/realtime";

test.describe("A outra Pessoa recebe a Conversa direta", () => {
  test("a Conversa só aparece para a outra Pessoa na primeira Mensagem", async ({
    page,
    otherPage,
    person,
    otherPerson,
    sharedChannel,
  }) => {
    // 1. A primeira Pessoa abre a Conversa direta com a outra, sem escrever
    await insertHistory(sharedChannel, otherPerson, 1);
    await logIn(page, person);
    await page.goto(`/conversas/${sharedChannel.id}`);
    await readyHistory(page, sharedChannel.name);
    await authorButton(page, otherPerson.name).click();
    await profilePanel(page).getByRole("button", { name: "Mensagem" }).click();
    await readyConversation(page, otherPerson.name);
    const directUrl = new URL(page.url()).pathname;

    // 2. A outra Pessoa não vê a Conversa, nem pelo endereço
    await otherPage.goto(directUrl);
    await expect(otherPage.getByRole("heading", { name: "Conversa não encontrada" })).toBeVisible();
    await otherPage.goto(`/conversas/${sharedChannel.id}`);
    await readyHistory(otherPage, sharedChannel.name);
    await waitForRealtime(otherPage);
    const otherDirects = otherPage.getByRole("region", { name: "Mensagens diretas" });
    await expect(otherDirects.getByRole("link", { name: person.name })).toHaveCount(0);

    // 3. A primeira Mensagem
    const box = page.getByRole("textbox", { name: `Mensagem para ${otherPerson.name.split(" ")[0]}` });
    await box.fill("Oi, tudo bem?");
    await box.press("Enter");

    // 4. A Conversa aparece para a outra Pessoa sem recarregar e sem abrir sozinha
    await expect(otherDirects.getByRole("link", { name: person.name })).toBeVisible();
    await expect(otherPage).toHaveURL(new RegExp(`/conversas/${sharedChannel.id}$`));

    // 5. A outra Pessoa abre e responde; a resposta chega em tempo real
    await otherDirects.getByRole("link", { name: person.name }).click();
    await readyConversation(otherPage, person.name);
    await expect(otherPage.getByText("Oi, tudo bem?")).toBeVisible();
    const reply = otherPage.getByRole("textbox", { name: `Mensagem para ${person.name.split(" ")[0]}` });
    await reply.fill("Tudo ótimo!");
    await reply.press("Enter");

    await expect(page.getByText("Tudo ótimo!")).toBeVisible();
  });
});
