import type { AdjacencyEdge, BoundingBox, EdgeRecord, Graph, NodeRecord } from './types';

function addAdjacency(map: Map<number, AdjacencyEdge[]>, from: number, entry: AdjacencyEdge): void {
  const list = map.get(from);
  if (list) list.push(entry);
  else map.set(from, [entry]);
}

function computeBoundingBox(nodes: NodeRecord[]): BoundingBox | null {
  if (nodes.length === 0) return null;
  let minLat = Infinity;
  let minLng = Infinity;
  let maxLat = -Infinity;
  let maxLng = -Infinity;
  for (const n of nodes) {
    const [lat, lng] = n.latLng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }
  return { minLat, minLng, maxLat, maxLng };
}

/** Iterative BFS (stack-safe for large graphs) to compute connected components on the undirected view. */
function computeComponents(
  nodeIds: number[],
  undirected: Map<number, AdjacencyEdge[]>,
): { componentOf: Map<number, number>; componentCount: number } {
  const componentOf = new Map<number, number>();
  let componentId = 0;

  for (const start of nodeIds) {
    if (componentOf.has(start)) continue;
    const stack: number[] = [start];
    componentOf.set(start, componentId);

    while (stack.length > 0) {
      const current = stack.pop() as number;
      const neighbours = undirected.get(current) ?? [];
      for (const nb of neighbours) {
        if (!componentOf.has(nb.toNodeId)) {
          componentOf.set(nb.toNodeId, componentId);
          stack.push(nb.toNodeId);
        }
      }
    }
    componentId += 1;
  }

  return { componentOf, componentCount: componentId };
}

export function buildGraph(nodes: NodeRecord[], edges: EdgeRecord[]): Graph {
  const nodeMap = new Map<number, NodeRecord>();
  for (const n of nodes) nodeMap.set(n.id, { ...n, degree: 0 });

  const edgeMap = new Map<number, EdgeRecord>();
  const adjacency = new Map<number, AdjacencyEdge[]>();
  const undirectedAdjacency = new Map<number, AdjacencyEdge[]>();

  for (const e of edges) {
    edgeMap.set(e.id, e);
    if (!nodeMap.has(e.fromNodeId) || !nodeMap.has(e.toNodeId)) continue;

    addAdjacency(adjacency, e.fromNodeId, {
      edgeId: e.id,
      toNodeId: e.toNodeId,
      weightKm: e.distanceKm,
    });
    if (!e.oneWay) {
      addAdjacency(adjacency, e.toNodeId, {
        edgeId: e.id,
        toNodeId: e.fromNodeId,
        weightKm: e.distanceKm,
      });
    }

    addAdjacency(undirectedAdjacency, e.fromNodeId, { edgeId: e.id, toNodeId: e.toNodeId, weightKm: e.distanceKm });
    addAdjacency(undirectedAdjacency, e.toNodeId, { edgeId: e.id, toNodeId: e.fromNodeId, weightKm: e.distanceKm });

    const fromNode = nodeMap.get(e.fromNodeId);
    const toNode = nodeMap.get(e.toNodeId);
    if (fromNode) fromNode.degree += 1;
    if (toNode) toNode.degree += 1;
  }

  const { componentOf, componentCount } = computeComponents([...nodeMap.keys()], undirectedAdjacency);

  return {
    nodes: nodeMap,
    edges: edgeMap,
    adjacency,
    undirectedAdjacency,
    componentOf,
    componentCount,
    boundingBox: computeBoundingBox([...nodeMap.values()]),
  };
}
