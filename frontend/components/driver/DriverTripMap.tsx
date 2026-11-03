'use client';

import { useEffect, useMemo, useRef } from 'react';
import { api, type DriverTrip, type PlaybackGraph, type TripRoutePlayback } from '@/lib/api';
import { backendAssetUrl } from '@/lib/runtime-config';

export default function DriverTripMap({
  trip,
  currentPosition,
  heightClass = 'h-[330px]',
}: {
  trip: DriverTrip;
  currentPosition?: { latitude: number; longitude: number } | null;
  heightClass?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const vehicleMarkerRef = useRef<any>(null);

  // Signature of everything that should trigger a full map/route rebuild. Deliberately
  // excludes `currentPosition` — the vehicle's live GPS position is handled by a separate,
  // lightweight effect below that only moves a marker, instead of tearing down and rebuilding
  // the entire map (including re-fetching the route from the backend) on every position tick.
  const tripStructureSignature = useMemo(() => {
    const itinerary = [...(trip.itinerary_items ?? [])]
      .sort((a, b) => a.sequence - b.sequence)
      .map((item) => `${item.id}:${item.stop_status}`)
      .join(',');
    return `${trip.id}|${trip.current_itinerary_item_id}|${trip.trip_status}|${trip.sakoci?.image_url ?? ''}|${itinerary}`;
  }, [trip.id, trip.current_itinerary_item_id, trip.trip_status, trip.sakoci?.image_url, trip.itinerary_items]);

  useEffect(() => {
    let disposed = false;
    (async () => {
      if (!container.current) return;
      const L = (await import('leaflet')).default;
      if (disposed || !container.current) return;
      leafletRef.current = L;
      if (mapRef.current) {
        try {
          mapRef.current.stop?.();
          mapRef.current.off?.();
          mapRef.current.remove?.();
        } catch {}
        mapRef.current = null;
      }
      vehicleMarkerRef.current = null;
      if ((container.current as any)._leaflet_id) (container.current as any)._leaflet_id = undefined;
      container.current.replaceChildren();
      const itinerary = [...(trip.itinerary_items ?? [])].sort((a, b) => a.sequence - b.sequence);
      const points = itinerary
        .filter((item) => Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude)));
      const fallback = points[0]
        ? [Number(points[0].latitude), Number(points[0].longitude)]
        : [-6.872, 107.542];
      const map = L.map(container.current, {
        zoomControl: false,
        scrollWheelZoom: false,
        touchZoom: false,
        doubleClickZoom: false,
        zoomAnimation: false,
        fadeAnimation: false,
        markerZoomAnimation: false,
      }).setView(fallback as [number, number], 14, { animate: false });
      mapRef.current = map;
      L.control.zoom({ position: 'topright' }).addTo(map);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
      }).addTo(map);

      const bounds: [number, number][] = [];
      points.forEach((item) => {
        const lat = Number(item.latitude);
        const lng = Number(item.longitude);
        bounds.push([lat, lng]);
        const active = item.id === trip.current_itinerary_item_id;
        const completed = ['COMPLETED', 'SKIPPED'].includes(item.stop_status);
        const label = item.stop_type === 'DESTINATION' ? String(item.sequence) : item.stop_type === 'PICKUP' ? 'P' : 'A';
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:34px;height:34px;border-radius:50%;display:grid;place-items:center;font-weight:800;color:white;background:${active ? '#f59e0b' : completed ? '#16a34a' : '#1a3a2e'};border:3px solid white;box-shadow:0 5px 14px rgba(15,23,42,.28)">${label}</div>`,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        });
        L.marker([lat, lng], { icon }).addTo(map).bindPopup(`<strong>${item.name}</strong><br>${item.address ?? ''}`);
      });

      // Route geometry doesn't change while the trip's itinerary/status is unchanged, so this
      // is fetched once per tripStructureSignature — not on every GPS position tick.
      const playback = await loadPlaybackRoute(trip.id);
      if (disposed) return;
      const playbackGeojson = playbackGeometry(playback);
      const activeRoute = resolveActiveRoute(trip);
      const segments = playbackGeojson
        ? [{ geojson: playbackGeojson }]
        : Array.isArray(trip.route_snapshot?.segments) ? trip.route_snapshot?.segments ?? [] : [];
      const segmentLayers: any[] = [];
      segments.forEach((segment, index) => {
        const geojson = playbackGeojson ?? segmentGeojson(segment);
        if (!geojson) return;
        const role = playbackGeojson ? 'upcoming' : routeSegmentRole(segment, index, activeRoute);
        try {
          const layer = L.geoJSON(geojson, {
            style: routeStyle(role),
          }).addTo(map);
          segmentLayers.push(layer);
          const layerBounds = layer.getBounds?.();
          if (layerBounds?.isValid?.()) {
            layerBounds.getNorthEast && bounds.push([layerBounds.getNorthEast().lat, layerBounds.getNorthEast().lng]);
            layerBounds.getSouthWest && bounds.push([layerBounds.getSouthWest().lat, layerBounds.getSouthWest().lng]);
          }
        } catch {}
      });

      const fullGeojson = playbackGeojson ?? routeSnapshotGeojson(trip.route_snapshot);
      if (!segmentLayers.length && fullGeojson) {
        try {
          const layer = L.geoJSON(fullGeojson, { style: { color: '#16a34a', weight: 7, opacity: 0.95 } }).addTo(map);
          const layerBounds = layer.getBounds?.();
          if (layerBounds?.isValid?.()) {
            layerBounds.getNorthEast && bounds.push([layerBounds.getNorthEast().lat, layerBounds.getNorthEast().lng]);
            layerBounds.getSouthWest && bounds.push([layerBounds.getSouthWest().lat, layerBounds.getSouthWest().lng]);
          }
        } catch {}
      }

      drawPlaybackNodes(L, map, playback?.graph?.nodes ?? []);

      // Radius overlay around the vehicle: drawn once using whatever position is available at
      // build time. It intentionally does not re-fetch on every GPS tick (see the dedicated
      // vehicle-marker effect below) — it will refresh next time the trip structure changes.
      const radiusGraph = currentPosition
        ? await api.graph.radius(currentPosition.latitude, currentPosition.longitude, 2000).catch(() => null)
        : null;
      if (disposed) return;
      if (radiusGraph?.enabled) {
        drawGraphRadius(L, map, radiusGraph);
      }

      if (currentPosition) {
        bounds.push([currentPosition.latitude, currentPosition.longitude]);
        vehicleMarkerRef.current = L.marker([currentPosition.latitude, currentPosition.longitude], {
          icon: vehicleIcon(L, trip.sakoci?.image_url),
        }).addTo(map).bindPopup('Posisi Sakoci saat ini');
      }

      if (bounds.length > 1) map.fitBounds(bounds, { padding: [28, 28], animate: false });
    })();
    return () => {
      disposed = true;
      const map = mapRef.current;
      if (map) {
        try {
          map.scrollWheelZoom?.disable?.();
          map.touchZoom?.disable?.();
          map.doubleClickZoom?.disable?.();
          map.stop?.();
          map.off?.();
          map.remove?.();
        } catch {}
      }
      mapRef.current = null;
      vehicleMarkerRef.current = null;
      if (container.current) {
        (container.current as any)._leaflet_id = undefined;
        container.current.replaceChildren();
      }
    };
  }, [tripStructureSignature]);

  // Vehicle marker position — updates in place on every GPS tick, without touching the map,
  // route layers, or itinerary markers built above. This is what actually needs to "menyesuaikan
  // dengan lokasi saat ini sakocinya" on every position update.
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map || !currentPosition) return;

    const nextLatLng = L.latLng(currentPosition.latitude, currentPosition.longitude);
    const icon = vehicleIcon(L, trip.sakoci?.image_url);

    if (!vehicleMarkerRef.current) {
      vehicleMarkerRef.current = L.marker(nextLatLng, { icon })
        .addTo(map)
        .bindPopup('Posisi Sakoci saat ini');
      return;
    }

    vehicleMarkerRef.current.setIcon(icon);
    vehicleMarkerRef.current.setLatLng(nextLatLng);
  }, [currentPosition?.latitude, currentPosition?.longitude, trip.sakoci?.image_url]);

  return <div ref={container} className={`${heightClass} w-full rounded-3xl bg-slate-200`} />;
}

