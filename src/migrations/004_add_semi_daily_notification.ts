import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await sql`ALTER TYPE notification_type ADD VALUE 'semi_daily'`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  // PostgreSQL doesn't support removing enum values directly
  // We need to create a new type, update the column, and drop the old type
  await sql`
    CREATE TYPE notification_type_new AS ENUM ('all', 'hourly');
    ALTER TABLE users ALTER COLUMN notification_type TYPE notification_type_new 
      USING (CASE WHEN notification_type::text = 'semi_daily' 
                  THEN 'all'::notification_type_new 
                  ELSE notification_type::text::notification_type_new END);
    DROP TYPE notification_type;
    ALTER TYPE notification_type_new RENAME TO notification_type;
  `.execute(db);
}
