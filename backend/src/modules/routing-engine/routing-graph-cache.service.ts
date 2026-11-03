import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoadEdge } from '../../common/entities/road-edge.entity';
import { RoadNode } from '../../common/entities/road-node.entity';
import {
  CachedGraphNeighbor,
  CachedRoadNode,
  DijkstraParent,
  DijkstraResult,
  EdgeStep,
  haversineM,
} from './routing-types';

interface QueueItem {
  nodeCode: string;
  distance: number;
}

type RoadEdgeWithLineGeojson = RoadEdge & { lineGeojson?: string | null };

class MinHeap {
  private readonly items: QueueItem[] = [];
  get size() {
    return this.items.length;
  }
  push(item: QueueItem) {
    this.items.push(item);
    let index = this.items.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.items[parent].distance <= item.distance) break;
      this.items[index] = this.items[parent];
      index = parent;
    }
    this.items[index] = item;
  }
  pop(): QueueItem | undefined {
    if (!this.items.length) return undefined;
    const first = this.items[0];
    const last = this.items.pop()!;
    if (this.items.length) {
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        if (left >= this.items.length) break;
        const child =
          right < this.items.length &&
          this.items[right].distance < this.items[left].distance
            ? right
            : left;
        if (this.items[child].distance >= last.distance) break;
        this.items[index] = this.items[child];
        index = child;
      }
      this.items[index] = last;
    }
    return first;
  }
}

@Injectable()
export class RoutingGraphCacheService {
  private readonly logger = new Logger(RoutingGraphCacheService.name);
  private readonly gridScale = 250;
  private loaded = false;
  private nodes = new Map<string, CachedRoadNode>();
  private adjacency = new Map<string, CachedGraphNeighbor[]>();
  private edgeGeometries = new Map<string, number[][]>();
  private edgeIds = new Map<string, number>();
  private spatialGrid = new Map<string, string[]>();
  private loadingPromise: Promise<void> | null = null;

  constructor(
    @InjectRepository(RoadNode) private readonly nodeRepo: Repository<RoadNode>,
    @InjectRepository(RoadEdge) private readonly edgeRepo: Repository<RoadEdge>,
  ) {}

  async ensureLoaded() {
    if (this.loaded) return;
    if (!this.loadingPromise) {
      this.loadingPromise = this.reload().finally(() => {
        this.loadingPromise = null;
      });
    }
    await this.loadingPromise;
  }

  async reload() {
    const [nodeRows, edgeRows] = await Promise.all([
      this.nodeRepo.find(),
      this.edgeRepo
        .createQueryBuilder('edge')
        .addSelect('ST_AsGeoJSON(edge.line_geom)', 'lineGeojson')
        .getRawAndEntities(),
    ]);
    const edgeLineGeojson = new Map<number, string | null>();
    edgeRows.raw.forEach((row: any, index: number) => {
      const edge = edgeRows.entities[index];
      if (edge) edgeLineGeojson.set(edge.id, row.lineGeojson ?? null);
    });
    const nodes = new Map<string, CachedRoadNode>();
    const adjacency = new Map<string, CachedGraphNeighbor[]>();
    const edgeGeometries = new Map<string, number[][]>();
    const edgeIds = new Map<string, number>();
    const spatialGrid = new Map<string, string[]>();
    const codeById = new Map<number, string>();
    const connectedNodeCodes = new Set<string>();

    for (const row of nodeRows) {
      const node = {
        id: row.id,
        code: String(row.code),
        lat: Number(row.latitude),
        lng: Number(row.longitude),
      };
      if (!Number.isFinite(node.lat) || !Number.isFinite(node.lng)) continue;
      nodes.set(node.code, node);
      codeById.set(node.id, node.code);
    }

    for (const edge of edgeRows.entities as RoadEdgeWithLineGeojson[]) {
      if (!edge.vehicle_accessible || !edge.sakoci_allowed) continue;
      const from = codeById.get(edge.from_node_id);
      const to = codeById.get(edge.to_node_id);
      if (!from || !to) continue;
      const geometry = this.resolveEdgeGeometry(
        edge.geometry,
        edgeLineGeojson.get(edge.id),
      );
      edgeGeometries.set(String(edge.code), geometry);
      edgeIds.set(String(edge.code), edge.id);
      const fallbackM = Number(edge.distance_km) * 1000;
      const forward = Number(edge.forward_cost_m ?? fallbackM);
      const reverse = Number(edge.reverse_cost_m ?? fallbackM);
      if (Number.isFinite(forward) && forward >= 0) {
        connectedNodeCodes.add(from);
        connectedNodeCodes.add(to);
        this.addNeighbor(adjacency, from, {
          toNodeCode: to,
          costM: forward,
          edgeCode: String(edge.code),
          reverseGeometry: false,
        });
      }
      if (!edge.oneway && Number.isFinite(reverse) && reverse >= 0) {
        connectedNodeCodes.add(from);
        connectedNodeCodes.add(to);
        this.addNeighbor(adjacency, to, {
          toNodeCode: from,
          costM: reverse,
          edgeCode: String(edge.code),
          reverseGeometry: true,
        });
      }
    }

    for (const [code, node] of nodes) {
      if (!connectedNodeCodes.has(code)) {
        nodes.delete(code);
        continue;
      }
      const key = this.gridKey(node.lat, node.lng);
      spatialGrid.set(key, [...(spatialGrid.get(key) ?? []), code]);
    }

    this.nodes = nodes;
    this.adjacency = adjacency;
    this.edgeGeometries = edgeGeometries;
    this.edgeIds = edgeIds;
    this.spatialGrid = spatialGrid;
    this.loaded = true;
    this.logger.log(
      `Routing graph cache loaded: ${nodes.size} nodes, ${edgeRows.entities.length} edges`,
    );
  }

