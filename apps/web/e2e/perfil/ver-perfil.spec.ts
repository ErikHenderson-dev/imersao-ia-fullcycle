// spec: e2e/plano-de-testes-f05.md
// seed: e2e/seed.spec.ts
import { expect, logIn, test } from "../fixtures";
import { readyHistory } from "../support/conversation-page";
import { deleteSessionsOf, insertChannel, insertHistory, insertPerson } from "../support/database";
import { authorButton, profilePanel } from "../support/profile-panel";

test.describe("Ver um Perfil", () => {
  test("mostra o Perfil de outra Pessoa", async ({ page, person }) => {
    // 1. Uma Mensagem da Regina, com cargo e telefone, no Canal das duas
    const regina = await insertPerson("Regina Fonseca", {
      title: "Engenheira de Software",
      phone: "+55 11 98888-0001",
    });
    const channel = await insertChannel([person, regina]);
    await insertHistory(channel, regina, 1);
    await logIn(page, person);
    await page.goto(`/conversas/${channel.id}`);
    await readyHistory(page, channel.name);

    // 2. Clicar no nome da autora
    await authorButton(page, regina.name).click();

    const panel = profilePanel(page);
    await expect(panel.getByText(regina.name, { exact: true })).toBeVisible();
    await expect(panel.getByText("Engenheira de Software")).toBeVisible();
    await expect(panel.getByText(`@${regina.username}`)).toBeVisible();
    await expect(panel.getByRole("button", { name: "Mensagem" })).toBeEnabled();
    await expect(panel.getByRole("link", { name: regina.email })).toHaveAttribute(
      "href",
      `mailto:${regina.email}`,
    );
    await expect(panel.getByText("+55 11 98888-0001")).toBeVisible();
    await expect(panel.getByRole("button", { name: "Fechar perfil" })).toBeFocused();
  });

  test("esconde cargo e telefone que não existem", async ({ page, person, otherPerson }) => {
    // 1. Abrir o Perfil de quem não tem cargo nem telefone
    const channel = await insertChannel([person, otherPerson]);
    await insertHistory(channel, otherPerson, 1);
    await logIn(page, person);
    await page.goto(`/conversas/${channel.id}`);
    await readyHistory(page, channel.name);
    await authorButton(page, otherPerson.name).click();

    const panel = profilePanel(page);
    await expect(panel.getByText(`@${otherPerson.username}`)).toBeVisible();
    await expect(panel.getByText("Telefone")).toHaveCount(0);
    await expect(panel.getByText("E-mail")).toBeVisible();
  });

  test("abre o próprio Perfil pelo menu do avatar, com Editar perfil", async ({
    loggedInPage: page,
    person,
  }) => {
    // 1. Abrir o menu do avatar pelo teclado e escolher "Perfil"
    await page.getByRole("button", { name: `Menu de ${person.name}` }).focus();
    await page.keyboard.press("Enter");
    await page.getByRole("menuitem", { name: "Perfil", exact: true }).press("Enter");

    const panel = profilePanel(page);
    await expect(panel.getByText(`@${person.username}`)).toBeVisible();
    // "Editar perfil" entrou com a F09.
    await expect(panel.getByRole("button", { name: "Editar perfil" })).toBeVisible();
    await expect(panel.getByRole("button", { name: "Fechar perfil" })).toBeFocused();
  });

  test("abre pela lista de Membros", async ({ page, person, otherPerson }) => {
    // 1. Abrir "Membros" e escolher a outra Pessoa
    const channel = await insertChannel([person, otherPerson]);
    await logIn(page, person);
    await page.goto(`/conversas/${channel.id}`);
    await readyHistory(page, channel.name);
    const membersButton = page.getByRole("button", { name: "Membros: 2" });
    await membersButton.click();
    const dialog = page.getByRole("dialog", { name: `Membros de #${channel.name}` });
    await dialog.getByRole("button", { name: otherPerson.name }).click();

    await expect(dialog).toHaveCount(0);
    await expect(profilePanel(page).getByText(`@${otherPerson.username}`)).toBeVisible();

    // 2. Fechar o painel devolve o foco ao botão de Membros
    await page.keyboard.press("Escape");
    await expect(profilePanel(page)).toHaveCount(0);
    await expect(membersButton).toBeFocused();
  });

  test("mostra Pessoa não encontrada", async ({ page, person, sharedChannel, otherPerson }) => {
    // 1. A API responde 404 ao Perfil
    await insertHistory(sharedChannel, otherPerson, 1);
    await page.route("**/api/people/*", (route) =>
      route.fulfill({ status: 404, json: { kind: "not_found" } }),
    );
    await logIn(page, person);
    await page.goto(`/conversas/${sharedChannel.id}`);
    await readyHistory(page, sharedChannel.name);
    await authorButton(page, otherPerson.name).click();

    await expect(
      profilePanel(page).getByRole("heading", { name: "Pessoa não encontrada" }),
    ).toBeVisible();
  });

  test("tenta de novo depois da falha ao carregar", async ({
    page,
    person,
    sharedChannel,
    otherPerson,
  }) => {
    // 1. A primeira leitura do Perfil falha
    await insertHistory(sharedChannel, otherPerson, 1);
    let failures = 0;
    await page.route(`**/api/people/${otherPerson.id}`, async (route) => {
      if (failures++ === 0) return route.fulfill({ status: 502, json: { kind: "failure" } });
      return route.continue();
    });
    await logIn(page, person);
    await page.goto(`/conversas/${sharedChannel.id}`);
    await readyHistory(page, sharedChannel.name);
    await authorButton(page, otherPerson.name).click();
    const panel = profilePanel(page);
    await expect(
      panel.getByRole("heading", { name: "Não foi possível carregar o perfil" }),
    ).toBeVisible();

    // 2. "Tentar de novo" carrega o Perfil
    await panel.getByRole("button", { name: "Tentar de novo" }).click();

    await expect(panel.getByText(`@${otherPerson.username}`)).toBeVisible();
  });

  test("a Sessão vencida leva a Entrar ao abrir o Perfil", async ({
    page,
    person,
    sharedChannel,
    otherPerson,
  }) => {
    // 1. A Sessão é revogada com a Conversa aberta
    await insertHistory(sharedChannel, otherPerson, 1);
    await logIn(page, person);
    await page.goto(`/conversas/${sharedChannel.id}`);
    await readyHistory(page, sharedChannel.name);
    await deleteSessionsOf(person.id);

    await authorButton(page, otherPerson.name).click();

    await expect(page).toHaveURL(/\/entrar/);
  });
});
