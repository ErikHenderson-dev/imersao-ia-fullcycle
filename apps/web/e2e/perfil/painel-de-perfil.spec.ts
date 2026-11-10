// spec: e2e/plano-de-testes-f05.md
// seed: e2e/seed.spec.ts
import { expect, logIn, test } from "../fixtures";
import { readyHistory } from "../support/conversation-page";
import { insertChannel, insertHistory, insertPerson } from "../support/database";
import { authorButton, profilePanel } from "../support/profile-panel";

test.describe("Painel de perfil", () => {
  test("continua aberto ao trocar de Conversa e troca o conteúdo ao abrir outro Perfil", async ({
    page,
    person,
    otherPerson,
  }) => {
    // 1. Dois Canais, cada um com uma autora
    const carla = await insertPerson("Carla Dias");
    const first = await insertChannel([person, otherPerson, carla]);
    const second = await insertChannel([person, otherPerson, carla]);
    await insertHistory(first, otherPerson, 1);
    await insertHistory(second, carla, 1);
    await logIn(page, person);
    await page.goto(`/conversas/${first.id}`);
    await readyHistory(page, first.name);
    await authorButton(page, otherPerson.name).click();
    const panel = profilePanel(page);
    await expect(panel.getByText(`@${otherPerson.username}`)).toBeVisible();

    // 2. Trocar de Canal pela barra lateral
    await page.getByRole("link", { name: second.name }).click();
    await readyHistory(page, second.name);
    await expect(panel.getByText(`@${otherPerson.username}`)).toBeVisible();

    // 3. Abrir o Perfil da outra autora
    await authorButton(page, carla.name).click();
    await expect(panel.getByText(`@${carla.username}`)).toBeVisible();
    await expect(panel.getByText(`@${otherPerson.username}`)).toHaveCount(0);
  });

  test("Esc fecha e devolve o foco", async ({ page, person, sharedChannel, otherPerson }) => {
    // 1. Abrir o Perfil pelo teclado
    await insertHistory(sharedChannel, otherPerson, 1);
    await logIn(page, person);
    await page.goto(`/conversas/${sharedChannel.id}`);
    await readyHistory(page, sharedChannel.name);
    const author = authorButton(page, otherPerson.name);
    await author.focus();
    await page.keyboard.press("Enter");
    await expect(profilePanel(page).getByRole("button", { name: "Fechar perfil" })).toBeFocused();

    // 2. Esc
    await page.keyboard.press("Escape");

    await expect(profilePanel(page)).toHaveCount(0);
    await expect(author).toBeFocused();
  });

  test("sobrepõe a Conversa em telas estreitas", async ({
    page,
    person,
    sharedChannel,
    otherPerson,
  }) => {
    // 1. Em 1024 px, o painel fica sobre a Conversa
    await insertHistory(sharedChannel, otherPerson, 1);
    await page.setViewportSize({ width: 1024, height: 800 });
    await logIn(page, person);
    await page.goto(`/conversas/${sharedChannel.id}`);
    await readyHistory(page, sharedChannel.name);
    await authorButton(page, otherPerson.name).click();
    const panel = profilePanel(page);
    await expect(panel).toBeVisible();
    const main = await page.getByRole("main").boundingBox();
    const box = await panel.boundingBox();
    expect(Math.round(box!.width)).toBe(384);
    expect(main!.x + main!.width).toBeGreaterThan(box!.x);

    // 2. Em 600 px, ocupa a largura toda
    await page.setViewportSize({ width: 600, height: 800 });
    await expect.poll(async () => (await panel.boundingBox())?.width).toBe(600);
  });

  test("abrir o Perfil pela gaveta fecha a gaveta", async ({ loggedInPage: page, person }) => {
    // 1. Abaixo de 768 px, abrir a gaveta e o menu do avatar
    await page.setViewportSize({ width: 700, height: 800 });
    await page.getByRole("button", { name: "Abrir navegação" }).click();
    const drawer = page.getByRole("dialog", { name: "Navegação" });
    await drawer.getByRole("button", { name: `Menu de ${person.name}` }).click();

    // 2. Escolher "Perfil"
    await page.getByRole("menuitem", { name: "Perfil", exact: true }).click();

    await expect(drawer).toHaveCount(0);
    await expect(profilePanel(page).getByText(`@${person.username}`)).toBeVisible();
    await expect(profilePanel(page).getByRole("button", { name: "Fechar perfil" })).toBeFocused();
  });

  test("aberto pelo avatar, devolve o foco ao nome da autora", async ({
    page,
    person,
    sharedChannel,
    otherPerson,
  }) => {
    // 1. Clicar no avatar da autora e fechar pelo X
    await insertHistory(sharedChannel, otherPerson, 1);
    await logIn(page, person);
    await page.goto(`/conversas/${sharedChannel.id}`);
    await readyHistory(page, sharedChannel.name);
    await page.getByRole("main").locator("li button[aria-hidden]").first().click();
    await profilePanel(page).getByRole("button", { name: "Fechar perfil" }).click();

    await expect(authorButton(page, otherPerson.name)).toBeFocused();
  });
});
