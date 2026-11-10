import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Injectable } from '@nestjs/common';
import { UNREAD_COUNT_LIMIT } from './unread-values';

// O que uma Pessoa tem de novo numa Conversa (spec da F07, "Última leitura e contagem").
export interface Unread {
  lastReadMessageId: string | null;
  unreadCount: number;
  mentionCount: number;
}

// Uma participação: a Conversa e a Pessoa.
export type MemberKey = { conversationId: string; personId: string };

// A chave do mapa de contagens.
export function memberKey({ conversationId, personId }: MemberKey): string {
  return `${conversationId}:${personId}`;
}

// As Não lidas e as Menções calculadas a partir da Última leitura, e não gravadas (ADR 0026): as
// Mensagens da Conversa posteriores a ela, de outro autor e não apagadas, e as Menções à Pessoa
// entre elas, cada contagem parando no teto. Cruza as tabelas de Mensagens, como a busca de Membros
// por @usuário cruza a de Pessoas: o módulo de Mensagens depende deste, e o contrário seria um
// ciclo.
@Injectable()
export class UnreadCounter {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterTypeOrm>,
  ) {}

  // As contagens de várias participações numa consulta só, com uma subconsulta limitada por par.
  // A participação que não existe fica fora do mapa.
  async countFor(members: MemberKey[]): Promise<Map<string, Unread>> {
    if (members.length === 0) return new Map();
    const rows = await this.txHost.tx.query<
      {
        conversation_id: string;
        person_id: string;
        last_read_message_id: string | null;
        unread_count: number;
        mention_count: number;
      }[]
    >(
      `SELECT member.conversation_id, member.person_id, member.last_read_message_id,
              (SELECT count(*)::int FROM (
                 SELECT 1 FROM messages message
                  WHERE message.conversation_id = member.conversation_id
                    AND message.author_id <> member.person_id
                    AND message.deleted_at IS NULL
                    AND (member.last_read_message_id IS NULL
                         OR message.id > member.last_read_message_id)
                  LIMIT $3) AS unread) AS unread_count,
              (SELECT count(*)::int FROM (
                 SELECT 1 FROM messages message
                   JOIN message_mentions mention
                     ON mention.message_id = message.id
                    AND mention.person_id = member.person_id
                  WHERE message.conversation_id = member.conversation_id
                    AND message.author_id <> member.person_id
                    AND message.deleted_at IS NULL
                    AND (member.last_read_message_id IS NULL
                         OR message.id > member.last_read_message_id)
                  LIMIT $3) AS mentioned) AS mention_count
         FROM unnest($1::uuid[], $2::uuid[]) AS pair(conversation_id, person_id)
         JOIN conversation_members member
           ON member.conversation_id = pair.conversation_id
          AND member.person_id = pair.person_id`,
      [
        members.map((member) => member.conversationId),
        members.map((member) => member.personId),
        UNREAD_COUNT_LIMIT,
      ],
    );
    return new Map(
      rows.map((row) => [
        memberKey({
          conversationId: row.conversation_id,
          personId: row.person_id,
        }),
        {
          lastReadMessageId: row.last_read_message_id,
          unreadCount: row.unread_count,
          mentionCount: row.mention_count,
        },
      ]),
    );
  }
}
