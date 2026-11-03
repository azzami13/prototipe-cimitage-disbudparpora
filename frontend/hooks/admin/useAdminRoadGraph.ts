'use client';

import { useCallback, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import {
  adaptRoadEdge,
  adaptRoadNode,
  attachComponentIssues,
  buildGraph,
  computeStatistics,
  validateGraph,
  type EdgeRecord,
  type NodeRecord,
} from '@/lib/graph-core';

interface LoaderState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  error: string | null;
  nodes: NodeRecord[];
  edges: EdgeRecord[];
}

const PAGE_LIMIT = 1000;
/** Hard safety cap so a backend bug (e.g. total never shrinking) can't loop forever. */
const MAX_PAGES = 200;

/**
 * `/graph/road-nodes` and `/graph/road-edges` are paginated (max 1000/request).
 * This loads every page sequentially and adapts the result into graph-core's
 * NodeRecord/EdgeRecord shape.
 */
export function useAdminRoadGraph() {
  const [state, setState] = useState<LoaderState>({
    status: 'idle',
    error: null,
    nodes: [],
    edges: [],
  });

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, status: 'loading', error: null }));
    try {
      const nodes: NodeRecord[] = [];
      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const result = await api.graph.roadNodes(page, PAGE_LIMIT);
        nodes.push(...result.data.map(adaptRoadNode));
        if (nodes.length >= result.total || result.data.length < PAGE_LIMIT) break;
      }

      const edges: EdgeRecord[] = [];
      for (let page = 1; page <= MAX_PAGES; page += 1) {
        const result = await api.graph.roadEdges(page, PAGE_LIMIT);
        edges.push(...result.data.map(adaptRoadEdge));
        if (edges.length >= result.total || result.data.length < PAGE_LIMIT) break;
      }

      setState({ status: 'ready', error: null, nodes, edges });
    } catch (err: any) {
      setState((prev) => ({ ...prev, status: 'error', error: err?.message ?? 'Gagal memuat graph jalan.' }));
    }
  }, []);

  const bundle = useMemo(() => {
    if (state.status !== 'ready') return null;
    const graph = buildGraph(state.nodes, state.edges);
    const report = attachComponentIssues(validateGraph({ nodes: state.nodes, edges: state.edges }), graph.componentCount);
    const statistics = computeStatistics(graph, report);
    return { graph, report, statistics };
  }, [state]);

  return { ...state, load, bundle };
}
