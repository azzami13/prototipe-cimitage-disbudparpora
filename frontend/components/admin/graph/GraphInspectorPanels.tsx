'use client';

import { useMemo, useState } from 'react';
import type { Graph, GraphStatistics, PathResult, ValidationReport } from '@/lib/graph-core';
import { runDijkstra } from '@/lib/graph-core';
import type { GraphMapLayerVisibility } from './GraphMapView';

const SEVERITY_COLOR: Record<string, string> = {
  error: 'text-red-600',
  warning: 'text-amber-600',
  info: 'text-gray-500',
};

function fmtKm(value: number) {
  if (!Number.isFinite(value)) return '-';
  return `${value.toFixed(3)} km`;
}

export function GraphLayerToggles({
  visibility,
  onChange,
}: {
  visibility: GraphMapLayerVisibility;
  onChange: (next: GraphMapLayerVisibility) => void;
}) {
  const items: [keyof GraphMapLayerVisibility, string][] = [
    ['showEdge', 'Tampilkan Edge'],
    ['showNode', 'Tampilkan Node'],
    ['showDeadEnd', 'Highlight Dead End'],
    ['showOneWay', 'Highlight One Way'],
    ['showShortestPath', 'Tampilkan Shortest Path'],
  ];

  return (
    <div className="flex flex-wrap gap-3">
      {items.map(([key, label]) => (
        <label key={key} className="flex items-center gap-1.5 text-xs text-gray-600">
          <input
            type="checkbox"
            checked={visibility[key]}
            onChange={() => onChange({ ...visibility, [key]: !visibility[key] })}
            className="h-3.5 w-3.5 accent-[#1a3a2e]"
          />
          {label}
        </label>
      ))}
    </div>
  );
}

export function GraphStatisticsGrid({ stats }: { stats: GraphStatistics }) {
  const rows: [string, string][] = [
    ['Total Node', String(stats.totalNode)],
    ['Total Edge', String(stats.totalEdge)],
    ['Dead End', String(stats.deadEndCount)],
    ['Connected Component', String(stats.connectedComponentCount)],
    ['Average Degree', stats.averageDegree.toFixed(2)],
    ['Max / Min Degree', `${stats.maximumDegree} / ${stats.minimumDegree}`],
    ['Graph Density', stats.graphDensity.toFixed(6)],
    ['Total Panjang Jalan', fmtKm(stats.graphLengthKm)],
    ['One Way / Two Way', `${stats.oneWayCount} / ${stats.twoWayCount}`],
    ['Vehicle Accessible', String(stats.vehicleAccessibleCount)],
    ['Orphan Node', String(stats.orphanNodeCount)],
    ['Orphan Edge', String(stats.orphanEdgeCount)],
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-xl bg-gray-50 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">{label}</p>
          <p className="text-sm font-bold text-[#1a3a2e] mt-0.5">{value}</p>
        </div>
      ))}
    </div>
  );
}

export function GraphValidationList({ report }: { report: ValidationReport }) {
  return (
    <div className="max-h-64 space-y-1 overflow-y-auto text-xs">
      {report.issues.map((issue) => (
        <div key={issue.ruleId} className="flex items-center justify-between gap-2 border-b border-gray-100 py-1.5">
          <span className="text-gray-600">{issue.ruleLabel}</span>
          <span className={`font-mono font-semibold ${SEVERITY_COLOR[issue.severity]}`}>{issue.count}</span>
        </div>
      ))}
    </div>
  );
}

