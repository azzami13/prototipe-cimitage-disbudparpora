import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { DestinationDistance } from '../../common/entities/destination-distance.entity';
import { DestinationNode } from '../../common/entities/destination-node.entity';
import { HeritageSite } from '../../common/entities/heritage-site.entity';
import { RoutingBuild } from '../../common/entities/routing-build.entity';
import { RoutingGraphCacheService } from './routing-graph-cache.service';
import { EdgeStep, haversineM } from './routing-types';

@Injectable()
export class RoutingMatrixBuilderService {
  private readonly logger = new Logger(RoutingMatrixBuilderService.name);
  private readonly maxSnapM = 500;

  constructor(
    @InjectRepository(HeritageSite)
    private readonly heritageRepo: Repository<HeritageSite>,
    @InjectRepository(DestinationNode)
    private readonly destinationNodeRepo: Repository<DestinationNode>,
    @InjectRepository(DestinationDistance)
    private readonly destinationDistanceRepo: Repository<DestinationDistance>,
    @InjectRepository(RoutingBuild)
    private readonly buildRepo: Repository<RoutingBuild>,
    private readonly dataSource: DataSource,
    private readonly graph: RoutingGraphCacheService,
  ) {}

  async rebuildActiveMatrix() {
    await this.graph.reload();
    const graphSummary = this.graph.getGraphSummary();
    if (!graphSummary.nodeCount || !graphSummary.edgeCount) {
      throw new BadRequestException(
        'Graph jalan belum tersedia. Letakkan GeoJSON asli di backend/private-data/routing lalu jalankan routing:import-geojson.',
      );
    }

    let build = await this.buildRepo.save(
      this.buildRepo.create({
        status: 'BUILDING',
        is_active: false,
        started_at: new Date(),
        graph_node_count: graphSummary.nodeCount,
        graph_edge_count: graphSummary.edgeCount,
      }),
    );

    try {
      const sites = await this.heritageRepo
        .createQueryBuilder('site')
        .where('site.status = :status', { status: 'aktif' })
        .andWhere('site.latitude IS NOT NULL')
        .andWhere('site.longitude IS NOT NULL')
        .orderBy('site.id', 'ASC')
        .getMany();
      if (sites.length < 2) {
        throw new BadRequestException(
          'Minimal dua heritage site aktif dengan koordinat diperlukan',
        );
      }

      const routable: Array<{
        site: HeritageSite;
        nodeCode: string;
        nodeId: number;
        snapDistanceM: number;
      }> = [];
      const mappings: DestinationNode[] = [];

      for (const site of sites) {
        const snap = await this.graph.getNearestNode(
          Number(site.latitude),
          Number(site.longitude),
          this.maxSnapM,
        );
        if (!snap) {
          mappings.push(
            this.destinationNodeRepo.create({
              heritage_site_id: site.id,
              road_node_id: null,
              distance_to_node_km: 0,
              snap_distance_m: null,
              routing_status: 'NO_NEAREST_NODE',
              routing_error: `Tidak ada node jalan dalam ${this.maxSnapM} meter`,
              routing_build_id: build.id,
            }),
          );
          continue;
        }
        routable.push({
          site,
          nodeCode: snap.node.code,
          nodeId: snap.node.id,
          snapDistanceM: snap.distanceM,
        });
        mappings.push(
          this.destinationNodeRepo.create({
            heritage_site_id: site.id,
            road_node_id: snap.node.id,
            distance_to_node_km: snap.distanceM / 1000,
            snap_distance_m: snap.distanceM,
            routing_status: 'READY',
            routing_error: null,
            routing_build_id: build.id,
          }),
        );
      }

      if (routable.length < 2) {
        throw new BadRequestException(
          'Heritage site yang berhasil di-snap ke graph kurang dari dua',
        );
      }
      await this.destinationNodeRepo.save(mappings, { chunk: 500 });

      let unreachablePairCount = 0;
      const rows: DestinationDistance[] = [];
      const targetCodes = routable.map((item) => item.nodeCode);
      for (const origin of routable) {
        const dijkstra = await this.graph.dijkstra(
          origin.nodeCode,
          targetCodes,
        );
        for (const destination of routable) {
          if (origin.site.id === destination.site.id) continue;
          const distanceM = dijkstra.distances.get(destination.nodeCode);
          if (!Number.isFinite(distanceM)) {
            unreachablePairCount += 1;
            continue;
          }
          const edgeSteps: EdgeStep[] = this.graph.reconstructEdgeSteps(
            dijkstra.previous,
            origin.nodeCode,
            destination.nodeCode,
          );
          const pathNodeIds = this.graph.reconstructNodeIds(
            dijkstra.previous,
            origin.nodeCode,
            destination.nodeCode,
          );
          const pathEdgeIds = this.graph.edgeStepsToEdgeIds(edgeSteps);
          this.validatePathShape(
            pathNodeIds,
            pathEdgeIds,
            origin.site.id,
            destination.site.id,
          );
          rows.push(
            this.destinationDistanceRepo.create({
              from_heritage_site_id: origin.site.id,
              to_heritage_site_id: destination.site.id,
              distance_km: Number(distanceM) / 1000,
              duration_minutes: (Number(distanceM) / 1000 / 25) * 60,
              path_node_ids: pathNodeIds,
              path_edge_ids: pathEdgeIds,
              path_edge_steps: edgeSteps,
              path_geojson: this.graph.edgeStepsToGeoJson(edgeSteps),
              haversine_distance_m: haversineM(
                Number(origin.site.latitude),
                Number(origin.site.longitude),
                Number(destination.site.latitude),
                Number(destination.site.longitude),
              ),
              calculation_method: 'DIJKSTRA_PRECOMPUTED',
              routing_build_id: build.id,
            }),
          );
        }
      }
      if (rows.length) {
        await this.destinationDistanceRepo.save(rows, { chunk: 300 });
        await this.dataSource.query(
          `
            UPDATE "destination_distance"
            SET "path_geometry" = ST_SetSRID(
              ST_GeomFromGeoJSON(("path_geojson"->'features'->0->'geometry')::text),
              4326
            )
            WHERE "routing_build_id" = $1
              AND "path_geojson" IS NOT NULL
              AND jsonb_typeof("path_geojson"->'features') = 'array'
              AND jsonb_array_length("path_geojson"->'features') > 0
              AND "path_geojson"->'features'->0->'geometry'->>'type' = 'LineString'
          `,
          [build.id],
        );
      }

      await this.dataSource.transaction(async (manager) => {
        await manager
          .createQueryBuilder()
          .update(RoutingBuild)
          .set({ is_active: false, status: 'STALE' })
          .where('is_active = :active', { active: true })
          .execute();
        await manager.getRepository(RoutingBuild).update(build.id, {
          status: 'ACTIVE',
          is_active: true,
          finished_at: new Date(),
          asset_count: sites.length,
          routable_asset_count: routable.length,
          skipped_asset_count: sites.length - routable.length,
          unreachable_pair_count: unreachablePairCount,
        });
      });
      build = (await this.buildRepo.findOneBy({ id: build.id }))!;
      return {
        message: 'Matrix Dijkstra dan route cache database berhasil dibangun',
        activeBuildId: build.id,
        status: build.status,
        graphNodeCount: graphSummary.nodeCount,
        graphEdgeCount: graphSummary.edgeCount,
        assetCount: sites.length,
        routableAssetCount: routable.length,
        skippedAssetCount: sites.length - routable.length,
        destinationDistances: rows.length,
        unreachablePairCount,
        calculationMethod: 'DIJKSTRA_PRECOMPUTED',
      };
    } catch (error: any) {
      await this.buildRepo.update(build.id, {
        status: 'FAILED',
        is_active: false,
        finished_at: new Date(),
        error_message: error?.message ?? String(error),
      });
      this.logger.error(
        `Routing matrix build ${build.id} failed`,
        error?.stack,
      );
      throw error;
    }
  }

  async getActiveBuild() {
    return this.buildRepo.findOne({
      where: { is_active: true, status: 'ACTIVE' },
      order: { created_at: 'DESC' },
    });
  }

  private validatePathShape(
    pathNodeIds: number[],
    pathEdgeIds: number[],
    fromSiteId: number,
    toSiteId: number,
  ) {
    if (
      pathNodeIds.length > 1 &&
      pathEdgeIds.length !== pathNodeIds.length - 1
    ) {
      throw new BadRequestException(
        `Path ${fromSiteId} -> ${toSiteId} tidak valid: jumlah edge tidak sama dengan jumlah node - 1`,
      );
    }
  }
}
