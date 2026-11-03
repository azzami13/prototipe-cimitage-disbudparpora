import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import axios from 'axios';
import { In, Repository } from 'typeorm';
import { DestinationDistance } from '../../common/entities/destination-distance.entity';
import { DestinationNode } from '../../common/entities/destination-node.entity';
import { HeritageSite } from '../../common/entities/heritage-site.entity';
import { RoutingBuild } from '../../common/entities/routing-build.entity';
import { RoutingGeoJsonService } from '../routing-engine/routing-geojson.service';
import { RoutingGraphCacheService } from '../routing-engine/routing-graph-cache.service';
import { EdgeStep, haversineM } from '../routing-engine/routing-types';
import { solveTsp, TspNodeId } from './algorithms/tsp.algorithm';
import { DestinationDistanceGeometryRepository } from './destination-distance-geometry.repository';
import { OsrmService } from './osrm.service';

export interface GeoPoint {
  id: number;
  name: string;
  lat: number;
  lng: number;
}

export interface RouteResult {
  distance: number;
  duration: number;
  geometry: any;
}

export interface OptimizeV2Request {
  pickup?: {
    latitude?: number;
    longitude?: number;
    lat?: number;
    lng?: number;
  };
  pickupLatitude?: number;
  pickupLongitude?: number;
  pickupLat?: number;
  pickupLng?: number;
  destinationIds: number[];
  fixedEndId?: number;
  useOsrm?: boolean;
  maxPickupSnapM?: number;
}

@Injectable()
export class RoutingService {
  private readonly logger = new Logger(RoutingService.name);
  private readonly pickupId = 'PICKUP';

  constructor(
    @InjectRepository(HeritageSite)
    private readonly heritageRepo: Repository<HeritageSite>,
    @InjectRepository(DestinationNode)
    private readonly destinationNodeRepo: Repository<DestinationNode>,
    @InjectRepository(DestinationDistance)
    private readonly distanceRepo: Repository<DestinationDistance>,
    @InjectRepository(RoutingBuild)
    private readonly buildRepo: Repository<RoutingBuild>,
    private readonly graph: RoutingGraphCacheService,
    private readonly geojson: RoutingGeoJsonService,
    private readonly osrmService: OsrmService,
    private readonly distanceGeometry: DestinationDistanceGeometryRepository,
  ) {}

