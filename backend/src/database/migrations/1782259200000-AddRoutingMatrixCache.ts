import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRoutingMatrixCache1782259200000 implements MigrationInterface {
  name = 'AddRoutingMatrixCache1782259200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "routing_build" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "status" varchar NOT NULL DEFAULT 'BUILDING',
        "is_active" boolean NOT NULL DEFAULT false,
        "started_at" timestamptz,
        "finished_at" timestamptz,
        "graph_node_count" integer NOT NULL DEFAULT 0,
        "graph_edge_count" integer NOT NULL DEFAULT 0,
        "asset_count" integer NOT NULL DEFAULT 0,
        "routable_asset_count" integer NOT NULL DEFAULT 0,
        "skipped_asset_count" integer NOT NULL DEFAULT 0,
        "unreachable_pair_count" integer NOT NULL DEFAULT 0,
        "source_hash" varchar,
        "error_message" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_routing_build" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `ALTER TABLE "road_edge" ADD COLUMN IF NOT EXISTS "geometry" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "road_edge" ADD COLUMN IF NOT EXISTS "forward_cost_m" decimal(14,3)`,
    );
    await queryRunner.query(
      `ALTER TABLE "road_edge" ADD COLUMN IF NOT EXISTS "reverse_cost_m" decimal(14,3)`,
    );
    await queryRunner.query(
      `ALTER TABLE "road_edge" ADD COLUMN IF NOT EXISTS "sakoci_allowed" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "destination_node" ADD COLUMN IF NOT EXISTS "snap_distance_m" decimal(14,3)`,
    );
    await queryRunner.query(
      `ALTER TABLE "destination_node" ADD COLUMN IF NOT EXISTS "routing_status" varchar NOT NULL DEFAULT 'READY'`,
    );
    await queryRunner.query(
      `ALTER TABLE "destination_node" ADD COLUMN IF NOT EXISTS "routing_error" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "destination_node" ADD COLUMN IF NOT EXISTS "routing_build_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "destination_node" ALTER COLUMN "road_node_id" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "destination_distance" ADD COLUMN IF NOT EXISTS "routing_build_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "destination_distance" ADD COLUMN IF NOT EXISTS "haversine_distance_m" decimal(14,3)`,
    );
    await queryRunner.query(
      `ALTER TABLE "destination_distance" ADD COLUMN IF NOT EXISTS "path_edge_steps" jsonb NOT NULL DEFAULT '[]'::jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "route_optimization_result" ADD COLUMN IF NOT EXISTS "route_geojson" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "route_optimization_result" ADD COLUMN IF NOT EXISTS "route_source" varchar`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_destination_distance_build_pair" ON "destination_distance" ("routing_build_id", "from_heritage_site_id", "to_heritage_site_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_destination_node_build_site" ON "destination_node" ("routing_build_id", "heritage_site_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_routing_build_status_active" ON "routing_build" ("status", "is_active")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_road_edge_from" ON "road_edge" ("from_node_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_road_edge_to" ON "road_edge" ("to_node_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_road_edge_to"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_road_edge_from"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_routing_build_status_active"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_destination_node_build_site"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_destination_distance_build_pair"`,
    );
  }
}
