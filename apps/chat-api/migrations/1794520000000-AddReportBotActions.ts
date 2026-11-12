import { MigrationInterface, QueryRunner } from "typeorm";

// As ações de bot do Relatório (spec da F14, "Ações de bot do Relatório"). Escrita à mão, porque o
// gerador não compara CHECK.

export class AddReportBotActions1794520000000 implements MigrationInterface {
    name = 'AddReportBotActions1794520000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "bot_actions" DROP CONSTRAINT "bot_actions_action_type_check"`);
        await queryRunner.query(`ALTER TABLE "bot_actions" ADD CONSTRAINT "bot_actions_action_type_check" CHECK ("action_type" IN ('reply', 'question', 'task', 'report_started', 'report_delivered', 'report_failed'))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DELETE FROM "bot_actions" WHERE "action_type" IN ('report_started', 'report_delivered', 'report_failed')`);
        await queryRunner.query(`ALTER TABLE "bot_actions" DROP CONSTRAINT "bot_actions_action_type_check"`);
        await queryRunner.query(`ALTER TABLE "bot_actions" ADD CONSTRAINT "bot_actions_action_type_check" CHECK ("action_type" IN ('reply', 'question', 'task'))`);
    }

}