  async optimizeV2(body: OptimizeV2Request) {
    const destinationIds = this.normalizeDestinationIds(
      body.destinationIds,
      body.fixedEndId,
    );
    if (destinationIds.length < 2 || destinationIds.length > 8) {
      throw new BadRequestException('Pilih 2 sampai 8 destinasi unik');
    }
    const sites = await this.heritageRepo.find({
      where: { id: In(destinationIds), status: 'aktif' },
    });
    const siteById = new Map(sites.map((site) => [site.id, site]));
    const missing = destinationIds.filter((id) => !siteById.has(id));
    if (missing.length) {
      throw new BadRequestException(
        `Destinasi tidak ditemukan atau tidak aktif: ${missing.join(', ')}`,
      );
    }

    const build = await this.buildRepo.findOne({
      where: { status: 'ACTIVE', is_active: true },
      order: { created_at: 'DESC' },
    });
    if (!build) {
      if (body.useOsrm === true) return this.osrmFallback(body, sites);
      throw this.businessError(
        'ROUTING_MATRIX_NOT_READY',
        'Matrix routing ACTIVE belum tersedia. Admin perlu mengimpor GeoJSON dan rebuild matrix.',
      );
    }

    const mappings = await this.destinationNodeRepo.find({
      where: {
        routing_build_id: build.id,
        heritage_site_id: In(destinationIds),
      },
    });
    const mappingBySite = new Map(
      mappings.map((item) => [item.heritage_site_id, item]),
    );
    const unroutable = destinationIds.filter((id) => {
      const mapping = mappingBySite.get(id);
      return (
        !mapping || mapping.routing_status !== 'READY' || !mapping.road_node_id
      );
    });
    if (unroutable.length) {
      const names = unroutable.map((id) => siteById.get(id)?.name ?? `#${id}`);
      throw new BadRequestException(
        `Destinasi belum routable pada build aktif: ${names.join(', ')}`,
      );
    }

    const distances = await this.distanceRepo.find({
      where: {
        routing_build_id: build.id,
        from_heritage_site_id: In(destinationIds),
        to_heritage_site_id: In(destinationIds),
      },
    });
    const distanceByPair = new Map(
      distances.map((item) => [
        `${item.from_heritage_site_id}::${item.to_heritage_site_id}`,
        item,
      ]),
    );
    const geojsonByDistanceId =
      await this.distanceGeometry.getRouteGeojsonByDistanceId(distances);
    const matrix: Record<string, Record<string, number>> = {};
    for (const from of destinationIds) {
      matrix[String(from)] = {};
      for (const to of destinationIds) {
        if (from === to) {
          matrix[String(from)][String(to)] = 0;
          continue;
        }
        const row = distanceByPair.get(`${from}::${to}`);
        if (!row) {
          throw new BadRequestException(
            `Matrix aktif tidak memiliki koneksi ${from} → ${to}`,
          );
        }
        matrix[String(from)][String(to)] = Number(row.distance_km);
      }
    }

    const pickup = this.normalizePickup(body);
    const pickupRoutes = new Map<
      number,
      {
        distanceKm: number;
        edgeSteps: EdgeStep[];
        nodeIds: number[];
        edgeIds: number[];
        geojson: any;
      }
    >();
    let startId: TspNodeId = destinationIds[0];
    let tspDestinations = destinationIds.slice(1);

    if (pickup) {
      await this.graph.ensureLoaded();
      const maxPickupSnapM = this.pickupMaxSnapM(body);
      const nearest = await this.graph.getNearestNode(
        pickup.latitude,
        pickup.longitude,
        maxPickupSnapM,
      );
      if (!nearest) {
        throw this.businessError(
          'PICKUP_NOT_ROUTABLE',
          `Pickup berada lebih dari ${maxPickupSnapM} meter dari graph jalan Sakoci`,
        );
      }
      // Mapping cache memakai code sebagai identitas; resolve lewat node database id yang tersimpan.
      const codeByDestination = new Map<number, string>();
      for (const id of destinationIds) {
        const mapping = mappingBySite.get(id)!;
        const code = this.graph.getNodeCodeById(mapping.road_node_id!);
        if (!code)
          throw new BadRequestException(
            `Node mapping destinasi #${id} tidak ada di graph cache`,
          );
        codeByDestination.set(id, code);
      }
      const dijkstra = await this.graph.dijkstra(
        nearest.node.code,
        codeByDestination.values(),
      );
      matrix[this.pickupId] = {};
      for (const id of destinationIds) {
        const code = codeByDestination.get(id)!;
        const distanceM = dijkstra.distances.get(code);
        if (!Number.isFinite(distanceM)) {
          throw this.businessError(
            'PICKUP_NOT_ROUTABLE',
            `Pickup tidak terhubung ke ${siteById.get(id)?.name}`,
          );
        }
        const edgeSteps = this.graph.reconstructEdgeSteps(
          dijkstra.previous,
          nearest.node.code,
          code,
        );
        const nodeIds = this.graph.reconstructNodeIds(
          dijkstra.previous,
          nearest.node.code,
          code,
        );
        const edgeIds = this.graph.edgeStepsToEdgeIds(edgeSteps);
        const routeGeojson = this.graph.edgeStepsToGeoJson(edgeSteps);
        matrix[this.pickupId][String(id)] = Number(distanceM) / 1000;
        pickupRoutes.set(id, {
          distanceKm: Number(distanceM) / 1000,
          edgeSteps,
          nodeIds,
          edgeIds,
          geojson: routeGeojson,
        });
      }
      startId = this.pickupId;
      tspDestinations = destinationIds;
    }

    const tsp = solveTsp({
      startId,
      destinationIds: tspDestinations,
      fixedEndId: body.fixedEndId,
      distanceMatrix: matrix,
    });
    if (!Number.isFinite(tsp.totalDistanceKm)) {
      throw new BadRequestException(
        'Destinasi terpilih tidak saling terhubung pada matrix Dijkstra',
      );
    }

    const segments: any[] = [];
    const collections: any[] = [];
    let totalHaversineM = 0;
    for (let index = 0; index < tsp.orderedIds.length - 1; index += 1) {
      const from = tsp.orderedIds[index];
      const to = tsp.orderedIds[index + 1];
      if (from === this.pickupId) {
        const site = siteById.get(Number(to))!;
        const route = pickupRoutes.get(Number(to))!;
        // AUDIT HAVERSINE:
        // File: src/modules/routing/routing.service.ts
        // Fungsi: optimizeV2
        // Tujuan: Menghitung jarak garis lurus untuk metadata `totalHaversineDistanceKm`.
        // Pengaruh: TIDAK mempengaruhi optimasi rute (TSP/Dijkstra). Hanya untuk data pelengkap. Aman.
        const haversineDistanceM = haversineM(
          pickup!.latitude,
          pickup!.longitude,
          Number(site.latitude),
          Number(site.longitude),
        );
        totalHaversineM += haversineDistanceM;
        const segment = {
          fromHeritageSiteId: null,
          toHeritageSiteId: site.id,
          from: { id: this.pickupId, name: 'Titik Jemput', ...pickup },
          to: this.mapSite(site),
          distanceKm: route.distanceKm,
          haversineDistanceKm: haversineDistanceM / 1000,
          durationMinutes: (route.distanceKm / 25) * 60,
          edgeSteps: route.edgeSteps,
          pathNodeIds: route.nodeIds,
          pathEdgeIds: route.edgeIds,
          path_geojson: route.geojson,
          pathGeojson: route.geojson,
          geojson: route.geojson,
          geometry: null,
          geometrySource: 'DIJKSTRA_GRAPH_CACHE',
          alternatives: [],
        };
        segments.push(segment);
        collections.push(route.geojson);
        continue;
      }
      const row = distanceByPair.get(`${from}::${to}`)!;
      const segmentGeojson =
        geojsonByDistanceId.get(row.id) ??
        this.geojson.fromEdgeSteps(row.path_edge_steps ?? []);
      const haversineDistanceM = Number(row.haversine_distance_m ?? 0);
      totalHaversineM += haversineDistanceM;
      segments.push({
        fromHeritageSiteId: Number(from),
        toHeritageSiteId: Number(to),
        from: this.mapSite(siteById.get(Number(from))!),
        to: this.mapSite(siteById.get(Number(to))!),
        distanceKm: Number(row.distance_km),
        haversineDistanceKm: haversineDistanceM / 1000,
        durationMinutes: Number(
          row.duration_minutes ?? (Number(row.distance_km) / 25) * 60,
        ),
        edgeSteps: row.path_edge_steps ?? [],
        pathNodeIds: row.path_node_ids ?? [],
        pathEdgeIds: row.path_edge_ids ?? [],
        path_geojson: segmentGeojson,
        pathGeojson: segmentGeojson,
        geojson: segmentGeojson,
        geometry: null,
        geometrySource: 'DIJKSTRA_GRAPH_CACHE',
        alternatives: [],
      });
      collections.push(segmentGeojson);
    }
    const routeGeojson = this.geojson.merge(collections);
    const orderedDestinationIds = tsp.orderedIds
      .filter((id) => id !== this.pickupId)
      .map(Number);
    const totalDurationMinutes = segments.reduce(
      (sum, item) => sum + item.durationMinutes,
      0,
    );

    return {
      algorithm: 'HELD_KARP_TSP_WITH_DIJKSTRA_MATRIX',
      routeSource: 'DIJKSTRA_GRAPH_CACHE',
      activeRoutingBuildId: build.id,
      orderedDestinationIds,
      orderedDestinations: orderedDestinationIds.map((id) =>
        this.mapSite(siteById.get(id)!),
      ),
      totalDistanceKm: tsp.totalDistanceKm,
      totalHaversineDistanceKm: totalHaversineM / 1000,
      totalDurationMinutes,
      segments,
      geojson: routeGeojson,
      routeGeojson,
      pickupSegment: pickup ? (segments[0] ?? null) : null,
      warnings: [],
      evaluatedRoutes: tsp.evaluatedRoutes,
      osrm: null,
    };
  }

