import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Injectable } from '@nestjs/common';
import {
  NOTHING_READ,
  UNREAD_COUNT_LIMIT,
} from '../conversations/unread-values';

// O tipo de uma Notificação (spec da F08, "Notificações e contagem").
export type NotificationKind = 'mention' | 'direct';

// O filtro da lista de Atividade: todas, só as Menções ou só as Mensagens diretas.
export type ActivityFilter = 'all' | 'mentions' | 'direct';

export interface NotificationRef {
  messageId: string;
  conversationId: string;
  kind: NotificationKind;
}

export interface NotificationPage {
  notifications: NotificationRef[];
  hasMore: boolean;
}

// Os números de Atividade de uma Pessoa, cada um parando no teto.
export interface ActivityCounts {
  // A marca de "Marcar tudo como lido", ou nula.
  activityReadMessageId: string | null;
  totalCount: number;
  mentionCount: number;
  directCount: number;
}

// As Menções à Pessoa `person.id` em Canais de que ela é Membro hoje, de outro autor e não
// apagadas, a partir do índice de Menções por Pessoa e Mensagem. `member` é a participação, para a
// Última leitura. Quem usa acrescenta o filtro de id em `mention.message_id`.
const MENTIONS_OF_PERSON = `
    FROM message_mentions mention
    JOIN messages message ON message.id = mention.message_id
    JOIN conversations conversation ON conversation.id = message.conversation_id
    JOIN conversation_members member
      ON member.conversation_id = message.conversation_id
     AND member.person_id = mention.person_id
   WHERE mention.person_id = person.id
     AND conversation.kind <> 'direct'
     AND message.author_person_id <> person.id
     AND message.deleted_at IS NULL`;

// As Mensagens de outro autor, não apagadas, na Conversa direta `member` de `person.id`, pelo
// índice de Mensagens por Conversa e id. A Conversa consigo mesma fica fora pelo autor. Quem usa
// acrescenta o filtro de id em `message.id`. A Mensagem de bot fica fora de propósito: o
// `author_person_id` nulo nunca passa no `<>` (spec da F11, "Autor da Mensagem").
const DIRECT_OF_MEMBER = `
    FROM messages message
   WHERE message.conversation_id = member.conversation_id
     AND message.author_person_id <> person.id
     AND message.deleted_at IS NULL`;

// As Conversas diretas de que `person.id` é Membro: as participações, e a condição da Pessoa, que
// vem depois das junções de quem usa.
const DIRECT_MEMBERS = `
    FROM conversation_members member
    JOIN conversations conversation
      ON conversation.id = member.conversation_id
     AND conversation.kind = 'direct'`;
const OF_PERSON = `WHERE member.person_id = person.id`;

