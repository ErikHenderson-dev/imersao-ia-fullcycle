import { MigrationInterface, QueryRunner } from "typeorm";

// A exclusão em cascata de uma Pessoa procura as Conversas diretas pela segunda coluna do par, que a
// única (low, high) não cobre (code-review da F05-T04).
export class AddDirectPersonHighIndex1794310000000 implements MigrationInterface {
    name = 'AddDirectPersonHighIndex1794310000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "conversations_direct_person_high_idx" ON "conversations" ("direct_person_high_id") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."conversations_direct_person_high_idx"`);
    }

}
