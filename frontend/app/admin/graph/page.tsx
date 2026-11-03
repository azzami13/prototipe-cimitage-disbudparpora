'use client';

import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  api,
  DestinationDistance,
  GraphDestinationMatrix,
  GraphRebuildSummary,
} from '@/lib/api';
import { useAdminRoadGraph } from '@/hooks/admin/useAdminRoadGraph';
import type { PathResult } from '@/lib/graph-core';
import type { GraphMapLayerVisibility } from '@/components/admin/graph/GraphMapView';
import {
  GraphLayerToggles,
  GraphStatisticsGrid,
  GraphValidationList,
  GraphDetailPanel,
  GraphPathTester,
} from '@/components/admin/graph/GraphInspectorPanels';

const GraphMapView = dynamic(() => import('@/components/admin/graph/GraphMapView'), {
  ssr: false,
  loading: () => <div className="h-[560px] w-full rounded-2xl bg-gray-100 animate-pulse" />,
});

const DEFAULT_LAYER_VISIBILITY: GraphMapLayerVisibility = {
  showEdge: true,
  showNode: true,
  showDeadEnd: true,
  showOneWay: true,
  showShortestPath: true,
};

function fmtKm(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return '-';
  }

  return `${Number(value).toFixed(2)} km`;
}

export default function AdminGraphPage() {
  const [matrix, setMatrix] = useState<GraphDestinationMatrix | null>(null);
  const [distances, setDistances] = useState<DestinationDistance[]>([]);
  const [summary, setSummary] = useState<GraphRebuildSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [error, setError] = useState('');

  // Peta & Validasi Graph Jalan (Graph Inspector)
  const roadGraph = useAdminRoadGraph();
  const [layerVisibility, setLayerVisibility] = useState<GraphMapLayerVisibility>(DEFAULT_LAYER_VISIBILITY);
  const [selection, setSelection] = useState<{ type: 'node' | 'edge'; id: number } | null>(null);
  const [pickMode, setPickMode] = useState<'start' | 'end' | null>(null);
  const [startNodeId, setStartNodeId] = useState<number | null>(null);
  const [endNodeId, setEndNodeId] = useState<number | null>(null);
  const [pathResult, setPathResult] = useState<PathResult | null>(null);

  const handleSelectNode = (id: number) => {
    if (pickMode === 'start') {
      setStartNodeId(id);
      setPickMode(null);
      return;
    }
    if (pickMode === 'end') {
      setEndNodeId(id);
      setPickMode(null);
      return;
    }
    setSelection({ type: 'node', id });
  };

  const handleSelectEdge = (id: number) => setSelection({ type: 'edge', id });

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [matrixData, distanceData] = await Promise.all([
        api.graph.destinationMatrix(),
        api.graph.destinationDistances(),
      ]);
      setMatrix(matrixData);
      setDistances(distanceData);
    } catch (err: any) {
      setError(err.message ?? 'Gagal memuat data graph');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleRebuild = async () => {
    if (!confirm('Rebuild graph destinasi dan cost matrix sekarang?')) return;

    setRebuilding(true);
    setError('');
    try {
      const result = await api.graph.rebuild();
      setSummary(result);
      await load();
    } catch (err: any) {
      setError(err.message ?? 'Gagal rebuild graph destinasi');
    } finally {
      setRebuilding(false);
    }
  };

  const cards = useMemo(() => {
    const totalPairs = summary
      ? summary.destinationDistances + summary.unreachablePairs
      : distances.length;
    const failed = summary?.unreachablePairs ?? 0;

    return [
      {
        label: 'Total Destinasi',
        value: summary?.heritageSites ?? matrix?.destinations.length ?? 0,
      },
      {
        label: 'Total Pasangan',
        value: totalPairs,
      },
      {
        label: 'Berhasil',
        value: summary?.destinationDistances ?? distances.length,
      },
      {
        label: 'Gagal',
        value: failed,
      },
    ];
  }, [summary, matrix, distances]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <a
            href="/admin"
            className="text-sm text-gray-500 hover:text-[#1a3a2e] mb-1 block"
          >
            ← Admin Dashboard
          </a>
          <h1 className="text-2xl font-bold text-[#1a3a2e]">
            🧭 Graph & Routing
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Kelola graph destinasi, cost matrix Dijkstra, dan data jarak antar situs.
          </p>
        </div>

        <button
          onClick={handleRebuild}
          disabled={rebuilding}
          className="bg-[#1a3a2e] text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#2d6a4f] disabled:opacity-50 transition"
        >
          {rebuilding ? 'Memproses...' : 'Rebuild Graph Destinasi'}
        </button>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {summary && (
        <div className="mb-6 bg-green-50 border border-green-200 text-green-800 rounded-xl px-4 py-3 text-sm">
          {summary.message} · metode {summary.calculationMethod}
        </div>
      )}

      <div className="grid md:grid-cols-4 gap-4 mb-6">
        {cards.map((card) => (
          <div key={card.label} className="bg-white rounded-2xl shadow p-5">
            <p className="text-xs uppercase tracking-wide text-gray-400 font-semibold">
              {card.label}
            </p>
            <p className="text-3xl font-bold text-[#1a3a2e] mt-2">
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid xl:grid-cols-5 gap-6">
        <section className="xl:col-span-3 bg-white rounded-2xl shadow overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <div>
              <h2 className="font-bold text-[#1a3a2e]">Cost Matrix</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Jarak antar destinasi hasil perhitungan Dijkstra
              </p>
            </div>
            <span className="text-xs text-gray-400">
              {matrix?.destinations.length ?? 0} destinasi
            </span>
          </div>

          <div className="overflow-auto max-h-[620px]">
            {loading ? (
              <div className="p-5 space-y-3">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="h-8 bg-gray-100 rounded animate-pulse" />
                ))}
              </div>
            ) : !matrix || matrix.destinations.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                Belum ada cost matrix. Jalankan rebuild graph terlebih dahulu.
              </div>
            ) : (
              <table className="w-full text-xs whitespace-nowrap">
                <thead className="bg-gray-50 border-b sticky top-0 z-10">
                  <tr>
                    <th className="text-left px-3 py-3 font-semibold text-gray-600 sticky left-0 bg-gray-50">
                      Dari / Ke
                    </th>
                    {matrix.destinations.map((destination) => (
                      <th
                        key={destination.id}
                        className="px-3 py-3 font-semibold text-gray-600 text-center"
                        title={destination.name}
                      >
                        #{destination.id}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {matrix.destinations.map((from, rowIndex) => (
                    <tr key={from.id} className="hover:bg-gray-50">
                      <td
                        className="px-3 py-2 font-medium text-gray-700 sticky left-0 bg-white max-w-[220px] truncate"
                        title={from.name}
                      >
                        #{from.id} {from.name}
                      </td>
                      {matrix.matrix[rowIndex]?.map((value, colIndex) => (
                        <td
                          key={`${from.id}-${matrix.destinations[colIndex]?.id}`}
                          className={`px-3 py-2 text-center ${
                            rowIndex === colIndex
                              ? 'text-gray-300'
                              : value === null
                                ? 'text-red-400'
                                : 'text-gray-700'
                          }`}
                        >
                          {rowIndex === colIndex ? '0' : fmtKm(value)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section className="xl:col-span-2 bg-white rounded-2xl shadow overflow-hidden">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <div>
              <h2 className="font-bold text-[#1a3a2e]">Destination Distances</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Detail pasangan destinasi yang tersimpan
              </p>
            </div>
            <span className="text-xs text-gray-400">{distances.length} baris</span>
          </div>

          <div className="overflow-auto max-h-[620px]">
            {loading ? (
              <div className="p-5 space-y-3">
                {Array.from({ length: 8 }).map((_, index) => (
                  <div key={index} className="h-12 bg-gray-100 rounded animate-pulse" />
                ))}
              </div>
            ) : distances.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                Belum ada data jarak destinasi.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600">
                      Rute
                    </th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600">
                      Jarak
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {distances.map((distance) => (
                    <tr key={distance.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-800 line-clamp-1">
                          {distance.from_heritage_site?.name ??
                            `#${distance.from_heritage_site_id}`}
                        </p>
                        <p className="text-xs text-gray-400 line-clamp-1">
                          →{' '}
                          {distance.to_heritage_site?.name ??
                            `#${distance.to_heritage_site_id}`}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          {distance.path_node_ids?.length ?? 0} node ·{' '}
                          {distance.calculation_method ?? '-'}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-[#1a3a2e]">
                        {fmtKm(Number(distance.distance_km))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>

      <div className="mt-8 bg-white rounded-2xl shadow overflow-hidden">
        <div className="px-5 py-4 border-b flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-bold text-[#1a3a2e]">🗺️ Peta &amp; Validasi Graph Jalan</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Visualisasi road_nodes &amp; road_edges, validasi topologi, dan uji Dijkstra client-side.
            </p>
          </div>
          <button
            onClick={roadGraph.load}
            disabled={roadGraph.status === 'loading'}
            className="bg-[#2d6a4f] text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-[#1a3a2e] disabled:opacity-50 transition"
          >
            {roadGraph.status === 'loading' ? 'Memuat graph...' : 'Load / Refresh Graph'}
          </button>
        </div>

        {roadGraph.status === 'error' && (
          <div className="mx-5 mt-4 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
            {roadGraph.error}
          </div>
        )}

        {roadGraph.status === 'idle' && (
          <div className="p-12 text-center text-gray-400 text-sm">
            Klik &quot;Load / Refresh Graph&quot; untuk memuat seluruh road_nodes dan road_edges dari database.
          </div>
        )}

        {roadGraph.bundle && (
          <div className="p-5 space-y-5">
            <GraphLayerToggles visibility={layerVisibility} onChange={setLayerVisibility} />

            <div className="grid xl:grid-cols-5 gap-5">
              <div className="xl:col-span-3">
                <GraphMapView
                  graph={roadGraph.bundle.graph}
                  visibility={layerVisibility}
                  selection={selection}
                  onSelectNode={handleSelectNode}
                  onSelectEdge={handleSelectEdge}
                  pathResult={pathResult}
                />
              </div>

              <div className="xl:col-span-2 space-y-5">
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                    Graph Statistics
                  </h3>
                  <GraphStatisticsGrid stats={roadGraph.bundle.statistics} />
                </div>

                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                    Path Tester
                  </h3>
                  <GraphPathTester
                    graph={roadGraph.bundle.graph}
                    pickMode={pickMode}
                    onPickModeChange={setPickMode}
                    startNodeId={startNodeId}
                    endNodeId={endNodeId}
                    onResult={setPathResult}
                    result={pathResult}
                  />
                </div>

                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                    Detail Terpilih
                  </h3>
                  <GraphDetailPanel graph={roadGraph.bundle.graph} selection={selection} />
                </div>

                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                    Validasi ({roadGraph.bundle.report.totalErrors} error,{' '}
                    {roadGraph.bundle.report.totalWarnings} warning)
                  </h3>
                  <GraphValidationList report={roadGraph.bundle.report} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
