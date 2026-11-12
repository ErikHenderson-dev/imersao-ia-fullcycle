import { isEmail } from 'class-validator';
import { Command, CommandOutput } from '../common/cli/command';
import { DomainError } from '../common/errors/domain.error';
import { ConversationsService } from '../conversations/conversations.service';
import { normalizeEmail } from '../people/normalize-email';
import { PASSWORD_MAX_LENGTH } from '../people/password-policy';
import { PeopleService } from '../people/people.service';
import { parsePhone, parseTitle } from '../people/profile-values';
import { parseUsername } from '../people/username';
import { PersonNotFoundError } from '../people/person-not-found.error';
import { Person } from '../people/person.entity';
import { SessionsService } from '../sessions/sessions.service';
import { BotsService } from '../bots/bots.service';
import { PasswordPrompt } from './password-prompt';
import { UsernameAvailability } from './username-availability';
import { UsernameUnavailableError } from './username-unavailable.error';

const USAGE = `Uso: pnpm accounts <operação> [argumentos]

Operações:
  create <e-mail> <nome> [--username <u>] [--title <cargo>] [--phone <tel>]
                             Cria a conta de uma Pessoa, já nos Canais públicos; a senha é lida do terminal
  update-profile <e-mail> [--title <cargo>] [--phone <tel>]
                             Troca o cargo e o telefone; o valor vazio ("") apaga
  reset-password <e-mail>    Troca a senha (lida do terminal) e revoga todas as Sessões
  revoke-sessions <e-mail>   Apaga todas as Sessões da Pessoa
  set-admin <e-mail|@usuário> on|off
                             Dá ou tira o papel de administrador
  set-data-access <e-mail|@usuário> on|off
                             Liga ou desliga a Permissão de dados
  create-bot <@usuário> <nome>
                             Cria o bot de um Agente, que reserva o @usuário dele
  purge-expired-sessions     Apaga as Sessões vencidas`;

// Comando de contas de quem opera a instalação (spec da F01, "Comando de contas").
// Devolve o código de saída do processo.
export class AccountsCommand implements Command {
  private readonly usernames: UsernameAvailability;

  constructor(
    private readonly people: PeopleService,
    private readonly conversations: ConversationsService,
    private readonly sessions: SessionsService,
    private readonly bots: BotsService,
    private readonly prompt: PasswordPrompt,
    private readonly output: CommandOutput,
  ) {
    this.usernames = new UsernameAvailability(people, bots);
  }

  async run(args: string[]): Promise<number> {
    const [operation, ...rest] = args;
    try {
      switch (operation) {
        case 'create':
          return await this.create(rest);
        case 'update-profile':
          return await this.updateProfile(rest);
        case 'reset-password':
          return await this.resetPassword(rest);
        case 'revoke-sessions':
          return await this.revokeSessions(rest);
        case 'set-admin':
          return await this.setAdmin(rest);
        case 'set-data-access':
          return await this.setDataAccess(rest);
        case 'create-bot':
          return await this.createBot(rest);
        case 'purge-expired-sessions':
          return await this.purgeExpiredSessions();
        default:
          this.output.error(USAGE);
          return 1;
      }
    } catch (error) {
      if (error instanceof DomainError) {
        this.output.error(error.message);
        return 1;
      }
      throw error;
    }
  }

  private async create(args: string[]): Promise<number> {
    const parsed = parseOptions(args, ['username', 'title', 'phone']);
    const [email, name] = parsed?.positional ?? [];
    if (
      !parsed ||
      parsed.positional.length !== 2 ||
      !email.trim() ||
      !name.trim()
    ) {
      this.output.error(
        'Uso: pnpm accounts create <e-mail> <nome> [--username <u>] [--title <cargo>] [--phone <tel>]',
      );
      return 1;
    }
    // O mesmo formato que o login aceita; fora dele, a conta nunca conseguiria entrar.
    if (!isEmail(email.trim())) {
      this.output.error(`E-mail inválido: ${email.trim()}`);
      return 1;
    }
    // Antes da senha: um valor fora da regra não faz quem opera digitá-la à toa.
    const { username, title, phone } = parsed.options;
    if (username !== undefined) {
      await this.assertUsernameFree(parseUsername(username));
    }
    if (title !== undefined) parseTitle(title);
    if (phone !== undefined) parsePhone(phone);
    const password = await this.askNewPassword('Senha: ');
    if (!password) return 1;
    // A Pessoa entra em todos os Canais públicos na mesma transação (spec da F02, história 11).
    const person = await this.conversations.createPersonInPublicChannels({
      email,
      name,
      password,
      ...parsed.options,
      // O @usuário derivado do e-mail também não pode ser o de um bot.
      isUsernameFree: (candidate) => this.usernames.isFree(candidate),
    });
    this.output.info(
      `Pessoa criada: ${person.email} (@${person.username}, ${person.id}).`,
    );
    return 0;
  }

