import { MigrationInterface, QueryRunner } from "typeorm";

// Escrita à mão: o Status da Pessoa (spec da F09, "Pessoas"), com os CHECKs que o TypeORM não
// acompanha. As colunas nascem nulas: ninguém tem Status ainda.
export class AddPersonStatus1794400000000 implements MigrationInterface {
    name = 'AddPersonStatus1794400000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "people" ADD "status_emoji" text`);
        await queryRunner.query(`ALTER TABLE "people" ADD "status_text" text`);
        await queryRunner.query(`ALTER TABLE "people" ADD CONSTRAINT "people_status_emoji_check" CHECK ("status_emoji" IN ('speech', 'headphones', 'calendar', 'meal', 'home', 'vacation', 'sick'))`);
        await queryRunner.query(`ALTER TABLE "people" ADD CONSTRAINT "people_status_text_check" CHECK (char_length("status_text") BETWEEN 1 AND 100 AND "status_text" !~ '[\\r\\n]')`);
        await queryRunner.query(`ALTER TABLE "people" ADD CONSTRAINT "people_status_check" CHECK ("status_text" IS NULL OR "status_emoji" IS NOT NULL)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "people" DROP CONSTRAINT "people_status_check"`);
        await queryRunner.query(`ALTER TABLE "people" DROP CONSTRAINT "people_status_text_check"`);
        await queryRunner.query(`ALTER TABLE "people" DROP CONSTRAINT "people_status_emoji_check"`);
        await queryRunner.query(`ALTER TABLE "people" DROP COLUMN "status_text"`);
        await queryRunner.query(`ALTER TABLE "people" DROP COLUMN "status_emoji"`);
    }

}
