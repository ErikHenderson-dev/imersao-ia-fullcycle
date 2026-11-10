import { randomUUID, randomUUIDv7 } from "node:crypto";
import { Pool } from "pg";
import { TEST_PASSWORD, TEST_PASSWORD_HASH } from "./test-person";

// Os testes da web rodam contra o banco chat do ambiente de desenvolvimento. Cada Pessoa de
// teste tem e-mail de prefixo e2e- no domínio teste.local (LLD, "Ambiente de desenvolvimento").
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });

export type TestPerson = {
  id: string;
  name: string;
  email: string;
  username: string;
  password: string;
};

export async function insertPerson(
  name = "Ana Souza",
  profile: { title?: string; phone?: string } = {},
): Promise<TestPerson> {
  const id = randomUUIDv7();
  const email = `e2e-${randomUUIDv7()}@teste.local`;
  // Aleatório de ponta a ponta: o começo do UUID v7 do e-mail é a hora, e o @usuário tem só 30
  // caracteres (spec da F05, "Pessoas").
  const username = `e2e-${randomUUID().replaceAll("-", "").slice(0, 24)}`;
  await pool.query(
    `INSERT INTO people (id, email, name, password_hash, username, title, phone)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [id, email, name, TEST_PASSWORD_HASH, username, profile.title ?? null, profile.phone ?? null],
  );
  return { id, name, email, username, password: TEST_PASSWORD };
}

// Revoga todas as Sessões da Pessoa, como o comando de contas faria.
export async function deleteSessionsOf(personId: string): Promise<void> {
  await pool.query("DELETE FROM sessions WHERE person_id = $1", [personId]);
}

export async function countSessionsOf(personId: string): Promise<number> {
  const result = await pool.query<{ count: string }>(
    "SELECT count(*) FROM sessions WHERE person_id = $1",
    [personId],
  );
  return Number(result.rows[0].count);
}

export type TestChannel = { id: string; name: string; topic: string | null };

// Canal criado direto no banco, público a menos que o teste peça o privado, com nome de prefixo e2e- e só as participações das
// Pessoas que o teste passa: isola o teste dos Canais de outros testes e do desenvolvimento (spec
// da F02, "Decisões de teste").
export async function insertChannel(
  members: TestPerson[],
  options: { name?: string; topic?: string | null; kind?: "public_channel" | "private_channel" } = {},
): Promise<TestChannel> {
  const id = randomUUIDv7();
  const name = options.name ?? `e2e-${randomUUIDv7()}`;
  const topic = options.topic === undefined ? "Canal de teste" : options.topic;
  await pool.query(
    "INSERT INTO conversations (id, kind, name, topic) VALUES ($1, $2, $3, $4)",
    [id, options.kind ?? "public_channel", name, topic],
  );
  await pool.query(
    `INSERT INTO conversation_members (id, conversation_id, person_id)
     SELECT member_id, $1, person_id FROM unnest($2::uuid[], $3::uuid[]) AS rows(member_id, person_id)`,
    [id, members.map(() => randomUUIDv7()), members.map((member) => member.id)],
  );
  return { id, name, topic };
}

// UUID v7 com o instante pedido, para as Mensagens ficarem na ordem das datas.
function uuidV7At(milliseconds: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let time = BigInt(milliseconds);
  for (let index = 5; index >= 0; index -= 1) {
    bytes[index] = Number(time & BigInt(0xff));
    time >>= BigInt(8);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Buffer.from(bytes).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export type TestMessage = { id: string; body: string; createdAt: Date };

// Mensagens direto no banco, em datas conhecidas e na ordem em que vêm.
export async function insertMessages(
  channel: TestChannel,
  messages: { author: TestPerson; body: string; at: Date; quotedMessageId?: string }[],
): Promise<TestMessage[]> {
  const inserted = messages.map((message) => ({
    id: uuidV7At(message.at.getTime()),
    body: message.body,
    createdAt: message.at,
  }));
  await pool.query(
    `INSERT INTO messages (id, conversation_id, author_id, client_id, body, created_at, updated_at, quoted_message_id)
     SELECT id, $1, author_id, client_id, body, at, at, quoted
     FROM unnest($2::uuid[], $3::uuid[], $4::uuid[], $5::text[], $6::timestamptz[], $7::uuid[])
       AS rows(id, author_id, client_id, body, at, quoted)`,
    [
      channel.id,
      inserted.map((message) => message.id),
      messages.map((message) => message.author.id),
      messages.map(() => randomUUIDv7()),
      messages.map((message) => message.body),
      messages.map((message) => message.at),
      messages.map((message) => message.quotedMessageId ?? null),
    ],
  );
  return inserted;
}

// Um histórico de `count` Mensagens da Pessoa, "Mensagem 1" a "Mensagem <count>", uma por minuto
// até um dia atrás.
export function insertHistory(
  channel: TestChannel,
  author: TestPerson,
  count: number,
): Promise<TestMessage[]> {
  const start = Date.now() - 86_400_000;
  return insertMessages(
    channel,
    Array.from({ length: count }, (_, index) => ({
      author,
      body: `Mensagem ${index + 1}`,
      at: new Date(start + index * 60_000),
    })),
  );
}

export async function countMessagesWithBody(channel: TestChannel, body: string): Promise<number> {
  const result = await pool.query<{ count: string }>(
    "SELECT count(*) FROM messages WHERE conversation_id = $1 AND body = $2",
    [channel.id, body],
  );
  return Number(result.rows[0].count);
}

// Canais criados pela tela nos testes de e2e/canais-publicos: apagar no fim do teste tira as
// participações de todas as Pessoas que a criação de um Canal público incluiu.
export async function deleteChannelsNamed(names: string[]): Promise<void> {
  await pool.query("DELETE FROM conversations WHERE name = ANY($1::text[])", [names]);
}

export async function countChannelsNamed(name: string): Promise<number> {
  const result = await pool.query<{ count: string }>(
    "SELECT count(*) FROM conversations WHERE name = $1",
    [name],
  );
  return Number(result.rows[0].count);
}

export async function membersOfChannelNamed(name: string): Promise<string[]> {
  const result = await pool.query<{ person_id: string }>(
    `SELECT m.person_id FROM conversation_members m
     JOIN conversations c ON c.id = m.conversation_id WHERE c.name = $1`,
    [name],
  );
  return result.rows.map((row) => row.person_id);
}

// O fuso gravado na Pessoa (F05-T03), ou null.
export async function timeZoneOf(personId: string): Promise<string | null> {
  const result = await pool.query<{ time_zone: string | null }>(
    "SELECT time_zone FROM people WHERE id = $1",
    [personId],
  );
  return result.rows[0]?.time_zone ?? null;
}

// Apaga a Mensagem direto no banco, sem o evento do tempo real: a tela ainda a mostra (F06).
export async function softDeleteMessage(id: string): Promise<void> {
  await pool.query(
    "UPDATE messages SET body = NULL, deleted_at = now() WHERE id = $1",
    [id],
  );
}

// Conversa direta entre as duas Pessoas, com as duas participações, direto no banco (F05).
export async function insertDirect(a: TestPerson, b: TestPerson): Promise<TestChannel> {
  const id = randomUUIDv7();
  const [low, high] = [a.id, b.id].sort();
  await pool.query(
    `INSERT INTO conversations (id, kind, direct_person_low_id, direct_person_high_id)
     VALUES ($1, 'direct', $2, $3)`,
    [id, low, high],
  );
  await pool.query(
    `INSERT INTO conversation_members (id, conversation_id, person_id)
     VALUES ($1, $3, $4), ($2, $3, $5)`,
    [randomUUIDv7(), randomUUIDv7(), id, a.id, b.id],
  );
  return { id, name: "", topic: null };
}

// A Menção da Pessoa numa Mensagem já gravada, direto no banco (F06).
export async function insertMention(messageId: string, person: TestPerson): Promise<void> {
  await pool.query(
    "INSERT INTO message_mentions (id, message_id, person_id) VALUES ($1, $2, $3)",
    [randomUUIDv7(), messageId, person.id],
  );
}

// A Última leitura da Pessoa na Conversa, direto no banco (F07).
export async function setLastRead(
  conversation: TestChannel,
  person: TestPerson,
  messageId: string | null,
): Promise<void> {
  await pool.query(
    "UPDATE conversation_members SET last_read_message_id = $3 WHERE conversation_id = $1 AND person_id = $2",
    [conversation.id, person.id, messageId],
  );
}
