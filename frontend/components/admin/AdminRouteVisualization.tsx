'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  api,
  OptimizeRouteV2Result,
  PackageRoute,
} from '@/lib/api';

type PickupPoint = {
  latitude: number;
  longitude: number;
  name: string;
};

function formatKm(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '-';
  return `${Number(value).toFixed(2)} km`;
}

export default function AdminRouteVisualization({
  routes,
  packageName,
}: {
  routes: PackageRoute[];
  packageName?: string;
}) {
  const [pickup, setPickup] = useState<PickupPoint | null>(null);
  const [fixedEndId, setFixedEndId] = useState<number | ''>('');
  const [result, setResult] = useState<OptimizeRouteV2Result | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const orderedRoutes = useMemo(
    () => routes.slice().sort((a, b) => a.sequence - b.sequence),
    [routes],
  );
  const destinationIds = orderedRoutes.map((route) => route.heritage_site_id);
  const handlePickupChange = useCallback((point: PickupPoint) => {
    setPickup(point);
    setResult(null);
    setError('');
  }, []);

  useEffect(() => {
    setResult(null);
    setError('');
    setFixedEndId('');
  }, [routes]);

  const preview = async () => {
    if (!pickup) {
      setError('Pilih titik jemput di peta terlebih dahulu.');
      return;
    }
    if (destinationIds.length < 1) {
      setError('Tambahkan destinasi paket terlebih dahulu.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const data = await api.routing.optimizeV2({
        pickup: {
          latitude: pickup.latitude,
          longitude: pickup.longitude,
        },
        destinationIds,
        fixedEndId: fixedEndId === '' ? undefined : Number(fixedEndId),
      });
      setResult(data);
    } catch (err: any) {
      setResult(null);
      setError(err.message ?? 'Gagal memuat visualisasi rute.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-6 bg-white rounded-2xl shadow overflow-hidden">
      <div className="px-5 py-4 border-b flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="font-bold text-[#1a3a2e]">Visualisasi Rute Optimal</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {packageName ?? 'Paket wisata'} · {destinationIds.length} destinasi
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={fixedEndId}
            onChange={(event) => setFixedEndId(event.target.value ? Number(event.target.value) : '')}
            className="border rounded-lg px-3 py-2 text-sm bg-white min-w-56"
          >
            <option value="">Destinasi akhir bebas</option>
            {orderedRoutes.map((route) => (
              <option key={route.heritage_site_id} value={route.heritage_site_id}>
                Akhiri di {route.heritage_site?.name ?? `#${route.heritage_site_id}`}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={preview}
            disabled={loading}
            className="bg-[#1a3a2e] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#2d6a4f] disabled:opacity-50"
          >
            {loading ? 'Menghitung...' : 'Preview Rute'}
          </button>
        </div>
      </div>

      {error && (
        <div className="mx-5 mt-4 bg-red-50 border border-red-200 text-red-700 rounded-lg px-3 py-2 text-sm">
          {error}
        </div>
      )}

      <div className="grid xl:grid-cols-5 gap-0">
        <div className="xl:col-span-3 border-r">
          <AdminRouteMap
            pickup={pickup}
            onPickupChange={handlePickupChange}
            result={result}
          />
        </div>

        <div className="xl:col-span-2 p-5 max-h-[720px] overflow-y-auto">
          {!result ? (
            <div className="text-sm text-gray-500">
              Klik peta untuk memilih titik jemput, lalu jalankan preview.
            </div>
          ) : (
            <RoutePanel result={result} />
          )}
        </div>
      </div>
    </div>
  );
}

function AdminRouteMap({
  pickup,
  onPickupChange,
  result,
}: {
  pickup: PickupPoint | null;
  onPickupChange: (point: PickupPoint) => void;
  result: OptimizeRouteV2Result | null;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const layersRef = useRef<any[]>([]);
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

      leafletRef.current = L;
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });
      mapRef.current = L.map(containerRef.current).setView([-6.88, 107.539], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(mapRef.current);

      mapRef.current.on('click', (event: any) => {
        onPickupChange({
          latitude: event.latlng.lat,
          longitude: event.latlng.lng,
          name: 'Titik Jemput',
        });
      });
      setReady(true);
    };

    init();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        layersRef.current = [];
        setReady(false);
      }
    };
  }, [onPickupChange]);

  useEffect(() => {
    if (!ready || !mapRef.current || !leafletRef.current) return;
    const L = leafletRef.current;

    layersRef.current.forEach((layer) => layer.remove());
    layersRef.current = [];

    const bounds = L.latLngBounds([]);

    if (result?.geojson) {
      const main = L.geoJSON(result.geojson, {
        style: (feature: any) => ({
          color: feature?.properties?.source === 'OSRM_ALTERNATIVE' ? '#2563eb' : '#15803d',
          weight: feature?.properties?.source === 'OSRM_ALTERNATIVE' ? 3 : 5,
          opacity: feature?.properties?.source === 'OSRM_ALTERNATIVE' ? 0.65 : 0.95,
          dashArray: feature?.properties?.source === 'OSRM_ALTERNATIVE' ? '8 8' : undefined,
        }),
      }).addTo(mapRef.current);
      layersRef.current.push(main);
      const routeBounds = main.getBounds();
      if (routeBounds.isValid()) bounds.extend(routeBounds);
    }

    if (pickup) {
      const marker = L.marker([pickup.latitude, pickup.longitude]).addTo(mapRef.current).bindPopup('Titik Jemput');
      layersRef.current.push(marker);
      bounds.extend([pickup.latitude, pickup.longitude]);
    }

    result?.orderedDestinations.forEach((destination, index) => {
      const marker = L.marker([Number(destination.latitude), Number(destination.longitude)], {
        icon: L.divIcon({
          className: '',
          html: `<div style="width:30px;height:30px;border-radius:999px;background:#1a3a2e;color:white;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,.25);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;">${index + 1}</div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        }),
      }).addTo(mapRef.current);
      marker.bindPopup(destination.name);
      layersRef.current.push(marker);
      bounds.extend([Number(destination.latitude), Number(destination.longitude)]);
    });

    if (bounds.isValid()) {
      mapRef.current.fitBounds(bounds, { padding: [28, 28] });
    }
  }, [pickup, ready, result]);

  return (
    <div>
      <div className="px-4 py-2 bg-gray-50 border-b flex items-center justify-between text-xs text-gray-500">
        <span>{ready ? 'Klik peta untuk memilih titik jemput' : 'Memuat map OSM...'}</span>
        <span>Rute: GeoJSON cache Dijkstra</span>
      </div>
      <div ref={containerRef} className="h-[720px] w-full" />
    </div>
  );
}

function RoutePanel({ result }: { result: OptimizeRouteV2Result }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="border rounded-lg p-3">
          <p className="text-xs text-gray-400">Total jarak</p>
          <p className="text-xl font-bold text-[#1a3a2e]">{formatKm(result.totalDistanceKm)}</p>
        </div>
        <div className="border rounded-lg p-3">
          <p className="text-xs text-gray-400">Estimasi Waktu</p>
          <p className="text-xl font-bold text-[#1a3a2e]">
            {result.totalDurationMinutes ? `${Math.round(result.totalDurationMinutes)} menit` : '-'}
          </p>
        </div>
      </div>

      <section>
        <h3 className="font-semibold text-[#1a3a2e] mb-2">Urutan Optimal</h3>
        <div className="space-y-2">
          {result.orderedDestinations.map((destination, index) => (
            <div key={destination.id} className="flex gap-3 text-sm">
              <span className="w-6 h-6 rounded-full bg-[#1a3a2e] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                {index + 1}
              </span>
              <span className="font-medium text-gray-700">{destination.name}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h3 className="font-semibold text-[#1a3a2e] mb-2">Detail Segment</h3>
        <div className="space-y-3">
          {result.segments.map((segment, index) => (
            <div key={`${segment.from.id}-${segment.to.id}-${index}`} className="border rounded-lg p-3">
              <div className="flex justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-800">{segment.from.name} → {segment.to.name}</p>
                  <p className="text-xs text-gray-400">Estimasi segmen perjalanan</p>
                </div>
                <span className="text-sm font-bold text-[#1a3a2e] whitespace-nowrap">{formatKm(segment.distanceKm)}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

