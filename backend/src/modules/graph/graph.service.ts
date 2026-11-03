import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { DestinationDistance } from '../../common/entities/destination-distance.entity';
import { DestinationNode } from '../../common/entities/destination-node.entity';
import { HeritageSite } from '../../common/entities/heritage-site.entity';
import { RoadEdge } from '../../common/entities/road-edge.entity';
import { RoadNode } from '../../common/entities/road-node.entity';
import { RoutingBuild } from '../../common/entities/routing-build.entity';
import { RoutingGraphCacheService } from '../routing-engine/routing-graph-cache.service';
import { RoutingMatrixBuilderService } from '../routing-engine/routing-matrix-builder.service';
import { SettingsService } from '../operations/services/settings.service';

@Injectable()
export class GraphService {
  constructor(
    @InjectRepository(HeritageSite)
    private readonly heritageRepo: Repository<HeritageSite>,
    @InjectRepository(RoadNode)
    private readonly roadNodeRepo: Repository<RoadNode>,
    @InjectRepository(RoadEdge)
    private readonly roadEdgeRepo: Repository<RoadEdge>,
    @InjectRepository(DestinationNode)
    private readonly destinationNodeRepo: Repository<DestinationNode>,
    @InjectRepository(DestinationDistance)
    private readonly distanceRepo: Repository<DestinationDistance>,
    @InjectRepository(RoutingBuild)
    private readonly buildRepo: Repository<RoutingBuild>,
    private readonly dataSource: DataSource,
    private readonly matrixBuilder: RoutingMatrixBuilderService,
    private readonly graphCache: RoutingGraphCacheService,
    private readonly settings: SettingsService,
  ) {}

  rebuild() {
    return this.matrixBuilder.rebuildActiveMatrix();
  }

  async getDestinationMatrix() {
    const build = await this.matrixBuilder.getActiveBuild();
    if (!build) {
      return { activeBuildId: null, destinations: [], matrix: [] };
    }
    const [nodes, distances] = await Promise.all([
      this.destinationNodeRepo.find({
        where: { routing_build_id: build.id, routing_status: 'READY' },
        relations: ['heritage_site'],
        order: { heritage_site_id: 'ASC' },
      }),
      this.distanceRepo
        .createQueryBuilder('distance')
        .select([
          'distance.from_heritage_site_id',
          'distance.to_heritage_site_id',
          'distance.distance_km',
        ])
        .where('distance.routing_build_id = :buildId', { buildId: build.id })
        .getMany(),
    ]);
    const siteIds = nodes.map((item) => item.heritage_site_id);
    const indexes = new Map(siteIds.map((id, index) => [id, index]));
    const matrix = Array.from({ length: siteIds.length }, (_, row) =>
      Array.from({ length: siteIds.length }, (_, col) =>
        row === col ? 0 : (null as number | null),
      ),
    );
    for (const row of distances) {
      const from = indexes.get(row.from_heritage_site_id);
      const to = indexes.get(row.to_heritage_site_id);
      if (from !== undefined && to !== undefined)
        matrix[from][to] = Number(row.distance_km);
    }
    return {
      activeBuildId: build.id,
      generatedAt: build.finished_at,
      destinations: nodes.map((item) => ({
        id: item.heritage_site.id,
        name: item.heritage_site.name,
        latitude: Number(item.heritage_site.latitude),
        longitude: Number(item.heritage_site.longitude),
      })),
      matrix,
    };
  }

  async getDestinationDistances() {
    const build = await this.requireActiveBuild();
    return this.distanceRepo
      .createQueryBuilder('distance')
      .leftJoinAndSelect('distance.from_heritage_site', 'fromSite')
      .leftJoinAndSelect('distance.to_heritage_site', 'toSite')
      .select([
        'distance.id',
        'distance.from_heritage_site_id',
        'distance.to_heritage_site_id',
        'distance.distance_km',
        'distance.path_node_ids',
        'distance.path_edge_steps',
        'distance.path_geojson',
        'distance.calculation_method',
        'fromSite.id',
        'fromSite.name',
        'toSite.id',
        'toSite.name',
      ])
      .where('distance.routing_build_id = :buildId', { buildId: build.id })
      .orderBy('distance.from_heritage_site_id', 'ASC')
      .addOrderBy('distance.to_heritage_site_id', 'ASC')
      .getMany();
  }

  getRoadNodes(page = 1, limit = 250) {
    const safeLimit = Math.min(Math.max(limit, 1), 1000);
    return this.roadNodeRepo
      .findAndCount({
        order: { id: 'ASC' },
        skip: (Math.max(page, 1) - 1) * safeLimit,
        take: safeLimit,
      })
      .then(([data, total]) => ({
        data,
        total,
        page: Math.max(page, 1),
        limit: safeLimit,
      }));
  }

