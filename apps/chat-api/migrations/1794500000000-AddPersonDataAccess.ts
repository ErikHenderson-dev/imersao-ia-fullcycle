import { MigrationInterface, QueryRunner } from "typeorm";

// A Permissão de dados (spec da F13, "Permissão de dados"). Quem já existe começa sem ela.
export class AddPersonDataAccess1794500000000 implements MigrationInterface {
    name = 'AddPersonDataAccess1794500000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "people" ADD "data_access" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "people" DROP COLUMN "data_access"`);
    }

}
