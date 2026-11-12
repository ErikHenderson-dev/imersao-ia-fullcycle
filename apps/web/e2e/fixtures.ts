import { test as base, expect, type Page } from "@playwright/test";
import {
  insertChannel,
  insertPerson,
  type TestChannel,
  type TestPerson,
} from "./support/database";
import { lockAgents } from "./support/agents";
import { setAdminOf } from "./support/database";
import { waitForLoginForm } from "./support/login-page";
import { waitForRealtime } from "./support/realtime";

type Fixtures = {
  person: TestPerson;
  memberChannel: TestChannel;
  loggedInPage: Page;
  // Tempo real (F03): uma segunda Pessoa, Membro do mesmo Canal que a primeira.
  otherPerson: TestPerson;
  sharedChannel: TestChannel;
  // A segunda Pessoa logada num contexto novo do navegador, com os próprios cookies.
  otherPage: Page;
  // Dá o papel de administrador e o tira no fim do teste (F10): a lista de administradores do banco
  // de desenvolvimento não cresce a cada execução.
  makeAdmin: (person: TestPerson) => Promise<void>;
  // A trava do estado de conexão dos Agentes, segurada durante o teste (F10).
  agentsLock: void;
};

export const test = base.extend<Fixtures>({
  // Pessoa criada direto no banco, com e-mail único e a senha conhecida de teste.
  person: async ({}, use) => {
    await use(await insertPerson());
  },

  // Canal público com a Pessoa da fixture como Membro, criado direto no banco.
  // "channel" é uma opção do Playwright (o canal do navegador), daí o nome.
  memberChannel: async ({ person }, use) => {
    await use(await insertChannel([person]));
  },

  // O único lugar que entra pelo formulário da tela Entrar. Sem Canais, a Pessoa fica na Home;
  // com Canais, a Home a leva ao primeiro.
  loggedInPage: async ({ page, person }, use) => {
    await logIn(page, person);
    await use(page);
  },

  otherPerson: async ({}, use) => {
    await use(await insertPerson("Bruno Lima"));
  },

  sharedChannel: async ({ person, otherPerson }, use) => {
    await use(await insertChannel([person, otherPerson]));
  },

  otherPage: async ({ browser, baseURL, otherPerson }, use) => {
    // O baseURL explícito: o contexto novo não depende das opções que o runner injeta.
    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    await logIn(page, otherPerson);
    await use(page);
    await context.close();
  },

  makeAdmin: async ({}, use) => {
    const admins: string[] = [];
    await use(async (person) => {
      admins.push(person.id);
      await setAdminOf(person.id, true);
    });
    for (const id of admins) await setAdminOf(id, false);
  },

  // A espera pela trava tem tempo próprio, fora do tempo do teste: os testes que a usam correm em
  // fila.
  agentsLock: [
    async ({}, use) => {
      const release = await lockAgents();
      try {
        await use();
      } finally {
        await release();
      }
    },
    { timeout: 180_000 },
  ],
});

// Entra pelo formulário da tela Entrar.
export async function logIn(
  page: Page,
  person: TestPerson,
  { waitForRealtime: waitForConnection = true }: { waitForRealtime?: boolean } = {},
): Promise<void> {
  await page.goto("/entrar");
  await waitForLoginForm(page);
  await page.getByRole("textbox", { name: "E-mail" }).fill(person.email);
  await page.getByLabel("Senha").fill(person.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  // Mais folga que o padrão: o login confere a senha com Argon2id e, com Canais, a Home leva à
  // Conversa, o que pesa no next dev com vários testes em paralelo.
  await expect(page.getByRole("navigation", { name: "Seções" })).toBeVisible({ timeout: 15_000 });
  // O socket conectado: um teste que revoga a Sessão logo depois não vê o handshake recusado
  // levando a aba a "Entrar" antes da ação dele. Quem prende a conexão de propósito não espera.
  if (waitForConnection) await waitForRealtime(page);
}

export { expect };
