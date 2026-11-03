import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPostgisSpatialColumns1782691200000 implements MigrationInterface {
  name = 'AddPostgisSpatialColumns1782691200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS postgis`);

    await queryRunner.query(`
      ALTER TABLE "heritage_site"
      ADD COLUMN IF NOT EXISTS "point_geom" geometry(Point,4326)
    `);
    await queryRunner.query(`
      ALTER TABLE "road_node"
      ADD COLUMN IF NOT EXISTS "point_geom" geometry(Point,4326)
    `);
    await queryRunner.query(`
      ALTER TABLE "road_edge"
      ADD COLUMN IF NOT EXISTS "line_geom" geometry(LineString,4326)
    `);

    await queryRunner.query(`
      UPDATE "heritage_site"
      SET "point_geom" = ST_SetSRID(ST_MakePoint("longitude"::double precision, "latitude"::double precision), 4326)
      WHERE "point_geom" IS NULL
        AND "longitude" IS NOT NULL
        AND "latitude" IS NOT NULL
    `);
    await queryRunner.query(`
      UPDATE "road_node"
      SET "point_geom" = ST_SetSRID(ST_MakePoint("longitude"::double precision, "latitude"::double precision), 4326)
      WHERE "point_geom" IS NULL
        AND "longitude" IS NOT NULL
        AND "latitude" IS NOT NULL
    `);

    await queryRunner.query(`
      UPDATE "road_edge" edge
      SET "line_geom" = ST_SetSRID(legacy_geometry."geom", 4326)
      FROM (
        SELECT
          road_edge."id",
          ST_MakeLine(
            ST_MakePoint(
              (coordinate."value"->>0)::double precision,
              (coordinate."value"->>1)::double precision
            )
            ORDER BY coordinate."ordinality"
          ) AS "geom"
        FROM "road_edge" road_edge
        CROSS JOIN LATERAL jsonb_array_elements(road_edge."geometry") WITH ORDINALITY AS coordinate("value", "ordinality")
        WHERE jsonb_typeof(road_edge."geometry") = 'array'
          AND jsonb_array_length(road_edge."geometry") >= 2
        GROUP BY road_edge."id"
      ) legacy_geometry
      WHERE edge."id" = legacy_geometry."id"
        AND edge."line_geom" IS NULL
        AND ST_NPoints(legacy_geometry."geom") >= 2
    `);

    await queryRunner.query(`
      UPDATE "road_edge" edge
      SET "line_geom" = ST_SetSRID(ST_MakeLine(from_node."point_geom", to_node."point_geom"), 4326)
      FROM "road_node" from_node, "road_node" to_node
      WHERE edge."line_geom" IS NULL
        AND edge."from_node_id" = from_node."id"
        AND edge."to_node_id" = to_node."id"
        AND from_node."point_geom" IS NOT NULL
        AND to_node."point_geom" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_heritage_site_point_geom"
      ON "heritage_site" USING GIST ("point_geom")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_road_node_point_geom"
      ON "road_node" USING GIST ("point_geom")
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_road_edge_line_geom"
      ON "road_edge" USING GIST ("line_geom")
    `);
  }

  public async down(): Promise<void> {
    // Forward-only spatial migration. Existing routing data and caches are kept intact.
  }
}
