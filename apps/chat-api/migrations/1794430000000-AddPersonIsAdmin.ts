import { MigrationInterface, QueryRunner } from "typeorm";

// O papel de administrador (spec da F10, "Papel de administrador"). Quem já existe começa sem ele.
export class AddPersonIsAdmin1794430000000 implements MigrationInterface {
    name = 'AddPersonIsAdmin1794430000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "people" ADD "is_admin" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "people" DROP COLUMN "is_admin"`);
    }

}
