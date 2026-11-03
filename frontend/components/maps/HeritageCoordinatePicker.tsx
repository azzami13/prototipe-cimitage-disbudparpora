'use client';
import { useEffect, useRef, useState } from 'react';

type CoordinatePoint = {
  lat: number;
  lng: number;
};

const DEFAULT_POINT: CoordinatePoint = { lat: -6.88, lng: 107.539 };

function formatCoordinate(value?: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '';
  return value.toFixed(14).replace(/0+$/, '').replace(/\.$/, '');
}

function parseCoordinatePair(value: string): CoordinatePoint | null {
  const match = value.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;

  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  return { lat, lng };
}

export default function HeritageCoordinatePicker({
  value,
  onChange,
}: {
  value?: { lat?: number; lng?: number };
  onChange: (point: CoordinatePoint) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const initializingRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [coordinateInput, setCoordinateInput] = useState('');
  const hasPoint = typeof value?.lat === 'number' && typeof value?.lng === 'number';

  useEffect(() => {
    if (hasPoint) {
      setCoordinateInput(`${formatCoordinate(value?.lat)}, ${formatCoordinate(value?.lng)}`);
    } else {
      setCoordinateInput('');
    }
  }, [hasPoint, value?.lat, value?.lng]);

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
      const initial = hasPoint
        ? { lat: value?.lat as number, lng: value?.lng as number }
        : DEFAULT_POINT;

      let map;
      try {
        map = L.map(container, { zoomControl: true }).setView([initial.lat, initial.lng], hasPoint ? 16 : 14);
      } catch (error: any) {
        if (!String(error?.message ?? '').includes('already initialized')) throw error;
        (container as any)._leaflet_id = undefined;
        container.replaceChildren();
        map = L.map(container, { zoomControl: true }).setView([initial.lat, initial.lng], hasPoint ? 16 : 14);
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

      const setPoint = (lat: number, lng: number, moveMap = false) => {
        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          markerRef.current = L.marker([lat, lng], { draggable: true })
            .addTo(map)
            .bindPopup('Koordinat situs');

          markerRef.current.on('dragend', (event: any) => {
            const latLng = event.target.getLatLng();
            onChange({ lat: latLng.lat, lng: latLng.lng });
          });
        }

        if (moveMap) map.setView([lat, lng], Math.max(map.getZoom(), 16));
        onChange({ lat, lng });
      };

      if (hasPoint) setPoint(value?.lat as number, value?.lng as number);

      map.on('click', (event: any) => {
        setPoint(event.latlng.lat, event.latlng.lng);
      });

      mapRef.current = map;
      initializingRef.current = false;
      setReady(true);
      setTimeout(() => map.invalidateSize(), 100);
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

  useEffect(() => {
    if (!mapRef.current || !leafletRef.current) return;
    if (!hasPoint) return;

    if (markerRef.current) {
      markerRef.current.setLatLng([value?.lat, value?.lng]);
    } else {
      markerRef.current = leafletRef.current.marker([value?.lat, value?.lng], { draggable: true })
        .addTo(mapRef.current)
        .bindPopup('Koordinat situs');

      markerRef.current.on('dragend', (event: any) => {
        const latLng = event.target.getLatLng();
        onChange({ lat: latLng.lat, lng: latLng.lng });
      });
    }
  }, [hasPoint, onChange, value?.lat, value?.lng]);

  const applyInput = () => {
    const point = parseCoordinatePair(coordinateInput);
    if (!point) {
      alert('Format koordinat tidak valid. Contoh: -6.883872702635198, 107.53547369281722');
      return;
    }

    onChange(point);
    if (mapRef.current) {
      mapRef.current.setView([point.lat, point.lng], Math.max(mapRef.current.getZoom(), 16));
    }
  };

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={coordinateInput}
        onChange={e => setCoordinateInput(e.target.value)}
        onBlur={applyInput}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            applyInput();
          }
        }}
        className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
        placeholder="-6.883872702635198, 107.53547369281722"
      />
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-3 py-2 border-b">
          <span className="text-xs text-gray-500">
            {ready ? 'Klik peta atau geser marker untuk menentukan koordinat' : 'Memuat peta...'}
          </span>
        </div>
        <div ref={containerRef} className="h-72 w-full" />
      </div>
    </div>
  );
}
