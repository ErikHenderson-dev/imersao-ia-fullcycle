import { MigrationInterface, QueryRunner } from "typeorm";

// As Notificações de Tarefa, gravadas (ADR 0029; spec da F12, "Tarefa"). Gerada pelas entidades, com o
// CHECK de `kind` conferido à mão. A marca de Atividade deixa de referenciar `messages`: passa a ser a
// posição da Mensagem ou da Notificação de Tarefa mais nova vista.

export class AddTaskNotifications1794490000000 implements MigrationInterface {
    name = 'AddTaskNotifications1794490000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "people" DROP CONSTRAINT "FK_b3e938383c9643a7942fe737cb7"`);
        await queryRunner.query(`CREATE TABLE "task_notifications" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "task_id" uuid NOT NULL, "recipient_id" uuid NOT NULL, "kind" text NOT NULL, "read_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "task_notifications_kind_check" CHECK ("kind" IN ('received', 'completed', 'reopened')), CONSTRAINT "PK_9aef976a801e244007e922184cf" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "task_notifications_recipient_idx" ON "task_notifications"  ("recipient_id", "id") `);
        await queryRunner.query(`CREATE INDEX "task_notifications_task_idx" ON "task_notifications"  ("task_id") `);
        await queryRunner.query(`ALTER TABLE "task_notifications" ADD CONSTRAINT "FK_dd5108e2de37cb33ea2945bc5c4" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "task_notifications" ADD CONSTRAINT "FK_0391ceb5c7f32bcb67505018327" FOREIGN KEY ("recipient_id") REFERENCES "people"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "task_notifications" DROP CONSTRAINT "FK_0391ceb5c7f32bcb67505018327"`);
        await queryRunner.query(`ALTER TABLE "task_notifications" DROP CONSTRAINT "FK_dd5108e2de37cb33ea2945bc5c4"`);
        await queryRunner.query(`DROP INDEX "public"."task_notifications_task_idx"`);
        await queryRunner.query(`DROP INDEX "public"."task_notifications_recipient_idx"`);
        await queryRunner.query(`DROP TABLE "task_notifications"`);
        // A marca numa Notificação de Tarefa não volta a ser referência a uma Mensagem: fica nula.
        await queryRunner.query(`UPDATE "people" SET "activity_read_message_id" = NULL WHERE "activity_read_message_id" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "messages" WHERE "messages"."id" = "people"."activity_read_message_id")`);
        await queryRunner.query(`ALTER TABLE "people" ADD CONSTRAINT "FK_b3e938383c9643a7942fe737cb7" FOREIGN KEY ("activity_read_message_id") REFERENCES "messages"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