export function GraphDetailPanel({
  graph,
  selection,
}: {
  graph: Graph;
  selection: { type: 'node' | 'edge'; id: number } | null;
}) {
  if (!selection) {
    return <p className="text-xs text-gray-400">Klik node atau edge pada peta untuk melihat detail.</p>;
  }

  if (selection.type === 'node') {
    const node = graph.nodes.get(selection.id);
    if (!node) return <p className="text-xs text-red-500">Node tidak ditemukan.</p>;
    const connectedEdges = [...graph.edges.values()].filter(
      (e) => e.fromNodeId === node.id || e.toNodeId === node.id,
    );
    return (
      <div className="space-y-1 text-xs">
        <Row label="Node ID" value={String(node.id)} />
        <Row label="Code" value={node.code} />
        <Row label="Nama" value={node.name ?? '-'} />
        <Row label="Coordinate" value={`${node.latLng[0].toFixed(6)}, ${node.latLng[1].toFixed(6)}`} />
        <Row label="Degree" value={String(node.degree)} />
        <Row label="Connected Edge" value={connectedEdges.map((e) => `#${e.id}`).join(', ') || '-'} />
      </div>
    );
  }

  const edge = graph.edges.get(selection.id);
  if (!edge) return <p className="text-xs text-red-500">Edge tidak ditemukan.</p>;
  return (
    <div className="space-y-1 text-xs">
      <Row label="Edge ID" value={String(edge.id)} />
      <Row label="Code" value={edge.code} />
      <Row label="Nama Jalan" value={edge.roadName ?? '-'} />
      <Row label="From → To" value={`#${edge.fromNodeId} → #${edge.toNodeId}`} />
      <Row label="Jarak" value={fmtKm(edge.distanceKm)} />
      <Row label="One Way" value={edge.oneWay ? 'Ya' : 'Tidak'} />
      <Row label="Vehicle Accessible" value={edge.vehicleAccessible ? 'Ya' : 'Tidak'} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-2 border-b border-gray-100 py-1">
      <span className="text-gray-400">{label}</span>
      <span className="text-right font-medium text-gray-700">{value}</span>
    </div>
  );
}

export function GraphPathTester({
  graph,
  pickMode,
  onPickModeChange,
  startNodeId,
  endNodeId,
  onResult,
  result,
}: {
  graph: Graph;
  pickMode: 'start' | 'end' | null;
  onPickModeChange: (mode: 'start' | 'end' | null) => void;
  startNodeId: number | null;
  endNodeId: number | null;
  onResult: (result: PathResult) => void;
  result: PathResult | null;
}) {
  const [running, setRunning] = useState(false);

  const run = () => {
    if (startNodeId === null || endNodeId === null) return;
    setRunning(true);
    // Run on next tick so the "Menghitung..." state can paint first for large graphs.
    setTimeout(() => {
      onResult(runDijkstra(graph, startNodeId, endNodeId));
      setRunning(false);
    }, 0);
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => onPickModeChange(pickMode === 'start' ? null : 'start')}
          className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium ${
            pickMode === 'start' ? 'bg-[#1a3a2e] text-white' : 'bg-gray-100 text-gray-600'
          }`}
        >
          {startNodeId !== null ? `Start: #${startNodeId}` : 'Pilih Node Awal'}
        </button>
        <button
          type="button"
          onClick={() => onPickModeChange(pickMode === 'end' ? null : 'end')}
          className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium ${
            pickMode === 'end' ? 'bg-[#1a3a2e] text-white' : 'bg-gray-100 text-gray-600'
          }`}
        >
          {endNodeId !== null ? `Akhir: #${endNodeId}` : 'Pilih Node Akhir'}
        </button>
      </div>
      <button
        type="button"
        disabled={startNodeId === null || endNodeId === null || running}
        onClick={run}
        className="w-full rounded-lg bg-[#2d6a4f] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1a3a2e] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {running ? 'Menghitung...' : 'Run Dijkstra (client-side)'}
      </button>

      {result && (
        <div className="rounded-lg bg-gray-50 p-2 text-xs">
          <Row label="Ditemukan" value={result.found ? 'Ya' : 'Tidak'} />
          <Row label="Total Jarak" value={fmtKm(result.totalDistanceKm)} />
          <Row label="Jumlah Node" value={String(result.nodePath.length)} />
          <Row label="Jumlah Edge" value={String(result.edgePath.length)} />
          <Row label="Node Dikunjungi" value={String(result.visitedNodeCount)} />
          <Row label="Waktu Eksekusi" value={`${result.executionTimeMs.toFixed(2)} ms`} />
        </div>
      )}
    </div>
  );
}

export function useGraphSelectionHelpers(graph: Graph | null) {
  return useMemo(
    () => ({
      nodeCount: graph ? graph.nodes.size : 0,
      edgeCount: graph ? graph.edges.size : 0,
    }),
    [graph],
  );
}
