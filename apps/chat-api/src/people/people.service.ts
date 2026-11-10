import { Propagation, TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Injectable } from '@nestjs/common';
import { EntityManager, In, Repository } from 'typeorm';
import { randomUUIDv7 } from 'node:crypto';
import { EmailAlreadyExistsError } from './email-already-exists.error';
import { InvalidProfileError } from './invalid-profile.error';
import { normalizeEmail } from './normalize-email';
import { PasswordHasher } from './password-hasher';
import type { PersonSummary } from './person-summary';
import { PersonNotFoundError } from './person-not-found.error';
import { Person } from './person.entity';
import {
  normalizePhone,
  normalizeTitle,
  phoneProblem,
  titleProblem,
} from './profile-values';
import { UsernameTakenError } from './username-taken.error';
import { USERNAME_PATTERN, firstFreeUsername, usernameBase } from './username';

function checkedTitle(value: string | undefined): string | null {
  const title = value === undefined ? null : normalizeTitle(value);
  const problem = titleProblem(title);
  if (problem) throw new InvalidProfileError(problem);
  return title;
}

function checkedPhone(value: string | undefined): string | null {
  const phone = value === undefined ? null : normalizePhone(value);
  const problem = phoneProblem(phone);
  if (problem) throw new InvalidProfileError(problem);
  return phone;
}

function checkedUsername(value: string): string {
  const username = value.trim();
  if (!USERNAME_PATTERN.test(username)) {
    throw new InvalidProfileError(
      'O @usuário aceita letras de a a z sem acento, números, ., _ e -, de 2 a 30 caracteres, começando e terminando com letra ou número.',
    );
  }
  return username;
}

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
export interface ProfileChanges {
  title?: string;
  phone?: string;
}

// Quantas vezes a criação tenta o próximo sufixo quando outra criação, ao mesmo tempo, toma o
// @usuário derivado.
const USERNAME_ATTEMPTS = 5;

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
    const title = checkedTitle(newPerson.title);
    const phone = checkedPhone(newPerson.phone);
    const informed =
      newPerson.username === undefined
        ? null
        : checkedUsername(newPerson.username);
    if (await this.people.existsBy({ email })) {
      throw new EmailAlreadyExistsError(email);
    }
    const passwordHash = await this.passwords.hash(newPerson.password);
    for (let attempt = 0; attempt < USERNAME_ATTEMPTS; attempt += 1) {
      const username = informed ?? (await this.freeUsername(email));
      const person = this.people.create({
        id: randomUUIDv7(),
        email,
        name: newPerson.name.trim(),
        passwordHash,
        username,
        title,
        phone,
      });
      // ON CONFLICT DO NOTHING, e não captura do erro: a criação roda dentro da transação da
      // participação, que um erro de unicidade abortaria.
      const inserted = await this.people
        .createQueryBuilder()
        .insert()
        .values(person)
        .orIgnore()
        .returning(['created_at', 'updated_at'])
        .execute();
      if (inserted.raw.length > 0) {
        return this.people.findOneByOrFail({ id: person.id });
      }
      // Duas criações simultâneas passam pelo existsBy; o índice único decide.
      if (await this.people.existsBy({ email })) {
        throw new EmailAlreadyExistsError(email);
      }
      if (informed) throw new UsernameTakenError(informed);
    }
    throw new UsernameTakenError(usernameBase(email));
  }

  // O primeiro @usuário livre da base do e-mail, pelos que já existem com o mesmo começo.
  private async freeUsername(email: string): Promise<string> {
    const base = usernameBase(email);
    const prefix = base.slice(0, 20).replace(/[\\%_]/g, '\\$&');
    const rows = await this.people
      .createQueryBuilder('person')
      .select('person.username', 'username')
      .where("person.username LIKE :prefix ESCAPE '\\'", {
        prefix: `${prefix}%`,
      })
      .getRawMany<{ username: string }>();
    const taken = new Set(rows.map((row) => row.username));
    return firstFreeUsername(base, (candidate) => taken.has(candidate));
  }

  // Troca o cargo e o telefone (spec da F05, "Comando de contas"); o @usuário não muda.
  async updateProfile(email: string, changes: ProfileChanges): Promise<Person> {
    const person = await this.findByEmail(email);
    if (!person) throw new PersonNotFoundError(normalizeEmail(email));
    const update: Partial<Pick<Person, 'title' | 'phone'>> = {};
    if (changes.title !== undefined) update.title = checkedTitle(changes.title);
    if (changes.phone !== undefined) update.phone = checkedPhone(changes.phone);
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
