import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBookingOperationalPhase2178243200000 implements MigrationInterface {
  name = 'AddBookingOperationalPhase2178243200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "booking" ADD COLUMN IF NOT EXISTS "payment_rejection_reason" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking" ADD COLUMN IF NOT EXISTS "payment_verified_by_user_id" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking" ADD COLUMN IF NOT EXISTS "payment_verified_at" timestamp`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking" ADD COLUMN IF NOT EXISTS "payment_rejected_by_user_id" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking" ADD COLUMN IF NOT EXISTS "payment_rejected_at" timestamp`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking" ADD COLUMN IF NOT EXISTS "cancelled_at" timestamp`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking" ADD COLUMN IF NOT EXISTS "cancelled_by_user_id" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking" ADD COLUMN IF NOT EXISTS "cancelled_by_role" varchar`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking" ADD COLUMN IF NOT EXISTS "cancellation_reason" text`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_booking_phase2_payment_status" ON "booking" ("payment_status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_booking_phase2_operational_status" ON "booking" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_booking_phase2_schedule" ON "booking" ("visit_date", "pickup_time")`,
    );
  }

  public async down(): Promise<void> {
    // Forward-only operational migration. Intentionally left empty to avoid destructive rollback.
  }
}
