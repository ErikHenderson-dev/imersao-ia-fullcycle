import type { Presence } from 'chat-events';
import {
  Propagation,
  Transactional,
  TransactionHost,
} from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Injectable } from '@nestjs/common';
import { EntityManager, In, IsNull, Not, Repository } from 'typeorm';
import { isUUID } from 'class-validator';
import { randomUUIDv7 } from 'node:crypto';
import { EmailAlreadyExistsError } from './email-already-exists.error';
import { normalizeEmail } from './normalize-email';
import { PasswordHasher } from './password-hasher';
import type { SummarySource } from './person-summary';
import { PersonNotFoundError } from './person-not-found.error';
import { canonicalTimeZone } from './time-zone';
import { Person } from './person.entity';
import {
  type Theme,
  parseName,
  parsePhone,
  parseStatus,
  parseTitle,
} from './profile-values';
import { UsernameTakenError } from './username-taken.error';
import { InvalidProfileError } from './invalid-profile.error';
import { parseUsername, usernameBase, usernameCandidates } from './username';

export interface NewPerson {
  email: string;
  name: string;
  password: string;
  // Sem ele, o @usuário vem do e-mail (spec da F05, "Pessoas").
  username?: string;
  title?: string;
  phone?: string;
}

// O que o comando de contas troca no Perfil: um campo ausente fica como está, e o vazio apaga.
export type ProfileChanges = Pick<NewPerson, 'title' | 'phone'>;

// O que muda no Perfil, pela própria Pessoa (spec da F09, "Rotas") ou pelo comando de contas: um campo ausente fica como está, e
// o nulo ou o vazio apagam o cargo e o telefone.
export interface PersonProfileChanges {
  name?: string;
  title?: string | null;
  phone?: string | null;
  statusEmoji?: string | null;
  statusText?: string | null;
}

// Quantas vezes a criação tenta o próximo sufixo quando outra criação, ao mesmo tempo, toma o
// @usuário derivado.
const USERNAME_ATTEMPTS = 5;

// Quantos candidatos de @usuário cada consulta confere.
const USERNAME_BATCH = 20;

