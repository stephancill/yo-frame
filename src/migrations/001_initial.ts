import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("users")
    .addColumn("id", "varchar", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn("fid", "integer", (col) => col.notNull().unique())
    .addColumn("created_at", "timestamp", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .addColumn("updated_at", "timestamp", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .addColumn("notification_url", "varchar")
    .addColumn("notification_token", "varchar")
    .execute();

  await db.schema
    .createTable("messages")
    .addColumn("id", "varchar", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn("from_user_id", "varchar", (col) =>
      col.notNull().references("users.id").onDelete("cascade")
    )
    .addColumn("to_user_id", "varchar", (col) =>
      col.notNull().references("users.id").onDelete("cascade")
    )
    .addColumn("message", "text", (col) => col.notNull())
    .addColumn("created_at", "timestamp", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .execute();

  await db.schema
    .createTable("unassigned_messages")
    .addColumn("id", "varchar", (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`)
    )
    .addColumn("from_user_id", "varchar", (col) =>
      col.notNull().references("users.id").onDelete("cascade")
    )
    .addColumn("to_fid", "integer", (col) => col.notNull())
    .addColumn("message", "text", (col) => col.notNull())
    .addColumn("created_at", "timestamp", (col) =>
      col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`)
    )
    .execute();

  await db.schema
    .createIndex("idx_unassigned_messages_to_fid")
    .on("unassigned_messages")
    .column("to_fid")
    .execute();

  await db.schema
    .createTable("user_session")
    .addColumn("id", "varchar", (col) => col.primaryKey())
    .addColumn("user_id", "text", (col) =>
      col.notNull().references("users.id").onDelete("cascade")
    )
    .addColumn("expires_at", "timestamptz", (col) => col.notNull())
    .execute();

  await db.schema
    .createIndex("idx_users_fid")
    .on("users")
    .column("fid")
    .execute();

  await db.schema
    .createIndex("idx_users_notification")
    .on("users")
    .columns(["notification_url", "notification_token"])
    .where("notification_url", "is not", null)
    .where("notification_token", "is not", null)
    .execute();

  await db.schema
    .createIndex("idx_user_session_user")
    .on("user_session")
    .column("user_id")
    .execute();

  await db.schema
    .createIndex("idx_messages_from_user")
    .on("messages")
    .column("from_user_id")
    .execute();

  await db.schema
    .createIndex("idx_messages_from_user_to_user")
    .on("messages")
    .columns(["from_user_id", "to_user_id"])
    .execute();

  await db.schema
    .createIndex("idx_messages_to_user")
    .on("messages")
    .column("to_user_id")
    .execute();

  await db.schema
    .createIndex("idx_messages_created_at")
    .on("messages")
    .column("created_at")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex("idx_users_fid").execute();
  await db.schema.dropIndex("idx_users_notification").execute();
  await db.schema.dropIndex("idx_user_session_user").execute();
  await db.schema.dropIndex("idx_messages_from_user").execute();
  await db.schema.dropIndex("idx_messages_from_user_to_user").execute();
  await db.schema.dropIndex("idx_unassigned_messages_to_fid").execute();

  await db.schema.dropTable("user_session").execute();
  await db.schema.dropTable("unassigned_messages").execute();
  await db.schema.dropTable("messages").execute();
  await db.schema.dropTable("users").execute();

  await db.schema.dropIndex("idx_messages_to_user").execute();
  await db.schema.dropIndex("idx_messages_created_at").execute();
}
