import { MigrationInterface, QueryRunner } from "typeorm";

// A Citação: a Mensagem a que esta responde, na mesma Conversa (spec da F06, "Mensagens"). A
// exclusão da Mensagem é lógica, então a referência não tem ação de cascata.
export class AddMessageQuote1794350000000 implements MigrationInterface {
    name = 'AddMessageQuote1794350000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "messages" ADD "quoted_message_id" uuid`);
        await queryRunner.query(`CREATE INDEX "messages_quoted_message_id_idx" ON "messages" ("quoted_message_id") `);
        await queryRunner.query(`ALTER TABLE "messages" ADD CONSTRAINT "FK_3ef8470d228a7052a7a8854c93d" FOREIGN KEY ("quoted_message_id") REFERENCES "messages"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "messages" DROP CONSTRAINT "FK_3ef8470d228a7052a7a8854c93d"`);
        await queryRunner.query(`DROP INDEX "public"."messages_quoted_message_id_idx"`);
        await queryRunner.query(`ALTER TABLE "messages" DROP COLUMN "quoted_message_id"`);
    }

}
