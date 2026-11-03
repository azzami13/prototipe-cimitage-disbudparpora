import type { Graph, PathResult } from './types';
import { PriorityQueue } from './priorityQueue';

/**
 * Runs Dijkstra from startNodeId to endNodeId using the graph's directed adjacency
 * (already respects one-way). Used in the admin Graph Inspector to spot-check a route
 * client-side against the backend's stored `destination_distances` / cost matrix.
 */
export function runDijkstra(graph: Graph, startNodeId: number, endNodeId: number): PathResult {
  const t0 = performance.now();

  const dist = new Map<number, number>();
  const prevNode = new Map<number, number>();
  const prevEdge = new Map<number, number>();
  const finalized = new Set<number>();

  dist.set(startNodeId, 0);
  const pq = new PriorityQueue<number>();
  pq.push(startNodeId, 0);

  let visitedNodeCount = 0;

  while (!pq.isEmpty()) {
    const current = pq.pop() as number;
    if (finalized.has(current)) continue;
    finalized.add(current);
    visitedNodeCount += 1;

    if (current === endNodeId) break;

    const neighbours = graph.adjacency.get(current) ?? [];
    for (const edge of neighbours) {
      if (finalized.has(edge.toNodeId)) continue;
      const candidate = (dist.get(current) ?? Infinity) + edge.weightKm;
      const known = dist.get(edge.toNodeId) ?? Infinity;
      if (candidate < known) {
        dist.set(edge.toNodeId, candidate);
        prevNode.set(edge.toNodeId, current);
        prevEdge.set(edge.toNodeId, edge.edgeId);
        pq.push(edge.toNodeId, candidate);
      }
    }
  }

  const found = dist.has(endNodeId);
  const nodePath: number[] = [];
  const edgePath: number[] = [];

  if (found) {
    let cursor: number | undefined = endNodeId;
    while (cursor !== undefined) {
      nodePath.unshift(cursor);
      const e = prevEdge.get(cursor);
      if (e !== undefined) edgePath.unshift(e);
      cursor = prevNode.get(cursor);
    }
  }

  return {
    found,
    startNodeId,
    endNodeId,
    totalDistanceKm: found ? (dist.get(endNodeId) as number) : Infinity,
    nodePath,
    edgePath,
    visitedNodeCount,
    executionTimeMs: performance.now() - t0,
  };
}
