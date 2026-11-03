import { Injectable, Logger } from '@nestjs/common';
import { RoutingGraphCacheService } from './routing-graph-cache.service';

export interface ValidationResult {
  level: 'PASS' | 'WARN' | 'ERROR';
  message: string;
  count: number;
  details?: (string | number)[];
}

@Injectable()
export class GraphValidatorService {
  private readonly logger = new Logger(GraphValidatorService.name);

  constructor(private readonly graphCache: RoutingGraphCacheService) {}

  async validate(): Promise<ValidationResult[]> {
    const graph = this.graphCache.getGraphSummary();
    if (!graph.loaded || graph.nodeCount === 0 || graph.edgeCount === 0) {
      return [
        {
          level: 'ERROR',
          message: 'Graph is not loaded or is empty.',
          count: 0,
        },
      ];
    }

    return [
      {
        level: 'PASS',
        message: 'Graph cache is loaded.',
        count: graph.nodeCount,
      },
    ];
  }

  private addResult(
    results: ValidationResult[],
    level: 'WARN' | 'ERROR',
    message: string,
    details: (string | number)[],
  ) {
    if (details.length > 0) {
      results.push({
        level,
        message,
        count: details.length,
        details: details.slice(0, 10),
      }); // Tampilkan 10 contoh
    }
  }

  private findConnectedComponents(
    adj: Map<string, { node: string; weight: number }[]>,
    nodes: Set<string>,
  ) {
    const visited = new Set<string>();
    let components = 0;
    let isolatedNodeCount = 0;

    for (const node of nodes) {
      if (!visited.has(node)) {
        components++;
        const componentSize = this.bfs(node, adj, visited);
        if (componentSize === 1) {
          isolatedNodeCount++;
        }
      }
    }
    return { components, isolatedNodeCount };
  }

  private bfs(
    startNode: string,
    adj: Map<string, { node: string; weight: number }[]>,
    visited: Set<string>,
  ): number {
    const queue = [startNode];
    visited.add(startNode);
    let size = 0;
    while (queue.length > 0) {
      const currentNode = queue.shift()!;
      size++;
      const neighbors = adj.get(currentNode) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor.node)) {
          visited.add(neighbor.node);
          queue.push(neighbor.node);
        }
      }
    }
    return size;
  }
}
