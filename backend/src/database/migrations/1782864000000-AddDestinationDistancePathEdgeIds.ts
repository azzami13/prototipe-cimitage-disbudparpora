import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDestinationDistancePathEdgeIds1782864000000 implements MigrationInterface {
  name = 'AddDestinationDistancePathEdgeIds1782864000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "destination_distance"
      ADD COLUMN IF NOT EXISTS "path_edge_ids" jsonb NOT NULL DEFAULT '[]'
    `);
  }

  public async down(): Promise<void> {
    // Forward-only cache metadata migration. Existing route data is preserved.
  }
}
