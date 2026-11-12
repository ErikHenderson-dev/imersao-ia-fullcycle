// spec: e2e/plano-de-testes-f10.md
// seed: e2e/seed.spec.ts
import { expect, logIn, test } from "../fixtures";
import { isConnected, setConnected } from "../support/agents";
import { agentsDialog, agentsSection } from "../support/agents-dialog";
import { setAdminOf } from "../support/database";
import { routeServerAction } from "../support/server-action";

test.describe("Conectar um Agente", () => {
  test.afterEach(async () => {
    await setConnected("assistente", false);
  });

  test("o administrador conecta o assistente pelo teclado", async ({
    page,
    person,
    otherPage,
    makeAdmin,
    agentsLock,
  }) => {
    void agentsLock;
    // 1. O assistente desconectado; a Ana administra
    await setConnected("assistente", false);
    await makeAdmin(person);
    await logIn(page, person);

    // 2. "Conectar agentes", com o contador, abre o diálogo do administrador
    const section = agentsSection(page);
    await section.getByRole("button", { name: "Conectar agentes, 1 desconectado" }).focus();
    await page.keyboard.press("Enter");
    const dialog = agentsDialog(page);
    await expect(
      dialog.getByText("Nenhum agente conectado ainda. Conecte um para todo mundo poder mencioná-lo nas conversas."),
    ).toBeVisible();

    // 3. "Conectar" passa por Conectando, sem segundo clique, e termina conectado
    await routeServerAction(page, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 800));
      await route.fallback();
    });
    const connect = dialog.getByRole("button", { name: "Conectar" });
    await connect.focus();
    await page.keyboard.press("Enter");
    await expect(connect).toBeDisabled();
    await expect(dialog.getByRole("button", { name: "Desconectar" })).toBeVisible();
    expect(await isConnected("assistente")).toBe(true);

    // 4. A seção do administrador passa a Gerenciar agentes, com a linha
    await page.keyboard.press("Escape");
    await expect(section.getByRole("button", { name: "Assistente", exact: true })).toBeVisible();
    await expect(section.getByRole("button", { name: "Gerenciar agentes" })).toBeVisible();

    // 5. A outra Pessoa vê a linha ao recarregar
    await otherPage.reload();
    await expect(
      agentsSection(otherPage).getByRole("button", { name: "Assistente", exact: true }),
    ).toBeVisible();
  });

  test("quem perdeu o papel recebe o erro", async ({ page, person, makeAdmin, agentsLock }) => {
    void agentsLock;
    // 1. A Ana administra, abre o diálogo e perde o papel pelo banco, com a tela aberta
    await setConnected("assistente", false);
    await makeAdmin(person);
    await logIn(page, person);
    await agentsSection(page).getByRole("button", { name: "Conectar agentes, 1 desconectado" }).click();
    const dialog = agentsDialog(page);
    await expect(dialog.getByRole("button", { name: "Conectar" })).toBeVisible();
    await setAdminOf(person.id, false);

    // 2. Conectar mostra o erro e não muda nada
    await dialog.getByRole("button", { name: "Conectar" }).click();
    await expect(page.getByText("Só administradores conectam agentes")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Conectar" })).toBeEnabled();
    expect(await isConnected("assistente")).toBe(false);
  });

  test("a falha mostra o erro e não muda nada", async ({ page, person, makeAdmin, agentsLock }) => {
    void agentsLock;
    await setConnected("assistente", false);
    await makeAdmin(person);
    await logIn(page, person);
    await agentsSection(page).getByRole("button", { name: "Conectar agentes, 1 desconectado" }).click();
    const dialog = agentsDialog(page);

    // A Server Action falha no caminho
    await routeServerAction(page, (route) => route.fulfill({ status: 500, body: "" }));
    await dialog.getByRole("button", { name: "Conectar" }).click();
    await expect(page.getByText("Não foi possível conectar o agente")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Conectar" })).toBeEnabled();
    expect(await isConnected("assistente")).toBe(false);
  });
});
