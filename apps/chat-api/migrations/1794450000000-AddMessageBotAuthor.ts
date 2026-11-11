import { MigrationInterface, QueryRunner } from "typeorm";

// Escrita à mão: a Mensagem passa a ter autor Pessoa ou bot (ADR 0028; spec da F11, "Autor da
// Mensagem"). `author_id` é renomeada para `author_person_id`, o que preserva o autor das Mensagens
// existentes e a unicidade com o `client_id`; o CHECK exige exatamente um dos dois autores.
export class AddMessageBotAuthor1794450000000 implements MigrationInterface {
    name = 'AddMessageBotAuthor1794450000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "messages" DROP CONSTRAINT "FK_05535bc695e9f7ee104616459d3"`);
        await queryRunner.query(`ALTER TABLE "messages" RENAME COLUMN "author_id" TO "author_person_id"`);
        await queryRunner.query(`ALTER TABLE "messages" ALTER COLUMN "author_person_id" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "messages" ADD "author_bot_id" uuid`);
        await queryRunner.query(`ALTER TABLE "messages" ADD CONSTRAINT "messages_author_check" CHECK (num_nonnulls("author_person_id", "author_bot_id") = 1)`);
        await queryRunner.query(`ALTER TABLE "messages" ADD CONSTRAINT "FK_52054398c3c386fff9273ae2004" FOREIGN KEY ("author_person_id") REFERENCES "people"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "messages" ADD CONSTRAINT "FK_17534effbedd46ffdcd7a17c468" FOREIGN KEY ("author_bot_id") REFERENCES "bots"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // A volta perderia o autor das Mensagens de bot, porque `author_id` não aceita nulo: ela é
        // recusada enquanto houver alguma, e a limpeza é um passo à parte.
        const [{ count }] = await queryRunner.query(`SELECT count(*)::int AS count FROM "messages" WHERE "author_bot_id" IS NOT NULL`);
        if (count > 0) {
            throw new Error(`Há ${count} Mensagens de bot: a volta desta migração as perderia.`);
        }
        await queryRunner.query(`ALTER TABLE "messages" DROP CONSTRAINT "FK_17534effbedd46ffdcd7a17c468"`);
        await queryRunner.query(`ALTER TABLE "messages" DROP CONSTRAINT "FK_52054398c3c386fff9273ae2004"`);
        await queryRunner.query(`ALTER TABLE "messages" DROP CONSTRAINT "messages_author_check"`);
        await queryRunner.query(`ALTER TABLE "messages" DROP COLUMN "author_bot_id"`);
        await queryRunner.query(`ALTER TABLE "messages" ALTER COLUMN "author_person_id" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "messages" RENAME COLUMN "author_person_id" TO "author_id"`);
        await queryRunner.query(`ALTER TABLE "messages" ADD CONSTRAINT "FK_05535bc695e9f7ee104616459d3" FOREIGN KEY ("author_id") REFERENCES "people"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
