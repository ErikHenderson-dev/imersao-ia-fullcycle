// spec: e2e/plano-de-testes-f09.md
// seed: e2e/seed.spec.ts
import { expect, logIn, test } from "../fixtures";
import { readyHistory } from "../support/conversation-page";
import { insertHistory, insertPerson } from "../support/database";
import { authorButton, profilePanel } from "../support/profile-panel";
import { routeServerAction } from "../support/server-action";

test.describe("Editar o próprio Perfil", () => {
  test("abre pelo menu do avatar, preenchido, e o Esc devolve o foco ao avatar", async ({
    page,
  }) => {
    const ana = await insertPerson("Ana Souza", { title: "Produto", phone: "+55 11 3333-4444" });
    await logIn(page, ana);

    // 1. Pelo teclado: Enter no avatar e em "Editar perfil"
    const avatar = page.getByRole("button", { name: `Menu de ${ana.name}` });
    await avatar.focus();
    await page.keyboard.press("Enter");
    await page.getByRole("menuitem", { name: "Editar perfil" }).press("Enter");

    const dialog = page.getByRole("dialog", { name: "Editar perfil" });
    await expect(dialog.getByRole("textbox", { name: "Nome completo" })).toHaveValue(ana.name);
    await expect(dialog.getByRole("textbox", { name: "Nome completo" })).toBeFocused();
    await expect(dialog.getByRole("textbox", { name: "Cargo (opcional)" })).toHaveValue("Produto");
    await expect(dialog.getByRole("textbox", { name: "Telefone (opcional)" })).toHaveValue(
      "+55 11 3333-4444",
    );

    // 2. Esc fecha sem salvar, e o foco volta ao avatar
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(avatar).toBeFocused();
  });

  test("salva pelo teclado, e o nome novo aparece no menu e no painel", async ({
    loggedInPage: page,
    person,
  }) => {
    // 1. Abrir o próprio Perfil pelo menu e "Editar perfil" no painel
    const avatar = page.getByRole("button", { name: `Menu de ${person.name}` });
    await avatar.click();
    await page.getByRole("menuitem", { name: "Perfil", exact: true }).click();
    const panel = profilePanel(page);
    const editButton = panel.getByRole("button", { name: "Editar perfil" });
    await editButton.click();

    // 2. Trocar o nome e o cargo e salvar com Enter
    const dialog = page.getByRole("dialog", { name: "Editar perfil" });
    const name = dialog.getByRole("textbox", { name: "Nome completo" });
    await expect(name).toBeFocused();
    await name.fill("Ana Lima");
    await page.keyboard.press("Tab");
    await page.keyboard.type("Engenheira de Software");
    await page.keyboard.press("Enter");

    await expect(dialog).toHaveCount(0);
    await expect(editButton).toBeFocused();
    await expect(panel.getByText("Ana Lima", { exact: true })).toBeVisible();
    await expect(panel.getByText("Engenheira de Software")).toBeVisible();
    await expect(page.getByRole("button", { name: "Menu de Ana Lima" })).toBeVisible();
  });

  test("o nome vazio mostra o erro embaixo do campo e mantém o diálogo", async ({
    loggedInPage: page,
    person,
  }) => {
    await page.getByRole("button", { name: `Menu de ${person.name}` }).click();
    await page.getByRole("menuitem", { name: "Editar perfil" }).click();
    const dialog = page.getByRole("dialog", { name: "Editar perfil" });
    await dialog.getByRole("textbox", { name: "Cargo (opcional)" }).fill("Design");
    const name = dialog.getByRole("textbox", { name: "Nome completo" });
    await name.fill("   ");

    await dialog.getByRole("button", { name: "Salvar" }).click();

    await expect(dialog.getByText("Informe seu nome completo.")).toBeVisible();
    await expect(name).toBeFocused();
    await expect(name).toHaveAttribute("aria-invalid", "true");
    await expect(dialog.getByRole("textbox", { name: "Cargo (opcional)" })).toHaveValue("Design");
  });

  test("a falha da API mostra o erro geral, com Salvando enquanto espera", async ({
    loggedInPage: page,
    person,
  }) => {
    await page.getByRole("button", { name: `Menu de ${person.name}` }).click();
    await page.getByRole("menuitem", { name: "Editar perfil" }).click();
    const dialog = page.getByRole("dialog", { name: "Editar perfil" });
    await dialog.getByRole("textbox", { name: "Nome completo" }).fill("Ana Lima");
    // A Server Action segura a resposta e depois falha, como a rede caindo.
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    await routeServerAction(page, async (route) => {
      await held;
      await route.abort("failed");
    });

    await dialog.getByRole("button", { name: "Salvar" }).click();

    const saving = dialog.getByRole("button", { name: "Salvando" });
    await expect(saving).toBeDisabled();
    release();
    await expect(dialog.getByRole("alert")).toHaveText(
      "Não foi possível salvar o perfil. Tente de novo.",
    );
    await expect(dialog.getByRole("textbox", { name: "Nome completo" })).toHaveValue("Ana Lima");
    await expect(dialog.getByRole("button", { name: "Salvar" })).toBeEnabled();
  });

  test("outra Pessoa vê o nome novo numa Mensagem antiga ao recarregar", async ({
    page,
    person,
    otherPerson,
    sharedChannel,
    otherPage,
  }) => {
    // 1. Uma Mensagem antiga da Ana, vista pelo Bruno
    await insertHistory(sharedChannel, person, 1);
    await otherPage.goto(`/conversas/${sharedChannel.id}`);
    await readyHistory(otherPage, sharedChannel.name);
    await expect(authorButton(otherPage, person.name)).toBeVisible();

    // 2. A Ana troca o nome
    await logIn(page, person);
    // Pelo teclado: num contexto novo, o selo do next dev cobre o avatar.
    await page.getByRole("button", { name: `Menu de ${person.name}` }).focus();
    await page.keyboard.press("Enter");
    await page.getByRole("menuitem", { name: "Editar perfil" }).press("Enter");
    const dialog = page.getByRole("dialog", { name: "Editar perfil" });
    await dialog.getByRole("textbox", { name: "Nome completo" }).fill("Ana Lima");
    await dialog.getByRole("button", { name: "Salvar" }).click();
    await expect(dialog).toHaveCount(0);

    // 3. O Bruno recarrega
    await otherPage.reload();
    await readyHistory(otherPage, sharedChannel.name);

    await expect(authorButton(otherPage, "Ana Lima")).toBeVisible();
    void otherPerson;
  });

  test("o painel de outra Pessoa não tem Editar perfil", async ({
    page,
    person,
    otherPerson,
    sharedChannel,
  }) => {
    await insertHistory(sharedChannel, otherPerson, 1);
    await logIn(page, person);
    await page.goto(`/conversas/${sharedChannel.id}`);
    await readyHistory(page, sharedChannel.name);

    await authorButton(page, otherPerson.name).click();

    await expect(profilePanel(page).getByText(`@${otherPerson.username}`)).toBeVisible();
    await expect(profilePanel(page).getByRole("button", { name: "Editar perfil" })).toHaveCount(0);
  });
});
