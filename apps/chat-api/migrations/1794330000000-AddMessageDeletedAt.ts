import { MigrationInterface, QueryRunner } from "typeorm";

// A exclusão lógica da Mensagem (spec da F06, "Apagar"): o texto vira nulo e `deleted_at` é gravado.
// O CHECK, escrito à mão, garante que só a Mensagem apagada fica sem texto.
export class AddMessageDeletedAt1794330000000 implements MigrationInterface {
    name = 'AddMessageDeletedAt1794330000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "messages" ADD "deleted_at" TIMESTAMP WITH TIME ZONE`);
        await queryRunner.query(`ALTER TABLE "messages" ALTER COLUMN "body" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "messages" DROP CONSTRAINT "messages_body_length_check"`);
        await queryRunner.query(`ALTER TABLE "messages" ADD CONSTRAINT "messages_body_check" CHECK (("deleted_at" IS NULL AND "body" IS NOT NULL AND char_length("body") BETWEEN 1 AND 4000) OR ("deleted_at" IS NOT NULL AND "body" IS NULL))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM "messages" WHERE "deleted_at" IS NOT NULL OR "body" IS NULL`);
        await queryRunner.query(`ALTER TABLE "messages" DROP CONSTRAINT "messages_body_check"`);
        await queryRunner.query(`ALTER TABLE "messages" ADD CONSTRAINT "messages_body_length_check" CHECK (char_length("body") BETWEEN 1 AND 4000)`);
        await queryRunner.query(`ALTER TABLE "messages" ALTER COLUMN "body" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "messages" DROP COLUMN "deleted_at"`);
    }

}