  private async updateProfile(args: string[]): Promise<number> {
    const parsed = parseOptions(args, ['title', 'phone']);
    if (
      !parsed ||
      parsed.positional.length !== 1 ||
      !parsed.positional[0].trim() ||
      Object.keys(parsed.options).length === 0
    ) {
      this.output.error(
        'Uso: pnpm accounts update-profile <e-mail> [--title <cargo>] [--phone <tel>]',
      );
      return 1;
    }
    const person = await this.people.updateProfile(
      parsed.positional[0],
      parsed.options,
    );
    this.output.info(`Perfil de ${person.email} atualizado.`);
    return 0;
  }

  // A troca do hash e a revogação das Sessões são uma transação só: uma falha no meio não deixa
  // a senha nova com as Sessões antigas. Um login que conferiu a senha antiga ao mesmo tempo não
  // cria Sessão (SessionsService.startSession).
  private async resetPassword([email]: string[]): Promise<number> {
    const person = await this.requirePerson(email, 'reset-password <e-mail>');
    if (!person) return 1;
    const password = await this.askNewPassword('Senha nova: ');
    if (!password) return 1;
    const revoked = await this.people.changePassword(
      person.id,
      password,
      (manager) => this.sessions.revokeAll(person.id, manager),
    );
    this.output.info(
      `Senha trocada para ${person.email}; ${revoked} Sessão(ões) revogada(s).`,
    );
    return 0;
  }

  private async revokeSessions([email]: string[]): Promise<number> {
    const person = await this.requirePerson(email, 'revoke-sessions <e-mail>');
    if (!person) return 1;
    const revoked = await this.sessions.revokeAll(person.id);
    this.output.info(`${revoked} Sessão(ões) revogada(s) de ${person.email}.`);
    return 0;
  }

  // Dá ou tira o papel de administrador (spec da F10, "Comando de contas"). Não publica evento: a
  // mudança aparece na próxima carga da página e na próxima abertura do Perfil.
  private setAdmin(args: string[]): Promise<number> {
    return this.setFlag(
      args,
      'set-admin',
      (personId, value) => this.people.setAdmin(personId, value),
      {
        on: 'agora é administrador(a)',
        off: 'deixou de ser administrador(a)',
        alreadyOn: 'já era administrador(a)',
        alreadyOff: 'já não era administrador(a)',
      },
    );
  }

  // Liga ou desliga a Permissão de dados (spec da F13, "Permissão de dados"). Não publica evento: a
  // mudança vale no próximo Pedido e na próxima leitura de cada Mensagem.
  private setDataAccess(args: string[]): Promise<number> {
    return this.setFlag(
      args,
      'set-data-access',
      (personId, value) => this.people.setDataAccess(personId, value),
      {
        on: 'agora tem Permissão de dados',
        off: 'deixou de ter Permissão de dados',
        alreadyOn: 'já tinha Permissão de dados',
        alreadyOff: 'já não tinha Permissão de dados',
      },
    );
  }

