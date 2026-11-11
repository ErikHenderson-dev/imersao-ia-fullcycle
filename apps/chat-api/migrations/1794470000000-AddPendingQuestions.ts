import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPendingQuestions1794470000000 implements MigrationInterface {
    name = 'AddPendingQuestions1794470000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "pending_questions" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "request_id" uuid NOT NULL, "conversation_id" uuid NOT NULL, "person_id" uuid NOT NULL, "bot_id" uuid NOT NULL, "question_message_id" uuid NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "closed_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_e78247f75701dc0838048af2a4b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "pending_questions_question_message_key" ON "pending_questions"  ("question_message_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "pending_questions_open_key" ON "pending_questions"  ("conversation_id", "person_id") WHERE "closed_at" IS NULL`);
        await queryRunner.query(`ALTER TABLE "messages" ADD "quick_replies" jsonb`);
        await queryRunner.query(`ALTER TABLE "pending_questions" ADD CONSTRAINT "FK_a342279deeffa09be0cfdf341a2" FOREIGN KEY ("request_id") REFERENCES "agent_requests"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "pending_questions" ADD CONSTRAINT "FK_09680d5136a0d817c770420a92e" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "pending_questions" ADD CONSTRAINT "FK_1958381a5d9d4f500cd7f48989d" FOREIGN KEY ("person_id") REFERENCES "people"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "pending_questions" ADD CONSTRAINT "FK_169132e339597ef1712412a7081" FOREIGN KEY ("bot_id") REFERENCES "bots"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "pending_questions" ADD CONSTRAINT "FK_f1d9b5d07b14051e1a1de17e10d" FOREIGN KEY ("question_message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "pending_questions" DROP CONSTRAINT "FK_f1d9b5d07b14051e1a1de17e10d"`);
        await queryRunner.query(`ALTER TABLE "pending_questions" DROP CONSTRAINT "FK_169132e339597ef1712412a7081"`);
        await queryRunner.query(`ALTER TABLE "pending_questions" DROP CONSTRAINT "FK_1958381a5d9d4f500cd7f48989d"`);
        await queryRunner.query(`ALTER TABLE "pending_questions" DROP CONSTRAINT "FK_09680d5136a0d817c770420a92e"`);
        await queryRunner.query(`ALTER TABLE "pending_questions" DROP CONSTRAINT "FK_a342279deeffa09be0cfdf341a2"`);
        await queryRunner.query(`ALTER TABLE "messages" DROP COLUMN "quick_replies"`);
        await queryRunner.query(`DROP INDEX "public"."pending_questions_open_key"`);
        await queryRunner.query(`DROP INDEX "public"."pending_questions_question_message_key"`);
        await queryRunner.query(`DROP TABLE "pending_questions"`);
    }

}
