import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOperationsSettingsAudit1782604800000 implements MigrationInterface {
  name = 'AddOperationsSettingsAudit1782604800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "system_setting" (
        "key" varchar(80) PRIMARY KEY,
        "value" jsonb NOT NULL,
        "updated_by_user_id" integer,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audit_log" (
        "id" SERIAL PRIMARY KEY,
        "actor_user_id" integer,
        "actor_role" varchar,
        "action" varchar NOT NULL,
        "entity_type" varchar NOT NULL,
        "entity_id" varchar,
        "booking_code" varchar,
        "scope" varchar NOT NULL DEFAULT 'operational',
        "metadata" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_audit_log_action" ON "audit_log" ("action")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_audit_log_entity_type" ON "audit_log" ("entity_type")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_audit_log_booking_code" ON "audit_log" ("booking_code")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_audit_log_created_at" ON "audit_log" ("created_at")`,
    );
  }

  public async down(): Promise<void> {
    // Forward-only operations metadata migration. Kept non-destructive intentionally.
  }
}