  async getNearestNode(latitude: number, longitude: number, maxSnapM = 500) {
    await this.ensureLoaded();
    if (!this.nodes.size) {
      throw new BadRequestException(
        'Graph jalan belum tersedia. Import road_nodes.geojson dan road_edges_cleaned.geojson terlebih dahulu.',
      );
    }
    const [gridLat, gridLng] = this.gridParts(latitude, longitude);
    let candidates: string[] = [];
    const approximateCellM = 111_320 / this.gridScale;
    const radius = Math.max(1, Math.ceil(maxSnapM / approximateCellM));
    for (let dx = -radius; dx <= radius; dx += 1) {
      for (let dy = -radius; dy <= radius; dy += 1) {
        candidates.push(
          ...(this.spatialGrid.get(`${gridLat + dx}:${gridLng + dy}`) ?? []),
        );
      }
    }
    if (!candidates.length) candidates = [...this.nodes.keys()];
    let best: CachedRoadNode | null = null;
    let distanceM = Infinity;
    for (const code of candidates) {
      const node = this.nodes.get(code)!;
      const distance = haversineM(latitude, longitude, node.lat, node.lng);
      if (distance < distanceM) {
        best = node;
        distanceM = distance;
      }
    }
    return best && distanceM <= maxSnapM ? { node: best, distanceM } : null;
  }

  async dijkstra(
    sourceNodeCode: string,
    targetNodeCodes?: Iterable<string>,
  ): Promise<DijkstraResult> {
    await this.ensureLoaded();
    if (!this.nodes.has(sourceNodeCode)) {
      throw new BadRequestException(
        `Node graph ${sourceNodeCode} tidak ditemukan`,
      );
    }
    const needed = new Set(targetNodeCodes ?? []);
    const distances = new Map<string, number>([[sourceNodeCode, 0]]);
    const previous = new Map<string, DijkstraParent>();
    const visited = new Set<string>();
    const heap = new MinHeap();
    heap.push({ nodeCode: sourceNodeCode, distance: 0 });

    while (heap.size) {
      const current = heap.pop()!;
      if (visited.has(current.nodeCode)) continue;
      visited.add(current.nodeCode);
      needed.delete(current.nodeCode);
      if (targetNodeCodes && needed.size === 0) break;
      for (const neighbor of this.adjacency.get(current.nodeCode) ?? []) {
        const candidate = current.distance + neighbor.costM;
        if (candidate >= (distances.get(neighbor.toNodeCode) ?? Infinity))
          continue;
        distances.set(neighbor.toNodeCode, candidate);
        previous.set(neighbor.toNodeCode, {
          previousNodeCode: current.nodeCode,
          edgeCode: neighbor.edgeCode,
          reverseGeometry: neighbor.reverseGeometry,
        });
        heap.push({ nodeCode: neighbor.toNodeCode, distance: candidate });
      }
    }
    return { distances, previous };
  }

  reconstructEdgeSteps(
    previous: Map<string, DijkstraParent>,
    sourceNodeCode: string,
    targetNodeCode: string,
  ): EdgeStep[] {
    if (sourceNodeCode === targetNodeCode) return [];
    const result: EdgeStep[] = [];
    let current = targetNodeCode;
    while (current !== sourceNodeCode) {
      const parent = previous.get(current);
      if (!parent) return [];
      result.push([parent.edgeCode, parent.reverseGeometry]);
      current = parent.previousNodeCode;
    }
    return result.reverse();
  }

