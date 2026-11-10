import { TransactionHost } from '@nestjs-cls/transactional';
import { TransactionalAdapterTypeOrm } from '@nestjs-cls/transactional-adapter-typeorm';
import { Injectable } from '@nestjs/common';
import { UNREAD_COUNT_LIMIT } from './unread-values';

// A Última leitura nula vale como antes da primeira Mensagem: o menor uuid. Uma faixa simples
// (`id > x`), em vez de um OR com a nula, deixa o índice (conversation_id, id) ler só as Mensagens
// depois da Última leitura.
const NOTHING_READ = '00000000-0000-0000-0000-000000000000';

// O que uma Pessoa tem de novo numa Conversa (spec da F07, "Última leitura e contagem").
export interface Unread {
  lastReadMessageId: string | null;
  unreadCount: number;
  mentionCount: number;
}

// Sem nada de novo: o de quem não tem participação na Conversa.
export const EMPTY_UNREAD: Unread = {
  lastReadMessageId: null,
  unreadCount: 0,
  mentionCount: 0,
};

// Uma participação: a Conversa e a Pessoa.
export type MemberKey = { conversationId: string; personId: string };

// A chave do mapa de contagens.
export function memberKey({ conversationId, personId }: MemberKey): string {
  return `${conversationId}:${personId}`;
}

// As Não lidas e as Menções calculadas a partir da Última leitura, e não gravadas (ADR 0026): as
// Mensagens da Conversa posteriores a ela, de outro autor e não apagadas, e as Menções à Pessoa
// entre elas, cada contagem parando no teto. As Não lidas saem do índice de Mensagens por Conversa
// e id; as Menções, do índice de Menções por Pessoa e Mensagem, para um Canal movimentado sem
// Menções não custar uma leitura por Mensagem. Cruza as tabelas de Mensagens, como a busca de Membros
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
                    AND message.id > COALESCE(member.last_read_message_id, $4::uuid)
                  LIMIT $3) AS unread) AS unread_count,
              (SELECT count(*)::int FROM (
                 SELECT 1 FROM message_mentions mention
                   JOIN messages message ON message.id = mention.message_id
                  WHERE mention.person_id = member.person_id
                    AND mention.message_id > COALESCE(member.last_read_message_id, $4::uuid)
                    AND message.conversation_id = member.conversation_id
                    AND message.author_id <> member.person_id
                    AND message.deleted_at IS NULL
                  LIMIT $3) AS mentioned) AS mention_count
         FROM unnest($1::uuid[], $2::uuid[]) AS pair(conversation_id, person_id)
         JOIN conversation_members member
           ON member.conversation_id = pair.conversation_id
          AND member.person_id = pair.person_id`,
      [
        members.map((member) => member.conversationId),
        members.map((member) => member.personId),
        UNREAD_COUNT_LIMIT,
        NOTHING_READ,
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
