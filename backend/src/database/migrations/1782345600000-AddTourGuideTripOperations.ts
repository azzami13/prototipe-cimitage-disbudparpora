import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTourGuideTripOperations1782345600000 implements MigrationInterface {
  name = 'AddTourGuideTripOperations1782345600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
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
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_trip_guide_session_guide_status";
      DROP TABLE IF EXISTS "trip_guide_session";
      ALTER TABLE "trip_incident"
        DROP COLUMN IF EXISTS "reported_by_user_id",
        DROP COLUMN IF EXISTS "reporter_role";
      ALTER TABLE "trip_itinerary_item"
        DROP COLUMN IF EXISTS "guide_content_snapshot";
      ALTER TABLE "driver_trip"
        DROP COLUMN IF EXISTS "tour_guide_id";
    `);
  }
}
