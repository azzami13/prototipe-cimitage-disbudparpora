import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRouteFinalizationMetadata1782518400000 implements MigrationInterface {
  name = 'AddRouteFinalizationMetadata1782518400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "route_optimization_result" ADD COLUMN IF NOT EXISTS "route_status" varchar NOT NULL DEFAULT 'pending'`,
    );
    await queryRunner.query(
      `ALTER TABLE "route_optimization_result" ADD COLUMN IF NOT EXISTS "route_fingerprint" varchar`,
    );
    await queryRunner.query(
      `ALTER TABLE "route_optimization_result" ADD COLUMN IF NOT EXISTS "routing_build_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "route_optimization_result" ADD COLUMN IF NOT EXISTS "finalized_at" timestamp`,
    );
    await queryRunner.query(
      `ALTER TABLE "route_optimization_result" ADD COLUMN IF NOT EXISTS "finalized_by_user_id" integer`,
    );
    await queryRunner.query(
      `ALTER TABLE "route_optimization_result" ADD COLUMN IF NOT EXISTS "stale_reason" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "route_optimization_result" ADD COLUMN IF NOT EXISTS "route_summary" jsonb`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_route_optimization_booking_status" ON "route_optimization_result" ("booking_id", "route_status")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_route_optimization_fingerprint" ON "route_optimization_result" ("booking_id", "route_fingerprint")`,
    );
  }

  public async down(): Promise<void> {
    // Forward-only metadata migration. Kept non-destructive intentionally.
  }
}
