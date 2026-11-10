import { MigrationInterface, QueryRunner } from "typeorm";
import { backfillLastRead } from "./support/backfill-last-read";

// A Última leitura de cada participação (spec da F07, "Última leitura e contagem"; ADR 0026). A
// exclusão de Mensagem é lógica, então a referência não tem ação de cascata.
export class AddMemberLastRead1794360000000 implements MigrationInterface {
    name = 'AddMemberLastRead1794360000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "conversation_members" ADD "last_read_message_id" uuid`);
        await queryRunner.query(`ALTER TABLE "conversation_members" ADD CONSTRAINT "FK_79721b781d08835e5093c2140f4" FOREIGN KEY ("last_read_message_id") REFERENCES "messages"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await backfillLastRead(queryRunner);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "conversation_members" DROP CONSTRAINT "FK_79721b781d08835e5093c2140f4"`);
        await queryRunner.query(`ALTER TABLE "conversation_members" DROP COLUMN "last_read_message_id"`);
    }

}
