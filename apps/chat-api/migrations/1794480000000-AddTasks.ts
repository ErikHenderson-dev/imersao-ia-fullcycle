import { MigrationInterface, QueryRunner } from "typeorm";

// As Tarefas e a ação de bot `task` (spec da F12, "Tarefa" e "Ação `task`"). Gerada pelas entidades,
// com os CHECK de `tasks` conferidos à mão contra elas; a troca do CHECK de `bot_actions` é escrita à
// mão, porque o gerador não compara CHECK.

export class AddTasks1794480000000 implements MigrationInterface {
    name = 'AddTasks1794480000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "tasks" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "request_id" uuid NOT NULL, "conversation_id" uuid NOT NULL, "trigger_message_id" uuid NOT NULL, "assignee_id" uuid NOT NULL, "delegator_id" uuid NOT NULL, "title" text NOT NULL, "status" text NOT NULL DEFAULT 'open', "completed_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "tasks_title_check" CHECK (char_length("title") BETWEEN 1 AND 120), CONSTRAINT "tasks_status_check" CHECK ("status" IN ('open', 'done')), CONSTRAINT "PK_8d12ff38fcc62aaba2cab748772" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "tasks_delegator_idx" ON "tasks"  ("delegator_id", "status", "id") `);
        await queryRunner.query(`CREATE INDEX "tasks_assignee_idx" ON "tasks"  ("assignee_id", "status", "id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "tasks_request_key" ON "tasks"  ("request_id") `);
        await queryRunner.query(`ALTER TABLE "tasks" ADD CONSTRAINT "FK_c6fc57c79c9115cb1c3fb231b30" FOREIGN KEY ("request_id") REFERENCES "agent_requests"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tasks" ADD CONSTRAINT "FK_7b34d4f3682f36386e9ba06edbd" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tasks" ADD CONSTRAINT "FK_88c4000de5aa31cb6a109c3075b" FOREIGN KEY ("trigger_message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tasks" ADD CONSTRAINT "FK_855d484825b715c545349212c7f" FOREIGN KEY ("assignee_id") REFERENCES "people"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "tasks" ADD CONSTRAINT "FK_8eae7c3a54a036d12333706841a" FOREIGN KEY ("delegator_id") REFERENCES "people"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "bot_actions" DROP CONSTRAINT "bot_actions_action_type_check"`);
        await queryRunner.query(`ALTER TABLE "bot_actions" ADD CONSTRAINT "bot_actions_action_type_check" CHECK ("action_type" IN ('reply', 'question', 'task'))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM "bot_actions" WHERE "action_type" = 'task'`);
        await queryRunner.query(`ALTER TABLE "bot_actions" DROP CONSTRAINT "bot_actions_action_type_check"`);
        await queryRunner.query(`ALTER TABLE "bot_actions" ADD CONSTRAINT "bot_actions_action_type_check" CHECK ("action_type" IN ('reply', 'question'))`);
        await queryRunner.query(`ALTER TABLE "tasks" DROP CONSTRAINT "FK_8eae7c3a54a036d12333706841a"`);
        await queryRunner.query(`ALTER TABLE "tasks" DROP CONSTRAINT "FK_855d484825b715c545349212c7f"`);
        await queryRunner.query(`ALTER TABLE "tasks" DROP CONSTRAINT "FK_88c4000de5aa31cb6a109c3075b"`);
        await queryRunner.query(`ALTER TABLE "tasks" DROP CONSTRAINT "FK_7b34d4f3682f36386e9ba06edbd"`);
        await queryRunner.query(`ALTER TABLE "tasks" DROP CONSTRAINT "FK_c6fc57c79c9115cb1c3fb231b30"`);
        await queryRunner.query(`DROP INDEX "public"."tasks_request_key"`);
        await queryRunner.query(`DROP INDEX "public"."tasks_assignee_idx"`);
        await queryRunner.query(`DROP INDEX "public"."tasks_delegator_idx"`);
        await queryRunner.query(`DROP TABLE "tasks"`);
    }

}
