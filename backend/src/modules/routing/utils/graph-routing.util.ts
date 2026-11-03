import { RoadEdge } from '../../../common/entities/road-edge.entity';

export interface RoadGraphNeighbor {
  nodeId: number;
  distanceKm: number;
}

export type RoadGraph = Map<number, RoadGraphNeighbor[]>;

export interface DijkstraResult {
  distance: number;
  path: number[];
}

export interface AlternativePathResult {
  distanceKm: number;
  pathNodeIds: number[];
}

export interface AlternativePathsResult {
  selectedPath: AlternativePathResult;
  alternatives: AlternativePathResult[];
}

interface QueueItem {
  nodeId: number;
  distance: number;
}

class MinPriorityQueue {
  private readonly heap: QueueItem[] = [];

  get size(): number {
    return this.heap.length;
  }

  enqueue(item: QueueItem): void {
    this.heap.push(item);
    this.bubbleUp(this.heap.length - 1);
  }

  dequeue(): QueueItem | undefined {
    if (this.heap.length === 0) return undefined;
    if (this.heap.length === 1) return this.heap.pop();

    const min = this.heap[0];
    const last = this.heap.pop();

    if (last) {
      this.heap[0] = last;
      this.bubbleDown(0);
    }

    return min;
  }

  private bubbleUp(index: number): void {
    let current = index;

    while (current > 0) {
      const parent = Math.floor((current - 1) / 2);
      if (this.heap[parent].distance <= this.heap[current].distance) break;

      [this.heap[parent], this.heap[current]] = [
        this.heap[current],
        this.heap[parent],
      ];
      current = parent;
    }
  }

  private bubbleDown(index: number): void {
    let current = index;

    while (true) {
      const left = current * 2 + 1;
      const right = current * 2 + 2;
      let smallest = current;

      if (
        left < this.heap.length &&
        this.heap[left].distance < this.heap[smallest].distance
      ) {
        smallest = left;
      }

      if (
        right < this.heap.length &&
        this.heap[right].distance < this.heap[smallest].distance
      ) {
        smallest = right;
      }

      if (smallest === current) break;

      [this.heap[current], this.heap[smallest]] = [
        this.heap[smallest],
        this.heap[current],
      ];
      current = smallest;
    }
  }
}

export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const radLat1 = toRadians(lat1);
  const radLat2 = toRadians(lat2);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radLat1) * Math.cos(radLat2) * Math.sin(dLon / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function buildRoadGraphFromEdges(edges: RoadEdge[]): RoadGraph {
  const graph: RoadGraph = new Map();

  for (const edge of edges) {
    if (!edge.vehicle_accessible) continue;

    addGraphEdge(
      graph,
      edge.from_node_id,
      edge.to_node_id,
      Number(edge.distance_km),
    );

    if (!edge.oneway) {
      addGraphEdge(
        graph,
        edge.to_node_id,
        edge.from_node_id,
        Number(edge.distance_km),
      );
    }
  }

  return graph;
}

export function dijkstraShortestPath(
  graph: RoadGraph,
  startNodeId: number,
  targetNodeId: number,
): DijkstraResult {
  return dijkstraShortestPathWithBlockedEdges(graph, startNodeId, targetNodeId);
}

export function getAlternativePaths(
  graph: RoadGraph,
  fromNodeId: number,
  toNodeId: number,
  limit: number = 3,
): AlternativePathsResult {
  const bestPath = dijkstraShortestPath(graph, fromNodeId, toNodeId);
  const selectedPath = {
    distanceKm: bestPath.distance,
    pathNodeIds: bestPath.path,
  };

  if (!Number.isFinite(bestPath.distance) || bestPath.path.length === 0) {
    return {
      selectedPath,
      alternatives: [],
    };
  }

  const alternatives = new Map<string, AlternativePathResult>();
  alternatives.set(buildPathKey(bestPath.path), selectedPath);

  for (let index = 0; index < bestPath.path.length - 1; index += 1) {
    const blockedEdge = buildEdgeKey(
      bestPath.path[index],
      bestPath.path[index + 1],
    );
    const candidate = dijkstraShortestPathWithBlockedEdges(
      graph,
      fromNodeId,
      toNodeId,
      new Set([blockedEdge]),
    );

    if (!Number.isFinite(candidate.distance) || candidate.path.length === 0) {
      continue;
    }

    const pathKey = buildPathKey(candidate.path);
    if (alternatives.has(pathKey)) continue;

    alternatives.set(pathKey, {
      distanceKm: candidate.distance,
      pathNodeIds: candidate.path,
    });
  }

  const sortedAlternatives = [...alternatives.values()]
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, Math.max(limit, 1));

  return {
    selectedPath: sortedAlternatives[0] ?? selectedPath,
    alternatives: sortedAlternatives,
  };
}

function dijkstraShortestPathWithBlockedEdges(
  graph: RoadGraph,
  startNodeId: number,
  targetNodeId: number,
  blockedEdges: Set<string> = new Set(),
): DijkstraResult {
  const distances = new Map<number, number>();
  const previous = new Map<number, number>();
  const queue = new MinPriorityQueue();

  distances.set(startNodeId, 0);
  queue.enqueue({ nodeId: startNodeId, distance: 0 });

  while (queue.size > 0) {
    const current = queue.dequeue();
    if (!current) break;

    const knownDistance = distances.get(current.nodeId) ?? Infinity;
    if (current.distance > knownDistance) continue;

    if (current.nodeId === targetNodeId) {
      return {
        distance: current.distance,
        path: reconstructPath(previous, startNodeId, targetNodeId),
      };
    }

    for (const neighbor of graph.get(current.nodeId) ?? []) {
      if (blockedEdges.has(buildEdgeKey(current.nodeId, neighbor.nodeId))) {
        continue;
      }

      const nextDistance = current.distance + neighbor.distanceKm;
      const previousDistance = distances.get(neighbor.nodeId) ?? Infinity;

      if (nextDistance < previousDistance) {
        distances.set(neighbor.nodeId, nextDistance);
        previous.set(neighbor.nodeId, current.nodeId);
        queue.enqueue({
          nodeId: neighbor.nodeId,
          distance: nextDistance,
        });
      }
    }
  }

  return { distance: Infinity, path: [] };
}

function buildEdgeKey(fromNodeId: number, toNodeId: number): string {
  return `${fromNodeId}->${toNodeId}`;
}

function buildPathKey(pathNodeIds: number[]): string {
  return pathNodeIds.join('->');
}

function addGraphEdge(
  graph: RoadGraph,
  fromNodeId: number,
  toNodeId: number,
  distanceKm: number,
): void {
  if (!Number.isFinite(distanceKm) || distanceKm < 0) return;

  const neighbors = graph.get(fromNodeId) ?? [];
  neighbors.push({ nodeId: toNodeId, distanceKm });
  graph.set(fromNodeId, neighbors);

  if (!graph.has(toNodeId)) {
    graph.set(toNodeId, []);
  }
}

function reconstructPath(
  previous: Map<number, number>,
  startNodeId: number,
  targetNodeId: number,
): number[] {
  const path: number[] = [];
  let current: number | undefined = targetNodeId;

  while (current !== undefined) {
    path.unshift(current);
    if (current === startNodeId) return path;
    current = previous.get(current);
  }

  return [];
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}
