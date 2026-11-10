import { MigrationInterface, QueryRunner } from "typeorm";

// Escrita à mão: a escolha de presença (spec da F09, "Pessoas"), com o CHECK. Quem já existe começa
// disponível.
export class AddPersonPresenceChoice1794410000000 implements MigrationInterface {
    name = 'AddPersonPresenceChoice1794410000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "people" ADD "presence_choice" text NOT NULL DEFAULT 'available'`);
        await queryRunner.query(`ALTER TABLE "people" ADD CONSTRAINT "people_presence_choice_check" CHECK ("presence_choice" IN ('available', 'away'))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "people" DROP CONSTRAINT "people_presence_choice_check"`);
        await queryRunner.query(`ALTER TABLE "people" DROP COLUMN "presence_choice"`);
    }

}