  reconstructNodeIds(
    previous: Map<string, DijkstraParent>,
    sourceNodeCode: string,
    targetNodeCode: string,
  ): number[] {
    const codes = [targetNodeCode];
    let current = targetNodeCode;
    while (current !== sourceNodeCode) {
      const parent = previous.get(current);
      if (!parent) return [];
      current = parent.previousNodeCode;
      codes.push(current);
    }
    return codes
      .reverse()
      .map((code) => this.nodes.get(code)?.id)
      .filter((id): id is number => id !== undefined);
  }

  edgeStepsToGeoJson(steps: EdgeStep[]) {
    const coordinates: number[][] = [];
    const edgeCodes: string[] = [];

    for (const [edgeCode, reverseGeometry] of steps) {
      const geometry = this.edgeGeometries.get(String(edgeCode));
      if (!geometry?.length) continue;
      const oriented = reverseGeometry ? [...geometry].reverse() : geometry;
      edgeCodes.push(String(edgeCode));

      for (const coordinate of oriented) {
        if (!this.isCoordinate(coordinate)) continue;
        const previous = coordinates[coordinates.length - 1];
        if (previous && this.sameCoordinate(previous, coordinate)) continue;
        coordinates.push(coordinate);
      }
    }

    return {
      type: 'FeatureCollection' as const,
      features:
        coordinates.length > 1
          ? [
              {
                type: 'Feature' as const,
                geometry: {
                  type: 'LineString' as const,
                  coordinates,
                },
                properties: {
                  edgeCodes,
                  edgeCount: edgeCodes.length,
                  coordinateCount: coordinates.length,
                  source: 'DIJKSTRA_ROAD_EDGE_GEOMETRY',
                },
              },
            ]
          : [],
    };
  }

  edgeStepsToEdgeIds(steps: EdgeStep[]) {
    return steps
      .map(([edgeCode]) => this.edgeIds.get(String(edgeCode)))
      .filter((id): id is number => id !== undefined);
  }

  getNode(code: string) {
    return this.nodes.get(code);
  }

  getNodeCodeById(id: number) {
    for (const node of this.nodes.values()) {
      if (node.id === id) return node.code;
    }
    return undefined;
  }

  getGraphSummary() {
    return {
      loaded: this.loaded,
      nodeCount: this.nodes.size,
      edgeCount: this.edgeGeometries.size,
      adjacencyNodeCount: this.adjacency.size,
    };
  }

  private addNeighbor(
    map: Map<string, CachedGraphNeighbor[]>,
    from: string,
    neighbor: CachedGraphNeighbor,
  ) {
    map.set(from, [...(map.get(from) ?? []), neighbor]);
  }

  private gridParts(lat: number, lng: number) {
    return [Math.floor(lat * this.gridScale), Math.floor(lng * this.gridScale)];
  }

  private gridKey(lat: number, lng: number) {
    const [a, b] = this.gridParts(lat, lng);
    return `${a}:${b}`;
  }

  private isCoordinate(value: unknown): value is number[] {
    return (
      Array.isArray(value) &&
      value.length >= 2 &&
      Number.isFinite(Number(value[0])) &&
      Number.isFinite(Number(value[1]))
    );
  }

  private sameCoordinate(a: number[], b: number[]) {
    return Number(a[0]) === Number(b[0]) && Number(a[1]) === Number(b[1]);
  }

  private resolveEdgeGeometry(
    legacyGeometry: unknown,
    lineGeojson?: string | null,
  ) {
    if (
      Array.isArray(legacyGeometry) &&
      legacyGeometry.some((coordinate) => this.isCoordinate(coordinate))
    ) {
      return legacyGeometry.filter((coordinate): coordinate is number[] =>
        this.isCoordinate(coordinate),
      );
    }
    const postgisGeometry = this.parseLineGeojson(lineGeojson);
    return postgisGeometry ?? [];
  }

  private parseLineGeojson(value?: string | null) {
    if (!value) return null;
    try {
      const parsed = JSON.parse(value);
      if (parsed?.type !== 'LineString' || !Array.isArray(parsed.coordinates))
        return null;
      const coordinates = parsed.coordinates.filter(
        (coordinate: unknown): coordinate is number[] =>
          this.isCoordinate(coordinate),
      );
      return coordinates.length ? coordinates : null;
    } catch {
      return null;
    }
  }
}
