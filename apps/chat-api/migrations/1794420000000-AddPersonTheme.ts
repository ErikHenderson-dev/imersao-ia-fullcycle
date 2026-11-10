import { MigrationInterface, QueryRunner } from "typeorm";

// Escrita à mão: o tema da Pessoa (spec da F09, "Pessoas"), com o CHECK. Quem já existe começa no
// claro.
export class AddPersonTheme1794420000000 implements MigrationInterface {
    name = 'AddPersonTheme1794420000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "people" ADD "theme" text NOT NULL DEFAULT 'light'`);
        await queryRunner.query(`ALTER TABLE "people" ADD CONSTRAINT "people_theme_check" CHECK ("theme" IN ('light', 'dark'))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "people" DROP CONSTRAINT "people_theme_check"`);
        await queryRunner.query(`ALTER TABLE "people" DROP COLUMN "theme"`);
    }

}
