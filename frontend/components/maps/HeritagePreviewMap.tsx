'use client';

import { useEffect, useRef } from 'react';

type HeritagePoint = {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
};

export default function HeritagePreviewMap({
  sites,
}: {
  sites: HeritagePoint[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    let mounted = true;

    const init = async () => {
      if (!containerRef.current || mapRef.current) return;

      const L = (await import('leaflet')).default;

      if (!mounted) return;

      mapRef.current = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: false,
      });

      L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
      ).addTo(mapRef.current);

      const bounds = L.latLngBounds([]);

      sites.forEach((site) => {
        const marker = L.marker([
          site.latitude,
          site.longitude,
        ]).addTo(mapRef.current);

        marker.bindPopup(site.name);

        bounds.extend([
          site.latitude,
          site.longitude,
        ]);
      });

      if (bounds.isValid()) {
        mapRef.current.fitBounds(bounds, {
          padding: [40, 40],
        });
      }
    };

    init();

    return () => {
      mounted = false;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [sites]);

  return (
    <div
      ref={containerRef}
      className="h-[420px] w-full"
    />
  );
}