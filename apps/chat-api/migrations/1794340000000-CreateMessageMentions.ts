import { MigrationInterface, QueryRunner } from "typeorm";

// As Pessoas mencionadas em cada Mensagem (spec da F06, "Mensagens").
export class CreateMessageMentions1794340000000 implements MigrationInterface {
    name = 'CreateMessageMentions1794340000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "message_mentions" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "message_id" uuid NOT NULL, "person_id" uuid NOT NULL, CONSTRAINT "message_mentions_message_person_key" UNIQUE ("message_id", "person_id"), CONSTRAINT "PK_message_mentions" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "message_mentions_person_id_idx" ON "message_mentions" ("person_id") `);
        await queryRunner.query(`ALTER TABLE "message_mentions" ADD CONSTRAINT "FK_704c2dc52c37d26393dae070253" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "message_mentions" ADD CONSTRAINT "FK_4891c8cb66c6930cb54be0840ef" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "message_mentions"`);
    }

}
