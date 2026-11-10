import { MigrationInterface, QueryRunner } from "typeorm";

// A hora da última edição que mudou o texto da Mensagem (spec da F06, "Mensagens").
export class AddMessageEditedAt1794320000000 implements MigrationInterface {
    name = 'AddMessageEditedAt1794320000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "messages" ADD "edited_at" TIMESTAMP WITH TIME ZONE`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "messages" DROP COLUMN "edited_at"`);
    }

}
