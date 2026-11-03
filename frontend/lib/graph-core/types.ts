/**
 * Graph core types for the admin Graph Inspector.
 *
 * Ported from the standalone "Cimitage Graph Inspector" dev tool, simplified because
 * the Cimahi Heritage backend (`/graph/road-nodes`, `/graph/road-edges`) already returns
 * resolved WGS84 lat/lng and explicit from_node_id/to_node_id — so no UTM transform and
 * no topology derivation step is needed here (see graph-core/adapter.ts).
 *
 * Everything in this folder is framework-agnostic (no React, no Leaflet) on purpose,
 * so it can be reused by other admin views or moved server-side later if needed.
 */

export type LatLng = [lat: number, lng: number];

export interface NodeRecord {
  id: number;
  code: string;
  latLng: LatLng;
  type: string | null;
  name: string | null;
  /** Populated by graphBuilder from edge incidence count. */
  degree: number;
}

export interface EdgeRecord {
  id: number;
  code: string;
  fromNodeId: number;
  toNodeId: number;
  distanceKm: number;
  roadName: string | null;
  oneWay: boolean;
  vehicleAccessible: boolean;
}

export interface AdjacencyEdge {
  edgeId: number;
  toNodeId: number;
  weightKm: number;
}

export interface BoundingBox {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

export interface Graph {
  nodes: Map<number, NodeRecord>;
  edges: Map<number, EdgeRecord>;
  /** Directed adjacency respecting one-way — used by Dijkstra. */
  adjacency: Map<number, AdjacencyEdge[]>;
  /** Undirected adjacency (ignores one-way) — used for connectivity analysis. */
  undirectedAdjacency: Map<number, AdjacencyEdge[]>;
  componentOf: Map<number, number>;
  componentCount: number;
  boundingBox: BoundingBox | null;
}

export interface ValidationIssue {
  ruleId: string;
  ruleLabel: string;
  severity: 'info' | 'warning' | 'error';
  count: number;
  sampleIds: (number | string)[];
}

export interface ValidationReport {
  issues: ValidationIssue[];
  totalErrors: number;
  totalWarnings: number;
}

export interface GraphStatistics {
  totalNode: number;
  totalEdge: number;
  deadEndCount: number;
  connectedComponentCount: number;
  boundingBox: BoundingBox | null;
  averageDegree: number;
  maximumDegree: number;
  minimumDegree: number;
  graphDensity: number;
  graphLengthKm: number;
  oneWayCount: number;
  twoWayCount: number;
  vehicleAccessibleCount: number;
  orphanNodeCount: number;
  orphanEdgeCount: number;
}

export interface PathResult {
  found: boolean;
  startNodeId: number;
  endNodeId: number;
  totalDistanceKm: number;
  nodePath: number[];
  edgePath: number[];
  visitedNodeCount: number;
  executionTimeMs: number;
}
