import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from "typeorm";

export class AddExternalIdToContacts1750299580000 implements MigrationInterface {
    name = "AddExternalIdToContacts1750299580000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        if (!(await queryRunner.hasColumn("contact", "external_id"))) {
            await queryRunner.addColumn(
                "contact",
                new TableColumn({
                    name: "external_id",
                    type: "text",
                    isNullable: true
                })
            );
        }

        // Synchronize can create the same index under a generated name.
        const [existingIndex] = await queryRunner.query(`
            SELECT 1
            FROM pragma_index_list('contact') AS contact_index
            JOIN pragma_index_info(contact_index.name) AS index_column
            WHERE contact_index.partial = 0
            GROUP BY contact_index.name
            HAVING COUNT(*) = 1 AND MIN(index_column.name) = 'external_id'
            LIMIT 1
        `);
        if (existingIndex) return;

        await queryRunner.createIndex(
            "contact",
            new TableIndex({
                name: "IDX_CONTACT_EXTERNAL_ID",
                columnNames: ["external_id"]
            })
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        if (!(await queryRunner.hasColumn("contact", "external_id"))) return;

        const indexes: { name: string }[] = await queryRunner.query(`
            SELECT DISTINCT contact_index.name
            FROM pragma_index_list('contact') AS contact_index
            JOIN pragma_index_info(contact_index.name) AS index_column
            WHERE contact_index.origin = 'c' AND index_column.name = 'external_id'
        `);
        for (const { name } of indexes) {
            await queryRunner.query(`DROP INDEX "${name.replace(/"/g, '""')}";`);
        }

        // Avoid rebuilding the contact table, which can cascade into contact_address.
        await queryRunner.query(`ALTER TABLE "contact" DROP COLUMN "external_id";`);
    }
}
