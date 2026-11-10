import { MigrationInterface, QueryRunner } from "typeorm";

// A marca de Atividade de cada Pessoa, nula até ela marcar tudo como lido (spec da F08,
// "Notificações e contagem"; ADR 0027). A exclusão de Mensagem é lógica, então a referência não tem
// ação de cascata.

export class AddPersonActivityRead1794380000000 implements MigrationInterface {
    name = 'AddPersonActivityRead1794380000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "people" ADD "activity_read_message_id" uuid`);
        await queryRunner.query(`ALTER TABLE "people" ADD CONSTRAINT "FK_b3e938383c9643a7942fe737cb7" FOREIGN KEY ("activity_read_message_id") REFERENCES "messages"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "people" DROP CONSTRAINT "FK_b3e938383c9643a7942fe737cb7"`);
        await queryRunner.query(`ALTER TABLE "people" DROP COLUMN "activity_read_message_id"`);
    }

}