function vehicleIcon(L: any, imageUrl?: string | null) {
  const resolvedImageUrl = backendAssetUrl(imageUrl ?? '');
  return L.divIcon({
    className: '',
    html: resolvedImageUrl
      ? `<div style="width:44px;height:44px;border-radius:9999px;overflow:hidden;background:#0ea5e9;border:3px solid white;box-shadow:0 5px 16px rgba(14,165,233,.4)"><img src="${resolvedImageUrl}" alt="" style="width:100%;height:100%;object-fit:cover;display:block" /></div>`
      : '<div style="width:38px;height:38px;border-radius:50%;display:grid;place-items:center;background:#0ea5e9;border:3px solid white;box-shadow:0 5px 16px rgba(14,165,233,.4);font-size:18px;color:white;font-weight:800">S</div>',
    iconSize: resolvedImageUrl ? [44, 44] : [38, 38],
    iconAnchor: resolvedImageUrl ? [22, 22] : [19, 19],
  });
}

type RouteRole = 'completed' | 'active' | 'upcoming';

function resolveActiveRoute(trip: DriverTrip) {
  const itinerary = [...(trip.itinerary_items ?? [])].sort((a, b) => a.sequence - b.sequence);
  const currentIndex = itinerary.findIndex((item) => item.id === trip.current_itinerary_item_id);
  const current = currentIndex >= 0 ? itinerary[currentIndex] : null;
  if (!current) return { activeIndex: 0, completedUntil: -1 };

  if (trip.trip_status === 'AT_DESTINATION' || trip.trip_status === 'AT_PICKUP') {
    const nextIndex = itinerary.findIndex((item, index) => index > currentIndex && !['COMPLETED', 'SKIPPED'].includes(item.stop_status));
    return {
      activeIndex: nextIndex > 0 ? nextIndex - 1 : Math.max(0, currentIndex - 1),
      completedUntil: Math.max(-1, currentIndex - 1),
    };
  }

  return {
    activeIndex: Math.max(0, currentIndex - 1),
    completedUntil: Math.max(-1, currentIndex - 2),
  };
}

