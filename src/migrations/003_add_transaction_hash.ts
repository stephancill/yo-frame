import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("messages")
    .addColumn("transaction_hash", "varchar")
    .addColumn("is_onchain", "boolean", (col) => col.defaultTo(false))
    .execute();

  await db.schema
    .createIndex("idx_messages_transaction_hash")
    .on("messages")
    .column("transaction_hash")
    .execute();

  await db.schema
    .createIndex("idx_messages_is_onchain")
    .on("messages")
    .column("is_onchain")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex("idx_messages_transaction_hash").execute();

  await db.schema.dropIndex("idx_messages_is_onchain").execute();

  await db.schema
    .alterTable("messages")
    .dropColumn("transaction_hash")
    .dropColumn("is_onchain")
    .execute();
}
