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

export async function insertPerson(name = "Ana Souza"): Promise<TestPerson> {
  const id = randomUUIDv7();
  const email = `e2e-${randomUUIDv7()}@teste.local`;
  // Aleatório de ponta a ponta: o começo do UUID v7 do e-mail é a hora, e o @usuário tem só 30
  // caracteres (spec da F05, "Pessoas").
  const username = `e2e-${randomUUID().replaceAll("-", "").slice(0, 24)}`;
  await pool.query(
    "INSERT INTO people (id, email, name, password_hash, username) VALUES ($1, $2, $3, $4, $5)",
    [id, email, name, TEST_PASSWORD_HASH, username],
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
  messages: { author: TestPerson; body: string; at: Date }[],
): Promise<TestMessage[]> {
  const inserted = messages.map((message) => ({
    id: uuidV7At(message.at.getTime()),
    body: message.body,
    createdAt: message.at,
  }));
  await pool.query(
    `INSERT INTO messages (id, conversation_id, author_id, client_id, body, created_at, updated_at)
     SELECT id, $1, author_id, client_id, body, at, at
     FROM unnest($2::uuid[], $3::uuid[], $4::uuid[], $5::text[], $6::timestamptz[])
       AS rows(id, author_id, client_id, body, at)`,
    [
      channel.id,
      inserted.map((message) => message.id),
      messages.map((message) => message.author.id),
      messages.map(() => randomUUIDv7()),
      messages.map((message) => message.body),
      messages.map((message) => message.at),
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
