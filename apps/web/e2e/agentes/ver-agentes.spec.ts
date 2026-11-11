// spec: e2e/plano-de-testes-f10.md
// seed: e2e/seed.spec.ts
import { expect, logIn, test } from "../fixtures";
import { setConnected } from "../support/agents";
import { agentsDialog, agentsSection } from "../support/agents-dialog";
import { profilePanel } from "../support/profile-panel";

test.describe("Ver os Agentes e os administradores", () => {
  test("GET /api/agents exige Sessão e traz o catálogo", async ({ loggedInPage: page, browser, baseURL }) => {
    // 1. Com Sessão, o catálogo do Serviço de agentes
    const response = await page.request.get("/api/agents");
    expect(response.status()).toBe(200);
    const agents = (await response.json()) as { slug: string; name: string }[];
    expect(agents).toContainEqual(expect.objectContaining({ slug: "assistente", name: "Assistente" }));

    // 2. Sem Sessão, 401
    const anonymous = await browser.newContext({ baseURL });
    const unauthenticated = await anonymous.request.get("/api/agents");
    expect(unauthenticated.status()).toBe(401);
    await anonymous.close();
  });

  test("a seção mostra os conectados e Ver agentes", async ({ loggedInPage: page, agentsLock }) => {
    void agentsLock;
    // 1. Com o assistente conectado, a linha e a ação
    await setConnected("assistente", true);
    await page.reload();
    const section = agentsSection(page);
    await expect(section.getByRole("button", { name: "Assistente", exact: true })).toBeVisible();
    await expect(section.getByRole("button", { name: "Ver agentes" })).toBeVisible();

    // 2. Desconectado, só a ação
    await setConnected("assistente", false);
    await page.reload();
    await expect(section.getByRole("button", { name: "Ver agentes" })).toBeVisible();
    await expect(section.getByRole("button", { name: "Assistente", exact: true })).toHaveCount(0);
  });

  test("quem não administra vê os Agentes e os administradores e abre um perfil pelo teclado", async ({
    page,
    person,
    otherPerson,
    makeAdmin,
    agentsLock,
  }) => {
    void agentsLock;
    // 1. Nenhum Agente conectado; o Bruno administra
    await setConnected("assistente", false);
    await makeAdmin(otherPerson);
    await logIn(page, person);

    // 2. "Ver agentes" pelo teclado abre o diálogo
    await agentsSection(page).getByRole("button", { name: "Ver agentes" }).focus();
    await page.keyboard.press("Enter");
    const dialog = agentsDialog(page);
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText("Nenhum agente conectado ainda. Peça a quem administra o workspace para conectar."),
    ).toBeVisible();
    const agents = dialog.getByRole("list", { name: "Agentes" });
    await expect(agents.getByText("Assistente", { exact: true })).toBeVisible();
    await expect(agents.getByText("@assistente")).toBeVisible();
    await expect(agents.getByText("Não conectado")).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Conectar" })).toHaveCount(0);

    // 3. O Bruno na lista de administradores; Enter abre o perfil dele e fecha o diálogo
    const admin = dialog
      .getByRole("list", { name: "Administradores" })
      .getByRole("button", { name: `${otherPerson.name} @${otherPerson.username}` });
    await expect(admin).toBeVisible();
    await admin.focus();
    await page.keyboard.press("Enter");
    await expect(dialog).toHaveCount(0);
    await expect(profilePanel(page).getByText(`@${otherPerson.username}`)).toBeVisible();

    // 4. Esc no diálogo devolve o foco a quem o abriu
    await agentsSection(page).getByRole("button", { name: "Ver agentes" }).focus();
    await page.keyboard.press("Enter");
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(agentsSection(page).getByRole("button", { name: "Ver agentes" })).toBeFocused();
  });

  test("os estados do diálogo", async ({ loggedInPage: page }) => {
    const action = agentsSection(page).getByRole("button", { name: "Ver agentes" });
    const dialog = agentsDialog(page);

    // 1. Erro, e "Tentar de novo" lê de novo
    await page.route("**/api/agents", (route) => route.fulfill({ status: 502, json: { kind: "agents_unavailable" } }));
    await action.click();
    await expect(dialog.getByText("Não foi possível carregar os agentes")).toBeVisible();
    await page.unroute("**/api/agents");
    await dialog.getByRole("button", { name: "Tentar de novo" }).click();
    await expect(dialog.getByRole("list", { name: "Agentes" }).getByText("Assistente", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");

    // 2. Vazio, com o catálogo vazio
    await page.route("**/api/agents", (route) => route.fulfill({ json: [] }));
    await action.click();
    await expect(dialog.getByText("Nenhum agente disponível")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.unroute("**/api/agents");

    // 3. Sem administradores
    await page.route(
      (url) => url.pathname === "/api/people" && url.searchParams.get("admin") === "true",
      (route) => route.fulfill({ json: [] }),
    );
    await action.click();
    await expect(
      dialog.getByText(
        "Ainda não há administrador no workspace. Fale com quem opera a instalação para conectar um agente.",
      ),
    ).toBeVisible();
  });
});
