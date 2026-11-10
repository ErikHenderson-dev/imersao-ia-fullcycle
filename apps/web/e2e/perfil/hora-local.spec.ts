// spec: e2e/plano-de-testes-f05.md
// seed: e2e/seed.spec.ts
import { expect, logIn, test } from "../fixtures";
import { readyHistory } from "../support/conversation-page";
import { insertChannel, insertHistory, timeZoneOf } from "../support/database";
import { authorButton, profilePanel } from "../support/profile-panel";
import { routeServerAction } from "../support/server-action";

// O navegador em Tóquio, longe do fuso padrão do servidor (America/Sao_Paulo).
test.use({ timezoneId: "Asia/Tokyo" });

function tokyoTime(): RegExp {
  const format = (date: Date) =>
    new Intl.DateTimeFormat("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: "Asia/Tokyo",
    }).format(date);
  const now = new Date();
  // A virada do minuto pode cair entre o teste e a tela.
  const times = [format(now), format(new Date(now.getTime() + 60_000))];
  return new RegExp(`^(${times.join("|")}) no horário local$`);
}

test.describe("Hora local no Perfil", () => {
  test("grava o fuso do navegador ao abrir o chat e mostra a hora no fuso da Pessoa", async ({
    loggedInPage: page,
    person,
  }) => {
    // 1. Abrir o chat grava o fuso do navegador
    await expect.poll(() => timeZoneOf(person.id)).toBe("Asia/Tokyo");

    // 2. O próprio Perfil, pelo menu do avatar
    await page.getByRole("button", { name: `Menu de ${person.name}` }).click();
    await page.getByRole("menuitem", { name: "Perfil", exact: true }).click();

    await expect(profilePanel(page).getByText(/no horário local$/)).toHaveText(tokyoTime());
  });

  test("sem fuso, a linha não aparece", async ({ page, person, otherPerson, sharedChannel }) => {
    // 1. O Perfil de quem nunca abriu o chat
    await insertHistory(sharedChannel, otherPerson, 1);
    await logIn(page, person);
    await page.goto(`/conversas/${sharedChannel.id}`);
    await readyHistory(page, sharedChannel.name);
    await authorButton(page, otherPerson.name).click();

    const panel = profilePanel(page);
    await expect(panel.getByText(`@${otherPerson.username}`)).toBeVisible();
    await expect(panel.getByText(/no horário local/)).toHaveCount(0);
  });

  test("a recusa ao gravar o fuso não aparece nem repete", async ({ page, person }) => {
    // 1. Fora de "Entrar", toda Server Action responde com erro do servidor
    const channel = await insertChannel([person]);
    let calls = 0;
    await routeServerAction(
      page,
      (route) => {
        calls += 1;
        return route.fulfill({ status: 500, body: "" });
      },
      (url) => !url.pathname.startsWith("/entrar"),
    );
    await logIn(page, person);
    await page.goto(`/conversas/${channel.id}`);
    await readyHistory(page, channel.name);

    await expect.poll(() => calls).toBeGreaterThan(0);
    // Uma chamada por carga: a do login e a da Conversa aberta, e nenhuma nova tentativa.
    await page.waitForTimeout(1_000);
    expect(calls).toBe(2);
    // O anunciador de rota do Next é um alert vazio: só um com texto seria um aviso.
    await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveCount(0);
    expect(await timeZoneOf(person.id)).toBeNull();
  });
});