  getRoadEdges(page = 1, limit = 250) {
    const safeLimit = Math.min(Math.max(limit, 1), 1000);
    return this.roadEdgeRepo
      .findAndCount({
        order: { id: 'ASC' },
        skip: (Math.max(page, 1) - 1) * safeLimit,
        take: safeLimit,
      })
      .then(([data, total]) => ({
        data,
        total,
        page: Math.max(page, 1),
        limit: safeLimit,
      }));
  }

  async getPlaybackGraph(nodeIdsQuery?: string, edgeIdsQuery?: string) {
    const nodeIds = this.parseIdList(nodeIdsQuery);
    const edgeIds = this.parseIdList(edgeIdsQuery);
    const [nodes, edges] = await Promise.all([
      this.getPlaybackNodes(nodeIds),
      this.getPlaybackEdges(edgeIds),
    ]);

    return { nodes, edges };
  }

  async getGraphRadius(
    latitudeQuery?: string,
    longitudeQuery?: string,
    radiusMetersQuery?: string,
  ) {
    const settings = await this.settings.getSettings();
    const enabled = settings.showSakociGraphRadius;
    const latitude = Number(latitudeQuery);
    const longitude = Number(longitudeQuery);
    const radiusMeters = Math.min(
      Math.max(Number(radiusMetersQuery ?? 2000) || 2000, 100),
      5000,
    );

    if (!enabled) return { enabled, radiusMeters, nodes: [], edges: [] };
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new BadRequestException('latitude dan longitude wajib valid');
    }

    const pointSql = `ST_SetSRID(ST_MakePoint($1, $2), 4326)`;
    const [nodes, edges] = await Promise.all([
      this.dataSource.query(
        `
          SELECT "id", "latitude", "longitude", "type", "name"
          FROM "road_node"
          WHERE ST_DWithin(
            COALESCE(
              "point_geom",
              ST_SetSRID(ST_MakePoint("longitude"::double precision, "latitude"::double precision), 4326)
            )::geography,
            ${pointSql}::geography,
            $3
          )
          ORDER BY ST_Distance(
            COALESCE(
              "point_geom",
              ST_SetSRID(ST_MakePoint("longitude"::double precision, "latitude"::double precision), 4326)
            )::geography,
            ${pointSql}::geography
          ) ASC
          LIMIT 1200
        `,
        [longitude, latitude, radiusMeters],
      ),
      this.dataSource.query(
        `
          SELECT
            "id",
            "from_node_id",
            "to_node_id",
            "distance_km",
            "road_name",
            "oneway",
            "geometry" AS "legacy_geometry",
            ST_AsGeoJSON("line_geom") AS "line_geometry"
          FROM "road_edge"
          LEFT JOIN "road_node" AS "from_node" ON "from_node"."id" = "road_edge"."from_node_id"
          LEFT JOIN "road_node" AS "to_node" ON "to_node"."id" = "road_edge"."to_node_id"
          WHERE "vehicle_accessible" = true
            AND "sakoci_allowed" = true
            AND (
              ("line_geom" IS NOT NULL AND ST_DWithin("line_geom"::geography, ${pointSql}::geography, $3))
              OR ST_DWithin(
                COALESCE(
                  "from_node"."point_geom",
                  ST_SetSRID(ST_MakePoint("from_node"."longitude"::double precision, "from_node"."latitude"::double precision), 4326)
                )::geography,
                ${pointSql}::geography,
                $3
              )
              OR ST_DWithin(
                COALESCE(
                  "to_node"."point_geom",
                  ST_SetSRID(ST_MakePoint("to_node"."longitude"::double precision, "to_node"."latitude"::double precision), 4326)
                )::geography,
                ${pointSql}::geography,
                $3
              )
            )
          ORDER BY COALESCE(
            ST_Distance("line_geom"::geography, ${pointSql}::geography),
            LEAST(
              ST_Distance("from_node"."point_geom"::geography, ${pointSql}::geography),
              ST_Distance("to_node"."point_geom"::geography, ${pointSql}::geography)
            )
          ) ASC
          LIMIT 1600
        `,
        [longitude, latitude, radiusMeters],
      ),
    ]);

