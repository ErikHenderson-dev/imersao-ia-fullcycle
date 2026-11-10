import { MigrationInterface, QueryRunner } from "typeorm";

// As Menções de uma Pessoa na ordem das Mensagens, para a contagem de Menções Não lidas (spec da
// F07, "Última leitura e contagem"): substitui o índice só por person_id.

export class MentionsByPersonAndMessage1794370000000 implements MigrationInterface {
    name = 'MentionsByPersonAndMessage1794370000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."message_mentions_person_id_idx"`);
        await queryRunner.query(`CREATE INDEX "message_mentions_person_message_idx" ON "message_mentions"  ("person_id", "message_id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."message_mentions_person_message_idx"`);
        await queryRunner.query(`CREATE INDEX "message_mentions_person_id_idx" ON "message_mentions" USING btree ("person_id") `);
    }

}