function routeSegmentRole(segment: any, index: number, activeRoute: { activeIndex: number; completedUntil: number }): RouteRole {
  if (index <= activeRoute.completedUntil) return 'completed';
  if (index === activeRoute.activeIndex || segment.to?.id === 'PICKUP') return 'active';
  return 'upcoming';
}

function routeStyle(role: RouteRole) {
  if (role === 'completed') return { color: '#86efac', weight: 5, opacity: 0.55 };
  if (role === 'active') return { color: '#16a34a', weight: 8, opacity: 0.98 };
  return { color: '#22c55e', weight: 6, opacity: 0.85 };
}

function segmentGeojson(segment: any) {
  return segment?.path_geojson
    ?? segment?.pathGeojson
    ?? segment?.geojson
    ?? segment?.routeGeojson
    ?? segment?.route_geojson
    ?? null;
}

function routeSnapshotGeojson(snapshot: DriverTrip['route_snapshot']) {
  if (!snapshot) return null;
  const value = snapshot as any;
  return value.geojson ?? value.routeGeojson ?? value.route_geojson ?? null;
}

async function loadPlaybackRoute(tripId: number): Promise<{ route: TripRoutePlayback; graph: PlaybackGraph | null } | null> {
  try {
    const route = await api.tripPlayback.route(tripId);
    const graph = route.nodeIds.length || route.edgeIds.length
      ? await api.graph.playback(route.nodeIds, route.edgeIds).catch(() => null)
      : null;
    return { route, graph };
  } catch (error: any) {
    if (error?.status === 404) return null;
    return null;
  }
}

function playbackGeometry(playback: { route: TripRoutePlayback; graph: PlaybackGraph | null } | null) {
  if (!playback) return null;
  if (playback.route.geometry) return geojsonDrawable(playback.route.geometry);
  const edgeFeatures = (playback.graph?.edges ?? [])
    .map((edge) => edge.geometry)
    .filter(Boolean)
    .map((geometry) => ({
      type: 'Feature' as const,
      geometry,
      properties: {},
    }));
  return edgeFeatures.length
    ? { type: 'FeatureCollection' as const, features: edgeFeatures }
    : null;
}

function geojsonDrawable(geometry: any) {
  if (!geometry) return null;
  if (geometry.type === 'FeatureCollection' || geometry.type === 'Feature') return geometry;
  return {
    type: 'FeatureCollection' as const,
    features: [{
      type: 'Feature' as const,
      geometry,
      properties: {},
    }],
  };
}

function drawGraphRadius(L: any, map: any, graph: PlaybackGraph & { radiusMeters?: number }) {
  const edgeFeatures = (graph.edges ?? [])
    .map((edge) => edge.geometry)
    .filter(Boolean)
    .map((geometry) => ({
      type: 'Feature' as const,
      geometry,
      properties: {},
    }));

  if (edgeFeatures.length) {
    L.geoJSON({ type: 'FeatureCollection', features: edgeFeatures }, {
      style: { color: '#64748b', weight: 2, opacity: 0.24 },
      interactive: false,
    }).addTo(map);
  }

  (graph.nodes ?? []).forEach((node) => {
    if (!Number.isFinite(Number(node.latitude)) || !Number.isFinite(Number(node.longitude))) return;
    L.circleMarker([Number(node.latitude), Number(node.longitude)], {
      radius: 2.5,
      color: '#475569',
      weight: 1,
      fillColor: '#cbd5e1',
      fillOpacity: 0.45,
      opacity: 0.35,
      interactive: false,
    }).addTo(map);
  });
}

function drawPlaybackNodes(L: any, map: any, nodes: PlaybackGraph['nodes']) {
  nodes.forEach((node, index) => {
    if (!Number.isFinite(Number(node.latitude)) || !Number.isFinite(Number(node.longitude))) return;
    L.circleMarker([Number(node.latitude), Number(node.longitude)], {
      radius: index % 3 === 0 ? 4 : 3,
      color: '#ffffff',
      weight: 2,
      fillColor: '#15803d',
      fillOpacity: 0.95,
      opacity: 1,
    }).addTo(map).bindTooltip(`Node rute #${node.id}`, { direction: 'top', opacity: 0.9 });
  });
}
