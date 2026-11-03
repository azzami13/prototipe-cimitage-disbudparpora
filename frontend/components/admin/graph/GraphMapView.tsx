'use client';

import { useEffect, useRef } from 'react';
import type { Graph, PathResult } from '@/lib/graph-core';

export interface GraphMapLayerVisibility {
  showEdge: boolean;
  showNode: boolean;
  showDeadEnd: boolean;
  showOneWay: boolean;
  showShortestPath: boolean;
}

interface GraphMapViewProps {
  graph: Graph | null;
  visibility: GraphMapLayerVisibility;
  selection: { type: 'node' | 'edge'; id: number } | null;
  onSelectNode: (id: number) => void;
  onSelectEdge: (id: number) => void;
  pathResult: PathResult | null;
  heightClass?: string;
}

export default function GraphMapView({
  graph,
  visibility,
  selection,
  onSelectNode,
  onSelectEdge,
  pathResult,
  heightClass = 'h-[560px]',
}: GraphMapViewProps) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    let disposed = false;
    (async () => {
      if (!container.current) return;
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');
      if (disposed || !container.current) return;

      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch {}
        mapRef.current = null;
      }
      if ((container.current as any)._leaflet_id) (container.current as any)._leaflet_id = undefined;
      container.current.replaceChildren();

      const map = L.map(container.current, { preferCanvas: true }).setView([-6.8894, 107.5423], 13);
      mapRef.current = map;
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      if (!graph) return;

      const bounds: [number, number][] = [];

      if (visibility.showEdge) {
        for (const edge of graph.edges.values()) {
          const fromNode = graph.nodes.get(edge.fromNodeId);
          const toNode = graph.nodes.get(edge.toNodeId);
          if (!fromNode || !toNode) continue;
          const isSelected = selection?.type === 'edge' && selection.id === edge.id;
          const isOneWay = visibility.showOneWay && edge.oneWay;
          const color = isSelected ? '#facc15' : isOneWay ? '#2563eb' : '#94a3b8';
          const line = L.polyline([fromNode.latLng, toNode.latLng], {
            color,
            weight: isSelected ? 5 : 2,
            opacity: isSelected ? 1 : 0.6,
          });
          line.on('click', () => onSelectEdge(edge.id));
          line.addTo(map);
          bounds.push(fromNode.latLng, toNode.latLng);
        }
      }

      if (visibility.showNode) {
        for (const node of graph.nodes.values()) {
          const isSelected = selection?.type === 'node' && selection.id === node.id;
          const isDeadEnd = visibility.showDeadEnd && node.degree === 1;
          const color = isSelected ? '#facc15' : isDeadEnd ? '#dc2626' : '#1a3a2e';
          const circle = L.circleMarker(node.latLng, {
            radius: isSelected ? 6 : isDeadEnd ? 4 : 3,
            color,
            fillColor: color,
            fillOpacity: 0.85,
            weight: 1,
          });
          circle.on('click', () => onSelectNode(node.id));
          circle.addTo(map);
          bounds.push(node.latLng);
        }
      }

      if (visibility.showShortestPath && pathResult?.found) {
        for (const edgeId of pathResult.edgePath) {
          const edge = graph.edges.get(edgeId);
          if (!edge) continue;
          const fromNode = graph.nodes.get(edge.fromNodeId);
          const toNode = graph.nodes.get(edge.toNodeId);
          if (!fromNode || !toNode) continue;
          L.polyline([fromNode.latLng, toNode.latLng], { color: '#16a34a', weight: 6, opacity: 1 }).addTo(map);
        }
        for (const nodeId of pathResult.nodePath) {
          const node = graph.nodes.get(nodeId);
          if (!node) continue;
          L.circleMarker(node.latLng, {
            radius: 5,
            color: '#16a34a',
            fillColor: '#22c55e',
            fillOpacity: 1,
            weight: 1,
          }).addTo(map);
        }
      }

      if (bounds.length > 1) map.fitBounds(bounds, { padding: [24, 24] });
    })();

    return () => {
      disposed = true;
      if (mapRef.current) {
        try {
          mapRef.current.remove();
        } catch {}
        mapRef.current = null;
      }
      if (container.current) {
        (container.current as any)._leaflet_id = undefined;
        container.current.replaceChildren();
      }
    };
  }, [graph, visibility, selection, pathResult, onSelectNode, onSelectEdge]);

  return <div ref={container} className={`${heightClass} w-full rounded-2xl bg-slate-100`} />;
}
