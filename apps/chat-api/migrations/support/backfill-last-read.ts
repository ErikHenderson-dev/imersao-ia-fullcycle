import { QueryRunner } from "typeorm";

// Fora da pasta das migrações: o TypeORM trata cada export de lá como uma migração.
// Põe cada participação sem Última leitura na última Mensagem da Conversa, apagada ou não, ou a
// deixa nula numa Conversa sem Mensagens: quem já usa o chat começa com tudo lido (spec da F07,
// "Última leitura e contagem", "Migração"). Com `conversationIds`, só nessas Conversas, para o
// teste não mexer nas participações das outras suítes, que rodam ao mesmo tempo no mesmo banco.
export async function backfillLastRead(
    queryRunner: QueryRunner,
    conversationIds?: string[],
): Promise<void> {
    await queryRunner.query(
        `UPDATE "conversation_members" AS "member"
            SET "last_read_message_id" = (
              SELECT "message"."id" FROM "messages" AS "message"
               WHERE "message"."conversation_id" = "member"."conversation_id"
               ORDER BY "message"."id" DESC
               LIMIT 1
            )
          WHERE "member"."last_read_message_id" IS NULL
            AND ($1::uuid[] IS NULL OR "member"."conversation_id" = ANY($1::uuid[]))`,
        [conversationIds ?? null],
    );
}
