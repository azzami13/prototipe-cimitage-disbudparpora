import type { Graph, GraphStatistics, ValidationReport } from './types';

function findCount(report: ValidationReport, ruleId: string): number {
  return report.issues.find((i) => i.ruleId === ruleId)?.count ?? 0;
}

export function computeStatistics(graph: Graph, report: ValidationReport): GraphStatistics {
  const nodes = [...graph.nodes.values()];
  const edges = [...graph.edges.values()];
  const degrees = nodes.map((n) => n.degree);

  const averageDegree = degrees.length ? degrees.reduce((a, b) => a + b, 0) / degrees.length : 0;
  const maximumDegree = degrees.length ? Math.max(...degrees) : 0;
  const minimumDegree = degrees.length ? Math.min(...degrees) : 0;
  const graphLengthKm = edges.reduce((sum, e) => sum + e.distanceKm, 0);
  const oneWayCount = edges.filter((e) => e.oneWay).length;
  const deadEndCount = degrees.filter((d) => d === 1).length;
  const maxPossibleEdges = nodes.length > 1 ? nodes.length * (nodes.length - 1) : 1;

  return {
    totalNode: nodes.length,
    totalEdge: edges.length,
    deadEndCount,
    connectedComponentCount: graph.componentCount,
    boundingBox: graph.boundingBox,
    averageDegree,
    maximumDegree,
    minimumDegree,
    graphDensity: edges.length / maxPossibleEdges,
    graphLengthKm,
    oneWayCount,
    twoWayCount: edges.length - oneWayCount,
    vehicleAccessibleCount: edges.filter((e) => e.vehicleAccessible).length,
    orphanNodeCount: findCount(report, 'orphan-node'),
    orphanEdgeCount: findCount(report, 'orphan-edge'),
  };
}