@Injectable()
export class PeopleService {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
    private readonly passwords: PasswordHasher,
  ) {}

  // Pelo TransactionHost, para participar da transação de quem orquestra, quando há uma.
  private get people(): Repository<Person> {
    return this.txHost.tx.getRepository(Person);
  }

  async create(newPerson: NewPerson): Promise<Person> {
    const email = normalizeEmail(newPerson.email);
    const fields = {
      email,
      name: parseName(newPerson.name),
      title: parseTitle(newPerson.title ?? ''),
      phone: parsePhone(newPerson.phone ?? ''),
    };
    const informed =
      newPerson.username === undefined
        ? null
        : parseUsername(newPerson.username);
    // Antes do hash: o Argon2id é caro, e o e-mail repetido é o erro comum.
    if (await this.people.existsBy({ email })) {
      throw new EmailAlreadyExistsError(email);
    }
    if (informed && (await this.people.existsBy({ username: informed }))) {
      throw new UsernameTakenError(informed);
    }
    const passwordHash = await this.passwords.hash(newPerson.password);
    if (informed) {
      const person = await this.insert({
        ...fields,
        passwordHash,
        username: informed,
      });
      if (person) return person;
      await this.throwIfEmailTaken(email);
      throw new UsernameTakenError(informed);
    }
    const base = usernameBase(email);
    for (let attempt = 0; attempt < USERNAME_ATTEMPTS; attempt += 1) {
      const username = await this.freeUsername(base);
      const person = await this.insert({ ...fields, passwordHash, username });
      if (person) return person;
      await this.throwIfEmailTaken(email);
      // Outra criação, ao mesmo tempo, ficou com este @usuário: procura de novo.
    }
    throw new InvalidProfileError(
      `Não foi possível escolher um @usuário livre a partir de ${base}; tente de novo ou informe --username.`,
    );
  }

  // ON CONFLICT DO NOTHING, e não a captura do erro: a criação roda dentro da transação da
  // participação, que um erro de unicidade abortaria. Devolve null no conflito.
  private async insert(
    values: Omit<
      Person,
      | 'id'
      | 'createdAt'
      | 'updatedAt'
      | 'timeZone'
      | 'generateId'
      | 'activityReadMessageId'
      | 'activityReadMessage'
      | 'statusEmoji'
      | 'statusText'
      | 'presenceChoice'
      | 'theme'
      | 'isAdmin'
    >,
  ): Promise<Person | null> {
    const person = this.people.create({ ...values, id: randomUUIDv7() });
    const inserted = await this.people
      .createQueryBuilder()
      .insert()
      .values(person)
      .orIgnore()
      .returning([
        'created_at',
        'updated_at',
        'time_zone',
        'presence_choice',
        'theme',
        'is_admin',
      ])
      .execute();
    const [row] = inserted.raw as {
      created_at: Date;
      updated_at: Date;
      time_zone: string | null;
      presence_choice: Presence;
      theme: Theme;
      is_admin: boolean;
    }[];
    if (!row) return null;
    return this.people.merge(person, {
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      timeZone: row.time_zone,
      presenceChoice: row.presence_choice,
      theme: row.theme,
      isAdmin: row.is_admin,
    });
  }

  // Duas criações simultâneas passam pelo existsBy; o índice único decide.
  private async throwIfEmailTaken(email: string): Promise<void> {
    if (await this.people.existsBy({ email })) {
      throw new EmailAlreadyExistsError(email);
    }
  }

  // O primeiro candidato livre da base, conferido em lotes pelo índice único do @usuário.
  private async freeUsername(base: string): Promise<string> {
    for (let start = 0; ; start += USERNAME_BATCH) {
      const candidates = usernameCandidates(base, start + USERNAME_BATCH).slice(
        start,
      );
      const rows = await this.people
        .createQueryBuilder('person')
        .select('person.username', 'username')
        .where('person.username = ANY(:candidates)', { candidates })
        .getRawMany<{ username: string }>();
      const taken = new Set(rows.map((row) => row.username));
      const free = candidates.find((candidate) => !taken.has(candidate));
      if (free) return free;
    }
  }

  // Troca o cargo e o telefone (spec da F05, "Comando de contas"); o @usuário não muda.
  async updateProfile(email: string, changes: ProfileChanges): Promise<Person> {
    const person = await this.findByEmail(email);
    if (!person) throw new PersonNotFoundError(normalizeEmail(email));
    return (await this.updateProfileById(person.id, changes)).person;
  }

  // Grava o Perfil numa escrita só, depois de validar cada campo presente, e devolve a Pessoa de
  // antes e a de depois. A linha fica travada na transação: com outra gravação ao mesmo tempo, as
  // duas versões são as desta gravação.
  @Transactional()
  async updateProfileById(
    personId: string,
    changes: PersonProfileChanges,
  ): Promise<{ previous: Person; person: Person }> {
    const previous = await this.people.findOneOrFail({
      where: { id: personId },
      lock: { mode: 'pessimistic_write' },
    });
    const update: Partial<
      Pick<Person, 'name' | 'title' | 'phone' | 'statusEmoji' | 'statusText'>
    > = {};
    if (changes.name !== undefined) update.name = parseName(changes.name);
    if (changes.title !== undefined)
      update.title = parseTitle(changes.title ?? '');
    if (changes.phone !== undefined)
      update.phone = parsePhone(changes.phone ?? '');
    if (changes.statusEmoji !== undefined || changes.statusText !== undefined) {
      const status = parseStatus(
        { emoji: previous.statusEmoji, text: previous.statusText },
        { emoji: changes.statusEmoji, text: changes.statusText },
      );
      update.statusEmoji = status.emoji;
      update.statusText = status.text;
    }
    if (Object.keys(update).length > 0) {
      await this.people.update({ id: personId }, update);
    }
    return {
      previous,
      person: await this.people.findOneByOrFail({ id: personId }),
    };
  }

  // Devolve a Pessoa só quando a senha confere. O e-mail sem conta passa pelo hash
  // fictício, para o tempo de resposta não revelar se a conta existe.
  async verifyCredentials(
    email: string,
    password: string,
  ): Promise<Person | null> {
    const person = await this.findByEmail(email);
    if (!person) {
      await this.passwords.verifyDummy(password);
      return null;
    }
    const isValid = await this.passwords.verify(person.passwordHash, password);
    return isValid ? person : null;
  }

  // Roda `work` numa transação com a linha da Pessoa travada (FOR SHARE), só se o hash da senha
  // ainda for o que o login conferiu; devolve null se a senha mudou. Uma troca de senha ao mesmo
  // tempo faz a trava esperar e reavaliar o hash, e a troca que começa depois espera `work`
  // terminar, para a revogação que vem em seguida alcançar o que ele gravou.
  async withPasswordUnchanged<T>(
    person: Person,
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T | null> {
    return this.txHost.withTransaction(Propagation.RequiresNew, async () => {
      const locked = await this.people.findOne({
        where: { id: person.id, passwordHash: person.passwordHash },
        lock: { mode: 'pessimistic_read' },
      });
      return locked ? work(this.txHost.tx) : null;
    });
  }

  // Troca o hash e roda `alsoInTransaction` (a revogação das Sessões, no reset-password) na
  // mesma transação: ou as duas escritas valem, ou nenhuma. O hash é calculado antes, para o
  // Argon2id não segurar a trava da linha.
  async changePassword<T>(
    personId: string,
    password: string,
    alsoInTransaction: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    const passwordHash = await this.passwords.hash(password);
    return this.txHost.withTransaction(Propagation.RequiresNew, async () => {
      await this.people.update({ id: personId }, { passwordHash });
      return alsoInTransaction(this.txHost.tx);
    });
  }

  // Grava o nome canônico; o mesmo fuso de novo não grava nada.
  async saveTimeZone(personId: string, timeZone: string): Promise<void> {
    const canonical = canonicalTimeZone(timeZone);
    if (!canonical) throw new InvalidProfileError('Fuso inválido.');
    await this.people
      .createQueryBuilder()
      .update()
      .set({ timeZone: canonical })
      .where('id = :personId AND time_zone IS DISTINCT FROM :canonical', {
        personId,
        canonical,
      })
      .execute();
  }

  findByEmail(email: string): Promise<Person | null> {
    return this.people.findOneBy({ email: normalizeEmail(email) });
  }

  // Pelo @usuário, sem o `@` do começo (spec da F10, "Comando de contas").
  findByUsername(username: string): Promise<Person | null> {
    return this.people.findOneBy({ username: username.trim().toLowerCase() });
  }

  // Dá ou tira o papel de administrador (spec da F10, "Comando de contas"). Devolve se mudou: o
  // valor que já estava não grava nada.
  async setAdmin(personId: string, isAdmin: boolean): Promise<boolean> {
    const result = await this.people
      .createQueryBuilder()
      .update()
      .set({ isAdmin })
      .where('id = :personId AND is_admin <> :isAdmin', { personId, isAdmin })
      .execute();
    return (result.affected ?? 0) > 0;
  }

  // O Perfil de qualquer Pessoa (spec da F05, "Busca e Perfil"); um id que não é UUID é uma Pessoa
  // que não existe.
  async getProfile(id: string): Promise<Person> {
    const person = isUUID(id) ? await this.findById(id) : null;
    if (!person) throw new PersonNotFoundError(null);
    return person;
  }

  findById(id: string): Promise<Person | null> {
    return this.people.findOneBy({ id });
  }

  findByIds(ids: string[]): Promise<Person[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.people.findBy({ id: In(ids) });
  }

  // Busca pelo nome ou pelo @usuário, sem diferenciar maiúsculas, minúsculas e acentos, deixando de fora as Pessoas
  // de `excludeIds` (spec da F04, "Busca de Pessoas"). O banco filtra e corta em `limit`, pela
  // ordem do nome sem acento; quem chama reordena pela regra da aplicação.
  search(
    q: string,
    filter: { excludeIds: string[] } | { onlyIds: string[] },
    limit: number,
  ): Promise<Person[]> {
    // %, _ e \ do texto valem como literais no LIKE.
    // Os `@` do começo são do @usuário, e não do texto buscado (spec da F05, "Busca").
    const text = q.trim().replace(/^@+/, '').trim();
    const pattern = `%${text.replace(/[\\%_]/g, '\\$&')}%`;
    return this.people
      .createQueryBuilder('person')
      .where(
        "(unaccent(lower(person.name)) LIKE unaccent(lower(:pattern)) ESCAPE '\\' OR person.username LIKE lower(:pattern) ESCAPE '\\')",
        { pattern },
      )
      .andWhere(
        'excludeIds' in filter
          ? 'NOT (person.id = ANY(:ids))'
          : 'person.id = ANY(:ids)',
        { ids: 'excludeIds' in filter ? filter.excludeIds : filter.onlyIds },
      )
      .orderBy('unaccent(lower(person.name))', 'ASC')
      .limit(limit)
      .getMany();
  }

  // O id, o nome, o @usuário e o cargo das Pessoas pedidas, para as listas por nome.
  findSummariesByIds(ids: string[]): Promise<SummarySource[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.people.find({
      select: {
        id: true,
        name: true,
        username: true,
        title: true,
        statusEmoji: true,
        statusText: true,
      },
      where: { id: In(ids) },
    });
  }

  // Grava a escolha de presença e devolve a gravada, com a hora da gravação (spec da F09, "Rotas"):
  // com duas gravações ao mesmo tempo, a hora ordena as continuações.
  async savePresenceChoice(
    personId: string,
    choice: Presence,
  ): Promise<{ choice: Presence; savedAt: number }> {
    // A hora da escrita, depois de esperar a trava da linha, e não a do começo da transação: ela
    // segue a ordem das gravações. No UPDATE, o driver devolve [linhas, contagem].
    const [rows] = await this.txHost.tx.query<
      [{ presence_choice: Presence; updated_at: Date }[], number]
    >(
      `UPDATE people SET presence_choice = $2, updated_at = clock_timestamp()
        WHERE id = $1 RETURNING presence_choice, updated_at`,
      [personId, choice],
    );
    const [row] = rows;
    return { choice: row.presence_choice, savedAt: row.updated_at.getTime() };
  }

  // Grava o tema (spec da F09, "Rotas"); não publica: os outros navegadores o leem na próxima carga.
  async saveTheme(personId: string, theme: Theme): Promise<void> {
    await this.people.update({ id: personId }, { theme });
  }

  // Quem tem Status, para o retrato (spec da F09, "Rotas"): cresce com quem tem Status, e não com o
  // tamanho do workspace.
  listWithStatus(): Promise<Person[]> {
    return this.people.find({
      select: { id: true, statusEmoji: true, statusText: true },
      where: { statusEmoji: Not(IsNull()) },
    });
  }

  // Todas as Pessoas do workspace, para a participação em Canal público (ADR 0024).
  async listIds(): Promise<string[]> {
    const people = await this.people.find({ select: { id: true } });
    return people.map((person) => person.id);
  }
}