  // Uma operação `<e-mail|@usuário> on|off`: grava só se mudar e diz o que aconteceu, depois do nome.
  private async setFlag(
    args: string[],
    operation: string,
    set: (personId: string, value: boolean) => Promise<boolean>,
    results: Record<'on' | 'off' | 'alreadyOn' | 'alreadyOff', string>,
  ): Promise<number> {
    const [identifier, value] = args;
    if (
      args.length !== 2 ||
      !identifier.trim() ||
      !['on', 'off'].includes(value)
    ) {
      this.output.error(
        `Uso: pnpm accounts ${operation} <e-mail|@usuário> on|off`,
      );
      return 1;
    }
    const person = await this.findByEmailOrUsername(identifier.trim());
    const on = value === 'on';
    const changed = await set(person.id, on);
    const result = changed
      ? on
        ? results.on
        : results.off
      : on
        ? results.alreadyOn
        : results.alreadyOff;
    this.output.info(`${person.name} ${result}.`);
    return 0;
  }

  // Cria o bot de um Agente (spec da F10, "Comando de contas"), com o @usuário livre nas Pessoas e
  // nos bots. O `@` do começo é aceito e ignorado.
  private async createBot(args: string[]): Promise<number> {
    const [informed, name] = args;
    if (args.length !== 2 || !informed.trim()) {
      this.output.error('Uso: pnpm accounts create-bot <@usuário> <nome>');
      return 1;
    }
    const username = parseUsername(informed.trim().replace(/^@/, ''));
    await this.assertUsernameFree(username);
    const bot = await this.bots.create({ username, name });
    this.output.info(`Bot criado: @${bot.username} (${bot.name}, ${bot.id}).`);
    return 0;
  }

  private async assertUsernameFree(username: string): Promise<void> {
    const owner = await this.usernames.ownerOf(username);
    if (owner) throw new UsernameUnavailableError(username, owner);
  }

  // Um argumento que começa com `@` é o @usuário; o resto é o e-mail.
  private async findByEmailOrUsername(identifier: string): Promise<Person> {
    if (identifier.startsWith('@')) {
      const username = identifier.slice(1);
      const person = await this.people.findByUsername(username);
      if (!person) throw new PersonNotFoundError(null, username);
      return person;
    }
    const person = await this.people.findByEmail(identifier);
    if (!person) throw new PersonNotFoundError(normalizeEmail(identifier));
    return person;
  }

  private async purgeExpiredSessions(): Promise<number> {
    const purged = await this.sessions.purgeExpired();
    this.output.info(`${purged} Sessão(ões) vencida(s) apagada(s).`);
    return 0;
  }

  private async requirePerson(
    email: string | undefined,
    usage: string,
  ): Promise<Person | null> {
    if (!email?.trim()) {
      this.output.error(`Uso: pnpm accounts ${usage}`);
      return null;
    }
    const person = await this.people.findByEmail(email);
    if (!person) throw new PersonNotFoundError(normalizeEmail(email));
    return person;
  }

  // A senha é digitada sem eco: pede duas vezes, para um erro de digitação não travar a conta.
  private async askNewPassword(question: string): Promise<string | null> {
    const password = await this.prompt.ask(question);
    if (!password) {
      this.output.error('A senha não pode ser vazia.');
      return null;
    }
    // Conta pontos de código, como o @MaxLength do login (um emoji vale um).
    if (Array.from(password).length > PASSWORD_MAX_LENGTH) {
      this.output.error(
        `A senha pode ter no máximo ${PASSWORD_MAX_LENGTH} caracteres.`,
      );
      return null;
    }
    const confirmation = await this.prompt.ask('Confirme a senha: ');
    if (confirmation !== password) {
      this.output.error('As senhas não conferem.');
      return null;
    }
    return password;
  }
}

type OptionName = 'username' | 'title' | 'phone';

interface ParsedArgs {
  positional: string[];
  options: Partial<Record<OptionName, string>>;
}

// `--nome valor`, com o valor no argumento seguinte, que pode ser vazio. Uma opção fora de
// `allowed`, repetida ou sem valor devolve null, e o comando mostra o uso.
function parseOptions(
  args: string[],
  allowed: OptionName[],
): ParsedArgs | null {
  const parsed: ParsedArgs = { positional: [], options: {} };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith('--')) {
      parsed.positional.push(arg);
      continue;
    }
    const name = arg.slice(2) as OptionName;
    const value = args[i + 1];
    if (
      !allowed.includes(name) ||
      name in parsed.options ||
      value === undefined
    ) {
      return null;
    }
    parsed.options[name] = value;
    i += 1;
  }
  return parsed;
}