  async getActiveRoutingBuild() {
    return this.buildRepo.findOne({
      where: { status: 'ACTIVE', is_active: true },
      order: { created_at: 'DESC' },
    });
  }

  async optimizeV2Public(body: OptimizeV2Request) {
    let result: any;
    try {
      result = await this.optimizeV2({
        pickup: body.pickup,
        destinationIds: body.destinationIds,
        fixedEndId: body.fixedEndId,
        useOsrm: false,
      });
    } catch (error) {
      if (error instanceof BadRequestException) {
        const response = error.getResponse();
        const message =
          typeof response === 'string'
            ? response
            : String((response as { message?: string }).message ?? '');
        if (
          message.startsWith('Pilih 2 sampai 8') ||
          message.startsWith('Destinasi tidak ditemukan atau tidak aktif') ||
          message.startsWith('Pickup berada lebih dari') ||
          message === 'Koordinat pickup tidak valid'
        ) {
          throw error;
        }
      }
      throw new ServiceUnavailableException(
        'Rute optimal belum tersedia untuk pilihan tersebut',
      );
    }

    const segments = (result.segments ?? []).map((segment: any) => ({
      fromHeritageSiteId: segment.fromHeritageSiteId ?? null,
      toHeritageSiteId: segment.toHeritageSiteId ?? null,
      from: segment.from,
      to: segment.to,
      distanceKm: segment.distanceKm,
      haversineDistanceKm: segment.haversineDistanceKm,
      durationMinutes: segment.durationMinutes,
      path_geojson:
        segment.path_geojson ??
        segment.pathGeojson ??
        segment.geojson ??
        segment.geometry ??
        null,
      pathGeojson:
        segment.pathGeojson ??
        segment.path_geojson ??
        segment.geojson ??
        segment.geometry ??
        null,
      geojson: segment.geojson ?? segment.geometry ?? null,
    }));

    return {
      orderedDestinationIds: result.orderedDestinationIds ?? [],
      orderedDestinations: result.orderedDestinations ?? [],
      totalDistanceKm: result.totalDistanceKm,
      totalHaversineDistanceKm: result.totalHaversineDistanceKm ?? null,
      totalDurationMinutes: result.totalDurationMinutes ?? null,
      segments,
      geojson: result.geojson ?? result.routeGeojson ?? null,
      routeGeojson: result.routeGeojson ?? result.geojson ?? null,
      warnings: result.warnings ?? [],
    };
  }

