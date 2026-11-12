// spec: e2e/plano-de-testes-f10.md
// seed: e2e/seed.spec.ts
import { expect, logIn, test } from "../fixtures";
import { setConnected } from "../support/agents";
import { agentsDialog, agentsSection } from "../support/agents-dialog";
import { waitForRealtime } from "../support/realtime";

test.describe("Mudança de conexão em tempo real", () => {
  test.afterEach(async () => {
    await setConnected("assistente", false);
  });

  test("a outra Pessoa vê a mudança sem recarregar", async ({
    page,
    person,
    otherPage,
    makeAdmin,
    agentsLock,
  }) => {
    void agentsLock;
    // 1. O assistente desconectado; a outra Pessoa com o diálogo aberto
    await setConnected("assistente", false);
    await makeAdmin(person);
    await otherPage.reload();
    await waitForRealtime(otherPage);
    await agentsSection(otherPage).getByRole("button", { name: "Ver agentes" }).click();
    const otherDialog = agentsDialog(otherPage);
    await expect(otherDialog.getByText("Não conectado")).toBeVisible();
    const otherRow = agentsSection(otherPage).getByRole("button", { name: "Assistente", exact: true });

    // 2. O administrador conecta: a linha aparece e o diálogo da outra muda, sem recarregar
    await logIn(page, person);
    await agentsSection(page).getByRole("button", { name: /Conectar agentes/ }).click();
    await agentsDialog(page).getByRole("button", { name: "Conectar" }).click();
    await expect(agentsDialog(page).getByRole("button", { name: "Desconectar" })).toBeVisible();
    await expect(otherDialog.getByText("Conectado", { exact: true })).toBeVisible();
    await otherPage.keyboard.press("Escape");
    await expect(otherRow).toBeVisible();

    // 3. O administrador desconecta: a linha some para a outra, sem recarregar
    await agentsDialog(page).getByRole("button", { name: "Desconectar" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Desconectar" }).click();
    await expect(agentsDialog(page).getByRole("button", { name: "Conectar" })).toBeVisible();
    await expect(otherRow).toHaveCount(0);
  });

  test("a reconexão relê a lista", async ({ loggedInPage: page, context, agentsLock }) => {
    void agentsLock;
    // 1. Sem nenhum Agente conectado, a aba cai
    await setConnected("assistente", false);
    await page.reload();
    await waitForRealtime(page);
    await context.setOffline(true);
    await waitForRealtime(page, "disconnected");

    // 2. O Agente é conectado sem evento, e a rede volta: a linha aparece sem recarregar
    await setConnected("assistente", true);
    await context.setOffline(false);
    await waitForRealtime(page);
    await expect(agentsSection(page).getByRole("button", { name: "Assistente", exact: true })).toBeVisible();
  });
});
