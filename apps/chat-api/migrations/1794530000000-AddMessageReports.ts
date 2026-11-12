import { MigrationInterface, QueryRunner } from "typeorm";

// A referência ao PDF da entrega do Relatório (spec da F14, "Referência ao PDF e download"). Gerada
// pela entidade, com os CHECK conferidos à mão contra ela.

export class AddMessageReports1794530000000 implements MigrationInterface {
    name = 'AddMessageReports1794530000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "message_reports" ("message_id" uuid NOT NULL, "storage_key" text NOT NULL, "file_name" text NOT NULL, "size_bytes" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "message_reports_size_bytes_check" CHECK ("size_bytes" > 0), CONSTRAINT "message_reports_file_name_check" CHECK (char_length("file_name") BETWEEN 5 AND 200 AND "file_name" LIKE '%.pdf'), CONSTRAINT "message_reports_storage_key_check" CHECK ("storage_key" LIKE 'reports/%'), CONSTRAINT "PK_de2e419f2ab433117356de07a5e" PRIMARY KEY ("message_id"))`);
        await queryRunner.query(`ALTER TABLE "message_reports" ADD CONSTRAINT "FK_de2e419f2ab433117356de07a5e" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "message_reports" DROP CONSTRAINT "FK_de2e419f2ab433117356de07a5e"`);
        await queryRunner.query(`DROP TABLE "message_reports"`);
    }

}
