import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDriverTripOperations1782028800000 implements MigrationInterface {
  name = 'CreateDriverTripOperations1782028800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "driver_trip" (
        "id" SERIAL PRIMARY KEY,
        "booking_id" integer NOT NULL UNIQUE REFERENCES "booking"("id"),
        "driver_id" integer NOT NULL REFERENCES "user"("id"),
        "sakoci_id" integer NOT NULL REFERENCES "sakoci"("id"),
        "assigned_by_admin_id" integer NOT NULL REFERENCES "user"("id"),
        "booking_reference" varchar NOT NULL,
        "scheduled_user_pickup_at" timestamp NOT NULL,
        "driver_ready_at" timestamp NOT NULL,
        "driver_lead_time_minutes" integer NOT NULL DEFAULT 30,
        "estimated_duration_minutes" integer NOT NULL,
        "estimated_end_at" timestamp NOT NULL,
        "trip_status" varchar NOT NULL DEFAULT 'ASSIGNED',
        "current_itinerary_item_id" integer,
        "current_stop_sequence" integer,
        "tracking_active" boolean NOT NULL DEFAULT false,
        "tracking_started_at" timestamp,
        "tracking_ended_at" timestamp,
        "assigned_at" timestamp,
        "accepted_at" timestamp,
        "en_route_pickup_at" timestamp,
        "arrived_pickup_at" timestamp,
        "journey_started_at" timestamp,
        "completed_at" timestamp,
        "cancelled_at" timestamp,
        "cancellation_reason" text,
        "route_snapshot" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS "trip_itinerary_item" (
        "id" SERIAL PRIMARY KEY,
        "trip_id" integer NOT NULL REFERENCES "driver_trip"("id") ON DELETE CASCADE,
        "sequence" integer NOT NULL,
        "stop_type" varchar NOT NULL,
        "heritage_site_id" integer REFERENCES "heritage_site"("id"),
        "name" varchar NOT NULL,
        "address" text,
        "latitude" decimal(10,7),
        "longitude" decimal(10,7),
        "planned_duration_minutes" integer,
        "estimated_arrival_at" timestamp,
        "stop_status" varchar NOT NULL DEFAULT 'PENDING',
        "en_route_at" timestamp,
        "arrived_at" timestamp,
        "completed_at" timestamp,
        "skipped_at" timestamp,
        "skip_reason" text,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      );
      CREATE TABLE IF NOT EXISTS "trip_status_history" (
        "id" SERIAL PRIMARY KEY,
        "trip_id" integer NOT NULL REFERENCES "driver_trip"("id") ON DELETE CASCADE,
        "itinerary_item_id" integer REFERENCES "trip_itinerary_item"("id") ON DELETE SET NULL,
        "previous_status" varchar,
        "new_status" varchar NOT NULL,
        "action" varchar NOT NULL,
        "changed_by_user_id" integer NOT NULL REFERENCES "user"("id"),
        "changed_at" timestamp NOT NULL DEFAULT now(),
        "notes" text,
        "latitude" decimal(10,7),
        "longitude" decimal(10,7)
      );
      CREATE TABLE IF NOT EXISTS "trip_location_log" (
        "id" SERIAL PRIMARY KEY,
        "trip_id" integer NOT NULL REFERENCES "driver_trip"("id") ON DELETE CASCADE,
        "booking_id" integer NOT NULL,
        "sakoci_id" integer NOT NULL,
        "driver_id" integer NOT NULL,
        "latitude" decimal(10,7) NOT NULL,
        "longitude" decimal(10,7) NOT NULL,
        "accuracy" decimal(8,2),
        "speed_kmh" decimal(8,2),
        "heading" decimal(6,2),
        "captured_at" timestamp NOT NULL DEFAULT now(),
        "current_trip_status" varchar NOT NULL,
        "current_itinerary_item_id" integer REFERENCES "trip_itinerary_item"("id") ON DELETE SET NULL
      );
      CREATE INDEX IF NOT EXISTS "IDX_trip_location_trip_captured"
        ON "trip_location_log" ("trip_id", "captured_at");
      CREATE TABLE IF NOT EXISTS "trip_incident" (
        "id" SERIAL PRIMARY KEY,
        "trip_id" integer NOT NULL REFERENCES "driver_trip"("id") ON DELETE CASCADE,
        "driver_id" integer NOT NULL REFERENCES "user"("id"),
        "issue_type" varchar NOT NULL,
        "description" text NOT NULL,
        "status" varchar NOT NULL DEFAULT 'OPEN',
        "reported_at" timestamp NOT NULL DEFAULT now(),
        "resolved_at" timestamp,
        "resolved_by" integer,
        "resolution_note" text,
        "latitude" decimal(10,7),
        "longitude" decimal(10,7)
      );
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS "trip_incident";
      DROP TABLE IF EXISTS "trip_location_log";
      DROP TABLE IF EXISTS "trip_status_history";
      DROP TABLE IF EXISTS "trip_itinerary_item";
      DROP TABLE IF EXISTS "driver_trip";
    `);
  }
}
