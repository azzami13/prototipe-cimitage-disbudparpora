'use client';

import { useEffect, useRef, useState } from 'react';

type RoutePoint = {
  id: number | string;
  name: string;
  latitude: number;
  longitude: number;
};

export default function RoutePreviewMap({
  geojson,
  points,
}: {
  geojson?: any;
  points: RoutePoint[];
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const layerRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const leafletRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      if (!containerRef.current || mapRef.current) return;
      const L = (await import('leaflet')).default;
      if (cancelled || !containerRef.current) return;

      if ((containerRef.current as any)._leaflet_id) {
        (containerRef.current as any)._leaflet_id = undefined;
        containerRef.current.replaceChildren();
      }

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      leafletRef.current = L;
      mapRef.current = L.map(containerRef.current, { zoomControl: true }).setView(
        [-6.88, 107.539],
        13,
      );
      L.tileLayer(
        'https://mt0.google.com/vt?lyrs=h@159000000,traffic|seconds_into_week:-1&style=3&x={x}&y={y}&z={z}',
        {
          attribution: '&copy; Google Maps',
          maxZoom: 20,
          subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        },
      ).addTo(mapRef.current);
      setReady(true);
    };

    init();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layerRef.current = null;
        markersRef.current = [];
        setReady(false);
      }
    };
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current || !leafletRef.current) return;

    const L = leafletRef.current;
    if (layerRef.current) {
      layerRef.current.remove();
      layerRef.current = null;
    }
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    if (geojson) {
      layerRef.current = L.geoJSON(geojson, {
        style: (feature: any) => ({
          color: feature?.properties?.source === 'OSRM_ALTERNATIVE' ? '#f59e0b' : '#1a3a2e',
          weight: feature?.properties?.source === 'OSRM_ALTERNATIVE' ? 3 : 5,
          opacity: feature?.properties?.source === 'OSRM_ALTERNATIVE' ? 0.45 : 0.9,
        }),
      }).addTo(mapRef.current);
    }

    points.forEach((point, index) => {
      if (!Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) return;
      const marker = L.marker([point.latitude, point.longitude])
        .addTo(mapRef.current)
        .bindPopup(`${index === 0 ? 'Start' : index}. ${point.name}`);
      markersRef.current.push(marker);
    });

    const bounds = L.latLngBounds([]);
    if (layerRef.current) {
      const routeBounds = layerRef.current.getBounds();
      if (routeBounds.isValid()) bounds.extend(routeBounds);
    }
    points.forEach((point) => bounds.extend([point.latitude, point.longitude]));

    if (bounds.isValid()) {
      mapRef.current.fitBounds(bounds, { padding: [24, 24] });
    }
  }, [geojson, points, ready]);

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="bg-gray-50 border-b px-3 py-2 text-xs text-gray-500">
        {ready ? 'Preview rute optimal' : 'Memuat peta rute...'}
      </div>
      <div ref={containerRef} className="h-80 w-full" />
    </div>
  );
}
