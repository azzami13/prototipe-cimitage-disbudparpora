import { readFileSync } from 'fs';
import { join } from 'path';
import { Client } from 'pg';

function readEnvValue(key: string) {
  if (process.env[key]) return process.env[key];
  const envPath = join(process.cwd(), '.env');
  try {
    const env = readFileSync(envPath, 'utf8');
    const line = env
      .split(/\r?\n/)
      .find((item) => item.trim().startsWith(`${key}=`));
    return line?.slice(key.length + 1).trim();
  } catch {
    return undefined;
  }
}

async function main() {
  const connectionString = readEnvValue('DATABASE_URL');
  if (!connectionString) {
    throw new Error('DATABASE_URL tidak ditemukan');
  }

  const client = new Client({
    connectionString,
    ssl: connectionString.includes('sslmode=require')
      ? { rejectUnauthorized: false }
      : undefined,
  });

  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      ALTER TABLE "driver_trip"
        ADD COLUMN IF NOT EXISTS "tour_guide_id" integer REFERENCES "user"("id");

      ALTER TABLE "trip_itinerary_item"
        ADD COLUMN IF NOT EXISTS "guide_content_snapshot" jsonb;

      ALTER TABLE "trip_incident"
        ALTER COLUMN "driver_id" DROP NOT NULL,
        ADD COLUMN IF NOT EXISTS "reported_by_user_id" integer REFERENCES "user"("id"),
        ADD COLUMN IF NOT EXISTS "reporter_role" varchar;

      UPDATE "trip_incident"
        SET "reported_by_user_id" = COALESCE("reported_by_user_id", "driver_id"),
            "reporter_role" = COALESCE("reporter_role", 'driver')
        WHERE "driver_id" IS NOT NULL;

      CREATE TABLE IF NOT EXISTS "trip_guide_session" (
        "id" SERIAL PRIMARY KEY,
        "trip_id" integer NOT NULL REFERENCES "driver_trip"("id") ON DELETE CASCADE,
        "itinerary_item_id" integer NOT NULL REFERENCES "trip_itinerary_item"("id") ON DELETE CASCADE,
        "tour_guide_id" integer NOT NULL REFERENCES "user"("id"),
        "session_status" varchar NOT NULL DEFAULT 'PENDING',
        "started_at" timestamp,
        "completed_at" timestamp,
        "notes" text,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_trip_guide_session_item" UNIQUE ("trip_id", "itinerary_item_id")
      );

      CREATE INDEX IF NOT EXISTS "IDX_trip_guide_session_guide_status"
        ON "trip_guide_session" ("tour_guide_id", "session_status");
    `);
    await client.query('COMMIT');
    console.log('Tour Guide schema berhasil diterapkan.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
