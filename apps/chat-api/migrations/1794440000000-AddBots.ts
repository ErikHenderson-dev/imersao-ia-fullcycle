import { MigrationInterface, QueryRunner } from "typeorm";

// Escrita à mão: os bots dos Agentes (ADR 0028; spec da F10, "Bots"), com os CHECK do @usuário e do
// nome das Pessoas.
export class AddBots1794440000000 implements MigrationInterface {
    name = 'AddBots1794440000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "bots" ("id" uuid NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "username" text NOT NULL, "name" text NOT NULL, CONSTRAINT "bots_username_check" CHECK ("username" ~ '^[a-z0-9][a-z0-9._-]{0,28}[a-z0-9]$'), CONSTRAINT "bots_name_check" CHECK (char_length("name") BETWEEN 1 AND 80 AND "name" !~ '[\\r\\n]'), CONSTRAINT "PK_bots_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "bots_username_key" ON "bots" ("username") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."bots_username_key"`);
        await queryRunner.query(`DROP TABLE "bots"`);
    }

}
