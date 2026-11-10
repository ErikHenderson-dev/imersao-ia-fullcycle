import { MigrationInterface, QueryRunner } from "typeorm";

// Gerada e completada à mão: o TypeORM não percebe a mudança na expressão do CHECK do kind (plano da
// F05-T04, "Contrato").

export class AddDirectConversation1794300000000 implements MigrationInterface {
    name = 'AddDirectConversation1794300000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "conversations" DROP CONSTRAINT "conversations_kind_check", ADD CONSTRAINT "conversations_kind_check" CHECK ("kind" IN ('public_channel', 'private_channel', 'direct'))`);
        await queryRunner.query(`ALTER TABLE "conversations" ADD "direct_person_low_id" uuid`);
        await queryRunner.query(`ALTER TABLE "conversations" ADD "direct_person_high_id" uuid`);
        await queryRunner.query(`CREATE UNIQUE INDEX "conversations_direct_pair_key" ON "conversations"  ("direct_person_low_id", "direct_person_high_id") WHERE "kind" = 'direct'`);
        await queryRunner.query(`ALTER TABLE "conversations" ADD CONSTRAINT "conversations_direct_check" CHECK (("kind" = 'direct' AND "name" IS NULL AND "topic" IS NULL AND "direct_person_low_id" IS NOT NULL AND "direct_person_high_id" IS NOT NULL AND "direct_person_low_id" <= "direct_person_high_id") OR ("kind" <> 'direct' AND "direct_person_low_id" IS NULL AND "direct_person_high_id" IS NULL))`);
        await queryRunner.query(`ALTER TABLE "conversations" ADD CONSTRAINT "FK_74224fdcee13c0152dd4bdbf5d3" FOREIGN KEY ("direct_person_low_id") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "conversations" ADD CONSTRAINT "FK_ed18b6247da648e11591945a417" FOREIGN KEY ("direct_person_high_id") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "conversations" DROP CONSTRAINT "FK_ed18b6247da648e11591945a417"`);
        await queryRunner.query(`ALTER TABLE "conversations" DROP CONSTRAINT "FK_74224fdcee13c0152dd4bdbf5d3"`);
        await queryRunner.query(`ALTER TABLE "conversations" DROP CONSTRAINT "conversations_direct_check"`);
        await queryRunner.query(`DROP INDEX "public"."conversations_direct_pair_key"`);
        await queryRunner.query(`ALTER TABLE "conversations" DROP COLUMN "direct_person_high_id"`);
        await queryRunner.query(`ALTER TABLE "conversations" DROP COLUMN "direct_person_low_id"`);
        // Só reverte sem Conversas diretas no banco: o CHECK antigo não as aceita.
        await queryRunner.query(`ALTER TABLE "conversations" DROP CONSTRAINT "conversations_kind_check", ADD CONSTRAINT "conversations_kind_check" CHECK ("kind" IN ('public_channel', 'private_channel'))`);
    }

}
