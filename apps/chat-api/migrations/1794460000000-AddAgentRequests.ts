import { MigrationInterface, QueryRunner } from "typeorm";

// Os Pedidos aos Agentes e as ações de bot (spec da F11, "Pedido e ações de bot"). Gerada pelas
// entidades, com os CHECK de `kind`, `status` e `action_type` conferidos à mão contra elas.

export class AddAgentRequests1794460000000 implements MigrationInterface {
    name = 'AddAgentRequests1794460000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "agent_requests" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "conversation_id" uuid NOT NULL, "requester_id" uuid NOT NULL, "bot_id" uuid NOT NULL, "trigger_message_id" uuid NOT NULL, "kind" text NOT NULL, "parent_request_id" uuid, "status" text NOT NULL DEFAULT 'open', "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, CONSTRAINT "agent_requests_status_check" CHECK ("status" IN ('open', 'failed', 'cancelled')), CONSTRAINT "agent_requests_kind_check" CHECK ("kind" IN ('new', 'continuation')), CONSTRAINT "PK_b70a60b6f8026ad83f18aadc7cd" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "agent_requests_trigger_message_key" ON "agent_requests"  ("trigger_message_id") `);
        await queryRunner.query(`CREATE TABLE "bot_actions" ("request_id" uuid NOT NULL, "action_type" text NOT NULL, "message_id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "bot_actions_action_type_check" CHECK ("action_type" IN ('reply', 'question')), CONSTRAINT "PK_2c0209e75bf0492efc0b9cb3dc0" PRIMARY KEY ("request_id", "action_type"))`);
        await queryRunner.query(`ALTER TABLE "agent_requests" ADD CONSTRAINT "FK_908f1b063484ce31b1b59dc9e49" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "agent_requests" ADD CONSTRAINT "FK_2bb5ebc9588215fd99e3f91c78c" FOREIGN KEY ("requester_id") REFERENCES "people"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "agent_requests" ADD CONSTRAINT "FK_66fd02cddd924b3ebefa4ebc4ee" FOREIGN KEY ("bot_id") REFERENCES "bots"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "agent_requests" ADD CONSTRAINT "FK_8d5d40cf21f1c238d809bfad109" FOREIGN KEY ("trigger_message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "agent_requests" ADD CONSTRAINT "FK_da8c5f0e51d89951f889d45e647" FOREIGN KEY ("parent_request_id") REFERENCES "agent_requests"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "bot_actions" ADD CONSTRAINT "FK_d9cce74f2e554ca021310f620d9" FOREIGN KEY ("request_id") REFERENCES "agent_requests"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "bot_actions" ADD CONSTRAINT "FK_d791c8cc28ae1706b897713ad69" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "bot_actions" DROP CONSTRAINT "FK_d791c8cc28ae1706b897713ad69"`);
        await queryRunner.query(`ALTER TABLE "bot_actions" DROP CONSTRAINT "FK_d9cce74f2e554ca021310f620d9"`);
        await queryRunner.query(`ALTER TABLE "agent_requests" DROP CONSTRAINT "FK_da8c5f0e51d89951f889d45e647"`);
        await queryRunner.query(`ALTER TABLE "agent_requests" DROP CONSTRAINT "FK_8d5d40cf21f1c238d809bfad109"`);
        await queryRunner.query(`ALTER TABLE "agent_requests" DROP CONSTRAINT "FK_66fd02cddd924b3ebefa4ebc4ee"`);
        await queryRunner.query(`ALTER TABLE "agent_requests" DROP CONSTRAINT "FK_2bb5ebc9588215fd99e3f91c78c"`);
        await queryRunner.query(`ALTER TABLE "agent_requests" DROP CONSTRAINT "FK_908f1b063484ce31b1b59dc9e49"`);
        await queryRunner.query(`DROP TABLE "bot_actions"`);
        await queryRunner.query(`DROP INDEX "public"."agent_requests_trigger_message_key"`);
        await queryRunner.query(`DROP TABLE "agent_requests"`);
    }

}
