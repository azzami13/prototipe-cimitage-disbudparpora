import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDestinationDistancePathGeometry1782777600000 implements MigrationInterface {
  name = 'AddDestinationDistancePathGeometry1782777600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS postgis`);

    await queryRunner.query(`
      ALTER TABLE "destination_distance"
      ADD COLUMN IF NOT EXISTS "path_geometry" geometry(LineString,4326)
    `);

    await queryRunner.query(`
      UPDATE "destination_distance"
      SET "path_geometry" = ST_SetSRID(
        ST_GeomFromGeoJSON(("path_geojson"->'features'->0->'geometry')::text),
        4326
      )
      WHERE "path_geometry" IS NULL
        AND "path_geojson" IS NOT NULL
        AND jsonb_typeof("path_geojson"->'features') = 'array'
        AND jsonb_array_length("path_geojson"->'features') > 0
        AND "path_geojson"->'features'->0->'geometry'->>'type' = 'LineString'
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_destination_distance_path_geometry"
      ON "destination_distance" USING GIST ("path_geometry")
    `);
  }

  public async down(): Promise<void> {
    // Forward-only spatial cache migration. Existing route cache data is preserved.
  }
}