    return {
      enabled,
      radiusMeters,
      nodes: nodes.map((row: any) => ({
        id: Number(row.id),
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        type: row.type,
        name: row.name,
      })),
      edges: edges.map((row: any) => ({
        id: Number(row.id),
        fromNodeId: Number(row.from_node_id),
        toNodeId: Number(row.to_node_id),
        distanceKm: Number(row.distance_km),
        roadName: row.road_name,
        oneway: row.oneway,
        geometry: this.parseEdgeGeometry(
          row.line_geometry,
          row.legacy_geometry,
        ),
      })),
    };
  }

  async getNearestNode(heritageId: number) {
    const site = await this.heritageRepo.findOneBy({ id: heritageId });
    if (!site)
      throw new NotFoundException(
        `Heritage site #${heritageId} tidak ditemukan`,
      );
    if (site.latitude === null || site.longitude === null) {
      throw new BadRequestException('Heritage site belum memiliki koordinat');
    }
    const nearest = await this.graphCache.getNearestNode(
      Number(site.latitude),
      Number(site.longitude),
    );
    if (!nearest)
      throw new BadRequestException('Tidak ada node jalan dalam radius snap');
    return {
      heritageSiteId: site.id,
      heritageSiteName: site.name,
      roadNode: nearest.node,
      distanceToNodeKm: nearest.distanceM / 1000,
      source: 'ROUTING_GRAPH_CACHE',
    };
  }

  async getRoutingStatus() {
    const build = await this.buildRepo.findOne({
      where: { is_active: true },
      order: { created_at: 'DESC' },
    });
    const graph = this.graphCache.getGraphSummary();
    return {
      status: build?.status ?? 'UNAVAILABLE',
      isActive: build?.is_active ?? false,
      generatedAt: build?.finished_at ?? null,
      graphNodeCount: build?.graph_node_count ?? graph.nodeCount,
      graphEdgeCount: build?.graph_edge_count ?? graph.edgeCount,
      assetCount: build?.asset_count ?? 0,
      routableAssetCount: build?.routable_asset_count ?? 0,
      skippedAssetCount: build?.skipped_asset_count ?? 0,
      unreachablePairCount: build?.unreachable_pair_count ?? 0,
      activeBuildId: build?.id ?? null,
    };
  }

  private async requireActiveBuild() {
    const build = await this.matrixBuilder.getActiveBuild();
    if (!build)
      throw new BadRequestException('Matrix routing ACTIVE belum tersedia');
    return build;
  }

  private parseIdList(value?: string) {
    if (!value?.trim()) return [];
    return [
      ...new Set(
        value
          .split(',')
          .map((item) => Number(item.trim()))
          .filter((id) => Number.isInteger(id) && id > 0),
      ),
    ];
  }

  private async getPlaybackNodes(nodeIds: number[]) {
    if (!nodeIds.length) return [];
    const rows: Array<{
      id: number;
      latitude: string | number;
      longitude: string | number;
      type: string | null;
      name: string | null;
    }> = await this.dataSource.query(
      `
        SELECT "id", "latitude", "longitude", "type", "name"
        FROM "road_node"
        WHERE "id" = ANY($1)
      `,
      [nodeIds],
    );
    const byId = new Map(rows.map((row) => [Number(row.id), row]));
    return nodeIds
      .map((id) => byId.get(id))
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .map((row) => ({
        id: Number(row.id),
        latitude: Number(row.latitude),
        longitude: Number(row.longitude),
        type: row.type,
        name: row.name,
      }));
  }

  private async getPlaybackEdges(edgeIds: number[]) {
    if (!edgeIds.length) return [];
    const rows: Array<{
      id: number;
      from_node_id: number;
      to_node_id: number;
      distance_km: string | number;
      road_name: string | null;
      oneway: boolean;
      legacy_geometry: any;
      line_geometry: string | null;
    }> = await this.dataSource.query(
      `
        SELECT
          "id",
          "from_node_id",
          "to_node_id",
          "distance_km",
          "road_name",
          "oneway",
          "geometry" AS "legacy_geometry",
          ST_AsGeoJSON("line_geom") AS "line_geometry"
        FROM "road_edge"
        WHERE "id" = ANY($1)
      `,
      [edgeIds],
    );
    const byId = new Map(rows.map((row) => [Number(row.id), row]));
    return edgeIds
      .map((id) => byId.get(id))
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .map((row) => ({
        id: Number(row.id),
        fromNodeId: Number(row.from_node_id),
        toNodeId: Number(row.to_node_id),
        distanceKm: Number(row.distance_km),
        roadName: row.road_name,
        oneway: row.oneway,
        geometry: this.parseEdgeGeometry(
          row.line_geometry,
          row.legacy_geometry,
        ),
      }));
  }

  private parseEdgeGeometry(lineGeometry: string | null, legacyGeometry: any) {
    if (lineGeometry) {
      try {
        return JSON.parse(lineGeometry);
      } catch {
        return legacyGeometry ?? null;
      }
    }
    return legacyGeometry ?? null;
  }
}
