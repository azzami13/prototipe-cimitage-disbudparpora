import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnsureCustomerRole1783123200000 implements MigrationInterface {
  name = 'EnsureCustomerRole1783123200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "role" ("name") VALUES ('customer') ON CONFLICT ("name") DO NOTHING`,
    );
  }

  public async down(): Promise<void> {
    // Keep role rows stable; deleting customer could orphan existing users.
  }
}
