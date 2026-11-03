import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRouteSnapshotPlaybackFields1782950400000 implements MigrationInterface {
  name = 'AddRouteSnapshotPlaybackFields1782950400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS postgis`);

    await queryRunner.query(`
      ALTER TABLE "route_optimization_result"
      ADD COLUMN IF NOT EXISTS "route_geometry" geometry(LineString,4326)
    `);
    await queryRunner.query(`
      ALTER TABLE "route_optimization_result"
      ADD COLUMN IF NOT EXISTS "route_node_ids" jsonb NOT NULL DEFAULT '[]'
    `);
    await queryRunner.query(`
      ALTER TABLE "route_optimization_result"
      ADD COLUMN IF NOT EXISTS "route_edge_ids" jsonb NOT NULL DEFAULT '[]'
    `);

    await queryRunner.query(`
      UPDATE "route_optimization_result"
      SET "route_geometry" = ST_SetSRID(
        ST_GeomFromGeoJSON(("route_geojson"->'features'->0->'geometry')::text),
        4326
      )
      WHERE "route_geometry" IS NULL
        AND "route_geojson" IS NOT NULL
        AND jsonb_typeof("route_geojson"->'features') = 'array'
        AND jsonb_array_length("route_geojson"->'features') > 0
        AND "route_geojson"->'features'->0->'geometry'->>'type' = 'LineString'
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_route_optimization_route_geometry"
      ON "route_optimization_result" USING GIST ("route_geometry")
    `);
  }

  public async down(): Promise<void> {
    // Forward-only route snapshot migration. Existing route caches are preserved.
  }
}
