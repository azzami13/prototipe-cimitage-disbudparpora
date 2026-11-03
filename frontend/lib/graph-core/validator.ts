import type { EdgeRecord, NodeRecord, ValidationIssue, ValidationReport } from './types';

function issue(
  ruleId: string,
  ruleLabel: string,
  severity: ValidationIssue['severity'],
  ids: (number | string)[],
): ValidationIssue {
  return { ruleId, ruleLabel, severity, count: ids.length, sampleIds: ids.slice(0, 20) };
}

function isValidLatLng(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

export interface ValidatorInput {
  nodes: NodeRecord[];
  edges: EdgeRecord[];
}

/**
 * Validation rules adapted from the standalone Cimitage Graph Inspector's 25-rule set.
 * Several original rules (geometry-empty/invalid, coordinate-out-of-bbox, CRS mismatch)
 * don't apply here because the backend already stores clean point coordinates with no
 * LineString geometry in RoadNode/RoadEdge — those checks are dropped or replaced by
 * their closest equivalent for this schema.
 */
export function validateGraph(input: ValidatorInput): ValidationReport {
  const { nodes, edges } = input;
  const issues: ValidationIssue[] = [];
  const nodeIdSet = new Set(nodes.map((n) => n.id));

  issues.push(issue('node-count', 'Jumlah Node', 'info', [nodes.length]));
  issues.push(issue('edge-count', 'Jumlah Edge', 'info', [edges.length]));

  // Duplicate node (same coordinate)
  const coordKeyCount = new Map<string, number[]>();
  for (const n of nodes) {
    const key = `${n.latLng[0].toFixed(6)},${n.latLng[1].toFixed(6)}`;
    const list = coordKeyCount.get(key) ?? [];
    list.push(n.id);
    coordKeyCount.set(key, list);
  }
  const duplicateNodeIds = [...coordKeyCount.values()].filter((ids) => ids.length > 1).flatMap((ids) => ids.slice(1));
  issues.push(issue('duplicate-node', 'Duplicate Node (koordinat sama)', 'warning', duplicateNodeIds));

  // Duplicate edge (same from/to pair, ignoring direction)
  const edgePairCount = new Map<string, number[]>();
  for (const e of edges) {
    const key = [e.fromNodeId, e.toNodeId].sort((a, b) => a - b).join('-');
    const list = edgePairCount.get(key) ?? [];
    list.push(e.id);
    edgePairCount.set(key, list);
  }
  const duplicateEdgeIds = [...edgePairCount.values()].filter((ids) => ids.length > 1).flatMap((ids) => ids.slice(1));
  issues.push(issue('duplicate-edge', 'Duplicate Edge', 'warning', duplicateEdgeIds));

  // Orphan edge: references a node id that doesn't exist in the loaded node set
  const orphanEdges = edges
    .filter((e) => !nodeIdSet.has(e.fromNodeId) || !nodeIdSet.has(e.toNodeId))
    .map((e) => e.id);
  issues.push(issue('orphan-edge', 'Orphan Edge (from/to node tidak ditemukan)', 'error', orphanEdges));

  // Orphan node: node not referenced by any edge
  const referencedNodeIds = new Set<number>();
  for (const e of edges) {
    referencedNodeIds.add(e.fromNodeId);
    referencedNodeIds.add(e.toNodeId);
  }
  const orphanNodes = nodes.filter((n) => !referencedNodeIds.has(n.id)).map((n) => n.id);
  issues.push(issue('orphan-node', 'Orphan Node (tidak terhubung edge apa pun)', 'warning', orphanNodes));

  // Self loop
  const selfLoops = edges.filter((e) => e.fromNodeId === e.toNodeId).map((e) => e.id);
  issues.push(issue('self-loop', 'Self Loop', 'warning', selfLoops));

  // Zero / negative distance
  const zeroDistance = edges.filter((e) => !(e.distanceKm > 0)).map((e) => e.id);
  issues.push(issue('zero-distance-edge', 'Edge Jarak 0 / Invalid', 'warning', zeroDistance));

  // Invalid coordinate
  const invalidCoord = nodes.filter((n) => !isValidLatLng(n.latLng[0], n.latLng[1])).map((n) => n.id);
  issues.push(issue('coordinate-invalid', 'Coordinate Invalid', 'error', invalidCoord));

  // Degree stats + dead end
  const degreeCount = new Map<number, number>();
  for (const e of edges) {
    degreeCount.set(e.fromNodeId, (degreeCount.get(e.fromNodeId) ?? 0) + 1);
    degreeCount.set(e.toNodeId, (degreeCount.get(e.toNodeId) ?? 0) + 1);
  }
  const deadEnds = [...degreeCount.entries()].filter(([, d]) => d === 1).map(([id]) => id);
  issues.push(issue('dead-end', 'Dead End', 'info', deadEnds));

  const degrees = [...degreeCount.values()];
  const avgDegree = degrees.length ? degrees.reduce((a, b) => a + b, 0) / degrees.length : 0;
  issues.push(issue('average-degree', 'Average Degree', 'info', [Number(avgDegree.toFixed(2))]));
  issues.push(issue('maximum-degree', 'Maximum Degree', 'info', [degrees.length ? Math.max(...degrees) : 0]));
  issues.push(issue('minimum-degree', 'Minimum Degree', 'info', [degrees.length ? Math.min(...degrees) : 0]));

  const oneWayCount = edges.filter((e) => e.oneWay).length;
  issues.push(issue('one-way-count', 'One Way Count', 'info', [oneWayCount]));
  issues.push(issue('two-way-count', 'Two Way Count', 'info', [edges.length - oneWayCount]));

  const vehicleAccessibleCount = edges.filter((e) => e.vehicleAccessible).length;
  issues.push(issue('vehicle-accessible-count', 'Vehicle Accessible Count', 'info', [vehicleAccessibleCount]));

  const totalErrors = issues.filter((i) => i.severity === 'error').reduce((a, i) => a + i.count, 0);
  const totalWarnings = issues.filter((i) => i.severity === 'warning').reduce((a, i) => a + i.count, 0);

  return { issues, totalErrors, totalWarnings };
}

export function attachComponentIssues(report: ValidationReport, componentCount: number): ValidationReport {
  const extra: ValidationIssue[] = [
    issue('connected-component-count', 'Connected Component', 'info', [componentCount]),
    issue('graph-disconnected', 'Graph Terputus', componentCount > 1 ? 'warning' : 'info', [componentCount]),
  ];
  return { ...report, issues: [...report.issues, ...extra] };
}
