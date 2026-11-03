'use client';
import { useEffect, useRef, useState } from 'react';

type PickupPoint = {
  lat: number;
  lng: number;
  mapsUrl: string;
};

export default function PickupMapPicker({
  value,
  onChange,
}: {
  value?: { lat?: number | string | null; lng?: number | string | null };
  onChange: (point: PickupPoint) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const initializingRef = useRef(false);
  const [ready, setReady] = useState(false);

  const normalizeCoordinate = (value?: number | string | null) => {
    const coordinate = Number(value);
    return Number.isFinite(coordinate) ? coordinate : undefined;
  };

  const formatMapsUrl = (lat: number, lng: number) =>
    `https://www.google.com/maps?q=${lat.toFixed(7)},${lng.toFixed(7)}`;

  useEffect(() => {
    let cancelled = false;

    if (!containerRef.current || mapRef.current || initializingRef.current) return;
    initializingRef.current = true;

    const init = async () => {
      const container = containerRef.current;
      if (!container) return;
      const L = (await import('leaflet')).default;
      if (cancelled || mapRef.current) return;

      if ((container as any)._leaflet_id) {
        (container as any)._leaflet_id = undefined;
        container.replaceChildren();
      }

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      leafletRef.current = L;
      const initialLat = normalizeCoordinate(value?.lat);
      const initialLng = normalizeCoordinate(value?.lng);
      const initial = {
        lat: initialLat ?? -6.88,
        lng: initialLng ?? 107.539,
      };
      let map;
      try {
        map = L.map(container, { zoomControl: true }).setView([initial.lat, initial.lng], 14);
      } catch (error: any) {
        if (!String(error?.message ?? '').includes('already initialized')) throw error;
        (container as any)._leaflet_id = undefined;
        container.replaceChildren();
        map = L.map(container, { zoomControl: true }).setView([initial.lat, initial.lng], 14);
      }
      if (cancelled) {
        map.remove();
        return;
      }
      L.tileLayer(
        'https://mt0.google.com/vt?lyrs=h@159000000,traffic|seconds_into_week:-1&style=3&x={x}&y={y}&z={z}',
        {
          attribution: '&copy; Google Maps',
          maxZoom: 20,
          subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        },
      ).addTo(map);

      const setPoint = (rawLat: number | string, rawLng: number | string) => {
        const lat = normalizeCoordinate(rawLat);
        const lng = normalizeCoordinate(rawLng);
        if (lat === undefined || lng === undefined) return;
        if (markerRef.current) markerRef.current.remove();
        markerRef.current = L.marker([lat, lng]).addTo(map).bindPopup('Titik jemput').openPopup();
        onChange({
          lat,
          lng,
          mapsUrl: formatMapsUrl(lat, lng),
        });
      };

      if (initialLat !== undefined && initialLng !== undefined) setPoint(initialLat, initialLng);

      map.on('click', (event: any) => {
        setPoint(event.latlng.lat, event.latlng.lng);
      });

      mapRef.current = map;
      initializingRef.current = false;
      setReady(true);
    };

    init();

    return () => {
      cancelled = true;
      initializingRef.current = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
        setReady(false);
      }
    };
  }, []);

  const useCurrentLocation = () => {
    if (!navigator.geolocation || !mapRef.current || !leafletRef.current) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        mapRef.current.setView([lat, lng], 16);
        if (markerRef.current) markerRef.current.remove();
        markerRef.current = leafletRef.current.marker([lat, lng]).addTo(mapRef.current).bindPopup('Titik jemput').openPopup();
        onChange({
          lat,
          lng,
          mapsUrl: formatMapsUrl(lat, lng),
        });
      },
      () => alert('Tidak dapat mengakses lokasi. Pastikan izin lokasi aktif.'),
    );
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between bg-gray-50 px-3 py-2 border-b">
        <span className="text-xs text-gray-500">{ready ? 'Klik peta untuk memilih titik jemput' : 'Memuat peta...'}</span>
        <button type="button" onClick={useCurrentLocation}
          className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-1 rounded">
          Gunakan Lokasi Saya
        </button>
      </div>
      <div ref={containerRef} className="h-72 w-full" />
    </div>
  );
}
