import { MigrationInterface, QueryRunner } from "typeorm";
import { namesOutsideRule } from "../src/people/profile-values";

// Escrita à mão: o nome ganha a regra do cargo (spec da F09, "Pessoas"). Um nome que já passe dela
// faz a migração falhar com a Pessoa no erro, em vez de cortar o nome em silêncio.
export class AddPersonNameCheck1794390000000 implements MigrationInterface {
    name = 'AddPersonNameCheck1794390000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        const people = await queryRunner.query(`SELECT "id", "email", "name" FROM "people" ORDER BY "id"`) as { id: string; email: string; name: string }[];
        const outside = namesOutsideRule(people);
        if (outside) throw new Error(outside);
        await queryRunner.query(`ALTER TABLE "people" ADD CONSTRAINT "people_name_check" CHECK (char_length("name") BETWEEN 1 AND 80 AND "name" !~ '[\\r\\n]')`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "people" DROP CONSTRAINT "people_name_check"`);
    }

}