// As Notificações de uma Pessoa, calculadas e não gravadas (ADR 0027): a função única que a lista,
// os números e o evento usam (spec da F08, "Notificações e contagem"). Cruza as tabelas de Mensagens
// e de Menções, como a contagem da F07, porque o módulo de Mensagens não pode depender deste.
@Injectable()
export class NotificationFinder {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
  ) {}

  // As `limit` Notificações anteriores a `before` (ou as mais novas), em ordem cronológica, e se há
  // mais antigas. Cada fonte lê só as `limit + 1` mais novas, as diretas por Conversa, e as duas se
  // juntam pelo id.
  async listPage(
    personId: string,
    filter: ActivityFilter,
    { before, limit }: { before?: string; limit: number },
  ): Promise<NotificationPage> {
    const mentions = `(
      SELECT mention.message_id, message.conversation_id, 'mention' AS kind
        ${MENTIONS_OF_PERSON}
         AND ($2::uuid IS NULL OR mention.message_id < $2::uuid)
       ORDER BY mention.message_id DESC
       LIMIT $3)`;
    const direct = `(
      SELECT recent.message_id, recent.conversation_id, 'direct' AS kind
        ${DIRECT_MEMBERS}
       CROSS JOIN LATERAL (
         SELECT message.id AS message_id, message.conversation_id
           ${DIRECT_OF_MEMBER}
            AND ($2::uuid IS NULL OR message.id < $2::uuid)
          ORDER BY message.id DESC
          LIMIT $3) AS recent
       ${OF_PERSON})`;
    const sources = [
      ...(filter === 'direct' ? [] : [mentions]),
      ...(filter === 'mentions' ? [] : [direct]),
    ];
    const rows = await this.txHost.tx.query<
      { message_id: string; conversation_id: string; kind: NotificationKind }[]
    >(
      `SELECT notification.message_id, notification.conversation_id, notification.kind
         FROM (SELECT $1::uuid AS id) AS person
        CROSS JOIN LATERAL (${sources.join(' UNION ALL ')}) AS notification
        ORDER BY notification.message_id DESC
        LIMIT $3`,
      [personId, before ?? null, limit + 1],
    );
    const hasMore = rows.length > limit;
    const notifications = rows
      .slice(0, limit)
      .reverse()
      .map((row) => ({
        messageId: row.message_id,
        conversationId: row.conversation_id,
        kind: row.kind,
      }));
    return { notifications, hasMore };
  }

  // Os números de várias Pessoas numa consulta só: as Notificações posteriores ao maior entre a
  // Última leitura da Conversa e a marca de Atividade, por tipo, cada contagem parando no teto, e o
  // total também.
  async countFor(personIds: string[]): Promise<Map<string, ActivityCounts>> {
    if (personIds.length === 0) return new Map();
    const rows = await this.txHost.tx.query<
      {
        person_id: string;
        activity_read_message_id: string | null;
        mention_count: number;
        direct_count: number;
      }[]
    >(
      `SELECT person.id AS person_id, person.activity_read_message_id,
              (SELECT count(*)::int FROM (
                 SELECT 1 ${MENTIONS_OF_PERSON}
                    AND mention.message_id > GREATEST(
                          COALESCE(member.last_read_message_id, $3::uuid),
                          COALESCE(person.activity_read_message_id, $3::uuid))
                  LIMIT $2) AS mentioned) AS mention_count,
              (SELECT count(*)::int FROM (
                 SELECT 1 ${DIRECT_MEMBERS}
                  CROSS JOIN LATERAL (
                    SELECT 1 ${DIRECT_OF_MEMBER}
                       AND message.id > GREATEST(
                             COALESCE(member.last_read_message_id, $3::uuid),
                             COALESCE(person.activity_read_message_id, $3::uuid))
                     LIMIT $2) AS unread
                  ${OF_PERSON}
                  LIMIT $2) AS direct) AS direct_count
         FROM people person
        WHERE person.id = ANY($1::uuid[])`,
      [personIds, UNREAD_COUNT_LIMIT, NOTHING_READ],
    );
    return new Map(
      rows.map((row) => [
        row.person_id,
        {
          activityReadMessageId: row.activity_read_message_id,
          mentionCount: row.mention_count,
          directCount: row.direct_count,
          totalCount: Math.min(
            row.mention_count + row.direct_count,
            UNREAD_COUNT_LIMIT,
          ),
        },
      ]),
    );
  }

  // Avança a marca de Atividade até a Mensagem, só para frente (spec da F08, "Avançar a marca de
  // Atividade"). A Mensagem precisa ser de uma Conversa de que a Pessoa é Membro, apagada ou não,
  // porque é só uma posição. Devolve se a Mensagem vale e se a marca avançou.
  async advanceMark(
    personId: string,
    messageId: string,
  ): Promise<{ isKnown: boolean; advanced: boolean }> {
    const rows = await this.txHost.tx.query<{ advanced: boolean }[]>(
      `WITH known AS (
         SELECT message.id
           FROM messages message
           JOIN conversation_members member
             ON member.conversation_id = message.conversation_id
            AND member.person_id = $1
          WHERE message.id = $2
       ), moved AS (
         UPDATE people
            SET activity_read_message_id = $2
          WHERE id = $1
            AND EXISTS (SELECT 1 FROM known)
            AND (activity_read_message_id IS NULL OR activity_read_message_id < $2)
         RETURNING 1
       )
       SELECT EXISTS (SELECT 1 FROM moved) AS advanced
         FROM known`,
      [personId, messageId],
    );
    return { isKnown: rows.length > 0, advanced: rows[0]?.advanced ?? false };
  }

  // Os números de uma Pessoa.
  async countOne(personId: string): Promise<ActivityCounts> {
    const counts = await this.countFor([personId]);
    return (
      counts.get(personId) ?? {
        activityReadMessageId: null,
        totalCount: 0,
        mentionCount: 0,
        directCount: 0,
      }
    );
  }
}
