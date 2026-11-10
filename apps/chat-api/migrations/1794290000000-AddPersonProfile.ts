import { MigrationInterface, QueryRunner } from "typeorm";
import { assignUsernames } from "../src/people/username";

// Escrita à mão: a coluna obrigatória nasce nula, recebe o @usuário de cada Pessoa que já existe e
// só depois vira NOT NULL e única (plano da F05-T01, "Contrato"). O @usuário vem da mesma função da
// conta nova, pela ordem de criação das contas (o id, UUID v7).
export class AddPersonProfile1794290000000 implements MigrationInterface {
    name = 'AddPersonProfile1794290000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "people" ADD "username" text, ADD "title" text, ADD "phone" text, ADD "time_zone" text`);
        const people = await queryRunner.query(`SELECT "id", "email" FROM "people" ORDER BY "id"`) as { id: string; email: string }[];
        if (people.length > 0) {
            const usernames = assignUsernames(people.map(({ email }) => email));
            await queryRunner.query(
                `UPDATE "people" SET "username" = assigned."username" FROM unnest($1::uuid[], $2::text[]) AS assigned("id", "username") WHERE "people"."id" = assigned."id"`,
                [people.map(({ id }) => id), usernames],
            );
        }
        await queryRunner.query(`ALTER TABLE "people" ALTER COLUMN "username" SET NOT NULL, ADD CONSTRAINT "people_username_check" CHECK ("username" ~ '^[a-z0-9][a-z0-9._-]{0,28}[a-z0-9]$'), ADD CONSTRAINT "people_title_check" CHECK (char_length("title") BETWEEN 1 AND 80 AND "title" !~ '[\\r\\n]'), ADD CONSTRAINT "people_phone_check" CHECK ("phone" ~ '^[0-9 +()-]{1,30}$')`);
        await queryRunner.query(`CREATE UNIQUE INDEX "people_username_key" ON "people" ("username") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."people_username_key"`);
        await queryRunner.query(`ALTER TABLE "people" DROP CONSTRAINT "people_phone_check", DROP CONSTRAINT "people_title_check", DROP CONSTRAINT "people_username_check", DROP COLUMN "time_zone", DROP COLUMN "phone", DROP COLUMN "title", DROP COLUMN "username"`);
    }

}
