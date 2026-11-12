import { MigrationInterface, QueryRunner } from "typeorm";

// A marca "dados de negócio" na Mensagem (spec da F13, "Marca e Resposta bloqueada"). As Mensagens
// que já existem ficam sem ela.
export class AddMessageBusinessData1794510000000 implements MigrationInterface {
    name = 'AddMessageBusinessData1794510000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "messages" ADD "business_data" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "messages" DROP COLUMN "business_data"`);
    }

}