  async getRoute(from: GeoPoint, to: GeoPoint): Promise<RouteResult | null> {
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
      const response = await axios.get(url, { timeout: 5000 });
      const route = response.data.routes[0];
      return {
        distance: route.distance,
        duration: route.duration,
        geometry: route.geometry,
      };
    } catch (error: any) {
      this.logger.warn(`OSRM fallback failed: ${error?.message}`);
      return null;
    }
  }

  haversineDistance(a: GeoPoint, b: GeoPoint) {
    return haversineM(a.lat, a.lng, b.lat, b.lng);
  }

  /**
   * @deprecated
   * AUDIT HAVERSINE:
   * File: src/modules/routing/routing.service.ts
   * Fungsi: buildDistanceMatrix
   * Tujuan: Membangun matriks jarak antar titik menggunakan jarak garis lurus (Haversine).
   * Pengaruh: SANGAT MEMPENGARUHI optimasi pada endpoint legacy (`/dijkstra`, `/optimize`).
   * Metode ini TIDAK AKURAT untuk routing jalan raya dan hanya dipertahankan untuk endpoint super_admin yang usang.
   * Fitur utama `optimizeV2` TIDAK menggunakan metode ini.
   */
  buildDistanceMatrix(points: GeoPoint[]) {
    return points.map((from, i) =>
      points.map((to, j) => (i === j ? 0 : this.haversineDistance(from, to))),
    );
  }

  /** @deprecated Menjalankan Dijkstra pada matriks Haversine, tidak akurat. */
  dijkstra(matrix: number[][], source: number) {
    const dist = Array(matrix.length).fill(Infinity);
    const prev = Array(matrix.length).fill(-1);
    const visited = Array(matrix.length).fill(false);
    dist[source] = 0;
    for (let count = 0; count < matrix.length; count += 1) {
      let current = -1;
      for (let i = 0; i < matrix.length; i += 1) {
        if (!visited[i] && (current === -1 || dist[i] < dist[current]))
          current = i;
      }
      if (current < 0 || !Number.isFinite(dist[current])) break;
      visited[current] = true;
      for (let next = 0; next < matrix.length; next += 1) {
        const candidate = dist[current] + matrix[current][next];
        if (
          !visited[next] &&
          matrix[current][next] > 0 &&
          candidate < dist[next]
        ) {
          dist[next] = candidate;
          prev[next] = current;
        }
      }
    }
    return { dist, prev };
  }

  reconstructPath(prev: number[], target: number) {
    const path: number[] = [];
    for (let current = target; current !== -1; current = prev[current])
      path.unshift(current);
    return path;
  }

  /** @deprecated Menggunakan OSRM/Haversine, tidak efisien dan tidak akurat. */
  async computeOptimalRoute(destinations: GeoPoint[], userLocation?: GeoPoint) {
    const points = userLocation
      ? [userLocation, ...destinations]
      : destinations;
    const matrix = this.buildDistanceMatrix(points);
    const order = points.map((_, index) => index);
    const segments: Array<{
      from: GeoPoint;
      to: GeoPoint;
      distance: number;
      duration: number;
      geometry: any;
    }> = [];
    let totalDistance = 0;
    let totalDuration = 0;
    for (let i = 0; i < order.length - 1; i += 1) {
      const from = points[order[i]];
      const to = points[order[i + 1]];
      const route = await this.getRoute(from, to);
      const distance = route?.distance ?? matrix[order[i]][order[i + 1]];
      const duration = route?.duration ?? distance / 10;
      totalDistance += distance;
      totalDuration += duration;
      segments.push({
        from,
        to,
        distance,
        duration,
        geometry: route?.geometry ?? null,
      });
    }
    return {
      orderedDestinations: userLocation ? points.slice(1) : points,
      totalDistance,
      totalDuration,
      segments,
    };
  }

  private normalizeDestinationIds(ids: number[] = [], fixedEndId?: number) {
    const values = [...ids, ...(fixedEndId === undefined ? [] : [fixedEndId])]
      .map(Number)
      .filter((id) => Number.isInteger(id) && id > 0);
    return [...new Set(values)];
  }

  private normalizePickup(body: OptimizeV2Request) {
    const latitude =
      body.pickup?.latitude ??
      body.pickup?.lat ??
      body.pickupLatitude ??
      body.pickupLat;
    const longitude =
      body.pickup?.longitude ??
      body.pickup?.lng ??
      body.pickupLongitude ??
      body.pickupLng;
    if (latitude === undefined && longitude === undefined) return null;
    if (
      !Number.isFinite(Number(latitude)) ||
      !Number.isFinite(Number(longitude))
    ) {
      throw new BadRequestException('Koordinat pickup tidak valid');
    }
    return { latitude: Number(latitude), longitude: Number(longitude) };
  }

  private pickupMaxSnapM(body: OptimizeV2Request) {
    const configured = Number(
      process.env.ROUTING_PICKUP_MAX_SNAP_METERS ?? 150,
    );
    const requested = Number(body.maxPickupSnapM ?? configured);
    return Number.isFinite(requested) && requested > 0 ? requested : 150;
  }

  private businessError(code: string, message: string) {
    return new BadRequestException({ code, message });
  }

  private mapSite(site: HeritageSite) {
    return {
      id: site.id,
      name: site.name,
      category: site.category,
      address: site.address,
      latitude: Number(site.latitude),
      longitude: Number(site.longitude),
    };
  }

  private async osrmFallback(body: OptimizeV2Request, sites: HeritageSite[]) {
    const pickup = this.normalizePickup(body);
    const points = [
      ...(pickup
        ? [{ id: this.pickupId, name: 'Titik Jemput', ...pickup }]
        : []),
      ...sites.map((site) => this.mapSite(site)),
    ];
    const route = await this.osrmService.getRouteGeometry(points);
    if (!route)
      throw new BadRequestException(
        'Matrix graph dan fallback OSRM tidak tersedia',
      );
    return {
      algorithm: 'OSRM_FALLBACK',
      routeSource: 'OSRM_FALLBACK',
      activeRoutingBuildId: null,
      orderedDestinationIds: sites.map((site) => site.id),
      orderedDestinations: sites.map((site) => this.mapSite(site)),
      totalDistanceKm: route.distanceKm,
      totalHaversineDistanceKm: null,
      totalDurationMinutes: route.durationMinutes,
      segments: [],
      geojson: route.geojson,
      routeGeojson: route.geojson,
      pickupSegment: null,
      warnings: [
        'Graph Dijkstra aktif tidak tersedia; menggunakan OSRM fallback.',
      ],
      evaluatedRoutes: [],
      osrm: route,
    };
  }
}
