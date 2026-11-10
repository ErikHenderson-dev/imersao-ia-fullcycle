import { Propagation, TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Injectable } from '@nestjs/common';
import { EntityManager, In, Repository } from 'typeorm';
import { isUUID } from 'class-validator';
import { randomUUIDv7 } from 'node:crypto';
import { EmailAlreadyExistsError } from './email-already-exists.error';
import { normalizeEmail } from './normalize-email';
import { PasswordHasher } from './password-hasher';
import type { PersonSummary } from './person-summary';
import { PersonNotFoundError } from './person-not-found.error';
import { Person } from './person.entity';
import { parsePhone, parseTitle } from './profile-values';
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
      name: newPerson.name.trim(),
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
      'id' | 'createdAt' | 'updatedAt' | 'timeZone' | 'generateId'
    >,
  ): Promise<Person | null> {
    const person = this.people.create({ ...values, id: randomUUIDv7() });
    const inserted = await this.people
      .createQueryBuilder()
      .insert()
      .values(person)
      .orIgnore()
      .returning(['created_at', 'updated_at', 'time_zone'])
      .execute();
    const [row] = inserted.raw as {
      created_at: Date;
      updated_at: Date;
      time_zone: string | null;
    }[];
    if (!row) return null;
    return this.people.merge(person, {
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      timeZone: row.time_zone,
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
    const update: Partial<Pick<Person, 'title' | 'phone'>> = {};
    if (changes.title !== undefined) update.title = parseTitle(changes.title);
    if (changes.phone !== undefined) update.phone = parsePhone(changes.phone);
    if (Object.keys(update).length === 0) return person;
    await this.people.update({ id: person.id }, update);
    return this.people.findOneByOrFail({ id: person.id });
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

  findByEmail(email: string): Promise<Person | null> {
    return this.people.findOneBy({ email: normalizeEmail(email) });
  }

  // O Perfil de qualquer Pessoa (spec da F05, "Busca e Perfil"); um id que não é UUID é uma Pessoa
  // que não existe.
  async getProfile(id: string): Promise<Person> {
    const person = isUUID(id) ? await this.findById(id) : null;
    if (!person) throw new PersonNotFoundError();
    return person;
  }

  findById(id: string): Promise<Person | null> {
    return this.people.findOneBy({ id });
  }

  findByIds(ids: string[]): Promise<Person[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.people.findBy({ id: In(ids) });
  }

  // Busca pelo nome, sem diferenciar maiúsculas, minúsculas e acentos, deixando de fora as Pessoas
  // de `excludeIds` (spec da F04, "Busca de Pessoas"). O banco filtra e corta em `limit`, pela
  // ordem do nome sem acento; quem chama reordena pela regra da aplicação.
  search(q: string, excludeIds: string[], limit: number): Promise<Person[]> {
    // %, _ e \ do texto valem como literais no LIKE.
    const pattern = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
    return this.people
      .createQueryBuilder('person')
      .where(
        "unaccent(lower(person.name)) LIKE unaccent(lower(:pattern)) ESCAPE '\\'",
        { pattern },
      )
      .andWhere('NOT (person.id = ANY(:excludeIds))', { excludeIds })
      .orderBy('unaccent(lower(person.name))', 'ASC')
      .limit(limit)
      .getMany();
  }

  // Só o id e o nome das Pessoas pedidas, para as listas por nome.
  findSummariesByIds(ids: string[]): Promise<PersonSummary[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return this.people.find({
      select: { id: true, name: true },
      where: { id: In(ids) },
    });
  }

  // Todas as Pessoas do workspace, para a participação em Canal público (ADR 0024).
  async listIds(): Promise<string[]> {
    const people = await this.people.find({ select: { id: true } });
    return people.map((person) => person.id);
  }
}
