// spec: e2e/plano-de-testes-f10.md
// seed: e2e/seed.spec.ts
import { expect, logIn, test } from "../fixtures";
import { readyHistory } from "../support/conversation-page";
import { insertHistory, setAdminOf } from "../support/database";
import { authorButton, profilePanel } from "../support/profile-panel";

test.describe("Selo de administrador", () => {
  test("o selo aparece no perfil de quem administra e não no de quem não administra", async ({
    page,
    person,
    otherPage,
    otherPerson,
    sharedChannel,
  }) => {
    // 1. A Ana administra; cada uma tem uma Mensagem no Canal das duas
    await setAdminOf(person.id, true);
    await insertHistory(sharedChannel, person, 1);
    await insertHistory(sharedChannel, otherPerson, 1);

    // 2. O Bruno abre o perfil da Ana pelo autor da Mensagem: tem o selo
    await otherPage.goto(`/conversas/${sharedChannel.id}`);
    await readyHistory(otherPage, sharedChannel.name);
    await authorButton(otherPage, person.name).click();
    const panelOfAna = profilePanel(otherPage);
    await expect(panelOfAna.getByText(`@${person.username}`)).toBeVisible();
    await expect(panelOfAna.getByText("Administrador", { exact: true })).toBeVisible();

    // 3. O perfil do Bruno, aberto por ele mesmo, não tem
    await authorButton(otherPage, otherPerson.name).click();
    await expect(panelOfAna.getByText(`@${otherPerson.username}`)).toBeVisible();
    await expect(panelOfAna.getByText("Administrador", { exact: true })).toHaveCount(0);

    // 4. A Ana abre o próprio Perfil pelo menu do avatar, pelo teclado: tem o selo
    await logIn(page, person);
    await page.getByRole("button", { name: `Menu de ${person.name}` }).focus();
    await page.keyboard.press("Enter");
    await page.getByRole("menuitem", { name: "Perfil", exact: true }).press("Enter");
    const ownPanel = profilePanel(page);
    await expect(ownPanel.getByText(`@${person.username}`)).toBeVisible();
    await expect(ownPanel.getByText("Administrador", { exact: true })).toBeVisible();
  });

  test("o papel dado depois aparece na próxima abertura do perfil, sem sair e entrar", async ({
    otherPage,
    person,
    sharedChannel,
  }) => {
    // 1. O Bruno abre o perfil da Ana, que não administra, e fecha
    await insertHistory(sharedChannel, person, 1);
    await otherPage.goto(`/conversas/${sharedChannel.id}`);
    await readyHistory(otherPage, sharedChannel.name);
    await authorButton(otherPage, person.name).click();
    const panel = profilePanel(otherPage);
    await expect(panel.getByText(`@${person.username}`)).toBeVisible();
    await expect(panel.getByText("Administrador", { exact: true })).toHaveCount(0);
    await panel.getByRole("button", { name: "Fechar perfil" }).click();

    // 2. A Ana passa a administrar, e o Bruno abre o perfil de novo
    await setAdminOf(person.id, true);
    await authorButton(otherPage, person.name).click();
    await expect(panel.getByText("Administrador", { exact: true })).toBeVisible();
  });
});
