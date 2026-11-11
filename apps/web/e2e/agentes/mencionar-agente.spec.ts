// spec: e2e/plano-de-testes-f10.md
// seed: e2e/seed.spec.ts
import { expect, logIn, test } from "../fixtures";
import { setConnected } from "../support/agents";
import { agentsDialog } from "../support/agents-dialog";
import { composer } from "../support/conversation-page";
import { openSharedChannel } from "../support/realtime";

const CHIP = "Agente Assistente (@assistente)";

test.describe("Mencionar um Agente conectado", () => {
  test.afterEach(async () => {
    await setConnected("assistente", false);
  });

  test("o Agente aparece no autocompletar e a Menção vira chip para todos", async ({
    page,
    person,
    otherPage,
    sharedChannel,
    agentsLock,
  }) => {
    void agentsLock;
    // 1. O assistente conectado; as duas Pessoas no Canal
    await setConnected("assistente", true);
    await logIn(page, person);
    await openSharedChannel(page, otherPage, sharedChannel, person, { history: 0 });

    // 2. "@ass" mostra o Agente, com o detalhe de Agente; Enter o escolhe
    const box = composer(page, sharedChannel.name);
    await box.fill("Oi @ass");
    const list = page.getByRole("listbox", { name: "Pessoas para mencionar" });
    const option = list.getByRole("option", { name: /Assistente\s*@assistente · Agente/ });
    await expect(option).toBeVisible();
    // Os Agentes vêm depois dos Membros; nenhum Membro casa com "ass", e o Agente é a opção ativa.
    await expect(list.getByRole("option").last()).toHaveText(/@assistente · Agente/);
    await expect(option).toHaveAttribute("aria-selected", "true");
    await box.press("Enter");
    await expect(box).toHaveValue("Oi @assistente ");

    // 3. A Mensagem enviada mostra o chip, também para a outra Pessoa
    await box.pressSequentially("resuma");
    await box.press("Enter");
    await expect(page.getByRole("main").getByRole("button", { name: CHIP })).toBeVisible();
    const otherChip = otherPage.getByRole("main").getByRole("button", { name: CHIP });
    await expect(otherChip).toBeVisible();

    // 4. O chip abre o diálogo pelo teclado
    await otherChip.focus();
    await otherPage.keyboard.press("Enter");
    await expect(agentsDialog(otherPage)).toBeVisible();
    await otherPage.keyboard.press("Escape");

    // 5. Desconectado, o chip vira texto comum ao recarregar, e o Agente sai do autocompletar
    await setConnected("assistente", false);
    await page.reload();
    await expect(page.getByRole("main").getByText("Oi @assistente resuma")).toBeVisible();
    await expect(page.getByRole("main").getByRole("button", { name: CHIP })).toHaveCount(0);
    await composer(page, sharedChannel.name).fill("@ass");
    await expect(page.getByRole("option", { name: /@assistente · Agente/ })).toHaveCount(0);
  });

  test("o chip vira texto comum sem recarregar depois de desconectar", async ({
    page,
    person,
    otherPage,
    sharedChannel,
    makeAdmin,
    agentsLock,
  }) => {
    void agentsLock;
    // 1. Uma Mensagem com a Menção ao assistente conectado, vista pela outra Pessoa
    await setConnected("assistente", true);
    await makeAdmin(person);
    await logIn(page, person);
    await openSharedChannel(page, otherPage, sharedChannel, person, { history: 0 });
    const box = composer(page, sharedChannel.name);
    await box.fill("Pergunta para @assistente");
    await box.press("Escape");
    await box.press("Enter");
    const otherChip = otherPage.getByRole("main").getByRole("button", { name: CHIP });
    await expect(otherChip).toBeVisible();

    // 2. O administrador desconecta: o chip some para a outra Pessoa, sem recarregar
    await page.getByRole("region", { name: "Agentes" }).getByRole("button", { name: "Gerenciar agentes" }).click();
    await agentsDialog(page).getByRole("button", { name: "Desconectar" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Desconectar" }).click();
    await expect(agentsDialog(page).getByRole("button", { name: "Conectar" })).toBeVisible();
    await expect(otherChip).toHaveCount(0);
    await expect(otherPage.getByRole("main").getByText("Pergunta para @assistente")).toBeVisible();
  });
});
