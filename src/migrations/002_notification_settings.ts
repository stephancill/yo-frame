import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await sql`CREATE TYPE notification_type AS ENUM ('all', 'hourly')`.execute(
    db
  );

  await db.schema
    .alterTable("users")
    .addColumn("notification_type", sql`notification_type`, (col) =>
      col.notNull().defaultTo("all")
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable("users").dropColumn("notification_type").execute();

  await sql`DROP TYPE notification_type`.execute(db);
}
