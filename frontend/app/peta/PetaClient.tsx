'use client';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { api, HeritageSite, OptimizeRouteV2Result, PlaybackGraph, PublicSakoci, TripRoutePlayback } from '@/lib/api';
import { useBackendReadiness } from '@/components/providers/BackendReadinessProvider';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import { backendAssetUrl } from '@/lib/runtime-config';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const CATEGORY_COLOR: Record<string, string> = {
  BG: '#2563eb', SI: '#dc2626', BD: '#d97706', KA: '#16a34a', DEFAULT: '#6b7280',
};
const CATEGORY_LABEL: Record<string, string> = {
  BG: 'Bangunan Gedung', SI: 'Situs', BD: 'Benda Cagar Budaya', KA: 'Kawasan Adat',
};
const CATEGORY_SHORT: Record<string, string> = {
  BG: 'G', SI: 'S', BD: 'B', KA: 'K',
};
type PanelTab = 'explore' | 'route' | 'layers';

export default function PetaClient() {
  const { status: backendStatus } = useBackendReadiness();
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const leafletRef = useRef<any>(null);
  const heritageMarkersRef = useRef<any[]>([]);
  const sakociMarkersRef = useRef<Map<number, any>>(new Map());
  const routeLayerRef = useRef<any>(null);
  const alternativeLayerRef = useRef<any>(null);
  const publicRouteLayerRef = useRef<any>(null);
  const sakociGraphLayerRef = useRef<any>(null);
  const [sites, setSites] = useState<HeritageSite[]>([]);
  const [sakociList, setSakociList] = useState<PublicSakoci[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedForRoute, setSelectedForRoute] = useState<number[]>([]);
  const [routeResult, setRouteResult] = useState<OptimizeRouteV2Result | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [filterCat, setFilterCat] = useState('');
  const [userLoc, setUserLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [selectedSite, setSelectedSite] = useState<HeritageSite | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [showOptimalRoute, setShowOptimalRoute] = useState(true);
  const [showAlternatives, setShowAlternatives] = useState(true);
  const [activePanel, setActivePanel] = useState<PanelTab>('explore');
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const [search, setSearch] = useState('');

  // Init Leaflet map
  useEffect(() => {
    if (backendStatus !== 'ready') return;
    if (mapRef.current) return;
    let cancelled = false;
    const init = async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !mapElementRef.current) return;
      // Fix default icon paths broken by webpack
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: markerIcon2x.src,
        iconUrl: markerIcon.src,
        shadowUrl: markerShadow.src,
      });
      leafletRef.current = L;
      if ((mapElementRef.current as any)._leaflet_id) {
        delete (mapElementRef.current as any)._leaflet_id;
      }
      const map = L.map(mapElementRef.current, {
        zoomControl: false,
        zoomAnimation: false,
        fadeAnimation: false,
        markerZoomAnimation: false,
      }).setView([-6.8800, 107.5390], 14);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);
      L.control.zoom({ position: 'bottomright' }).addTo(map);
      mapRef.current = map;
      setMapReady(true);
    };
    init();
    return () => {
      cancelled = true;
      setMapReady(false);
      heritageMarkersRef.current.forEach(m => m.remove());
      heritageMarkersRef.current = [];
      sakociMarkersRef.current.forEach(m => m.remove());
      sakociMarkersRef.current.clear();
      if (routeLayerRef.current) routeLayerRef.current.remove();
      if (alternativeLayerRef.current) alternativeLayerRef.current.remove();
      if (publicRouteLayerRef.current) publicRouteLayerRef.current.remove();
      if (sakociGraphLayerRef.current) sakociGraphLayerRef.current.remove();
      if (mapRef.current) {
        mapRef.current.scrollWheelZoom?.disable?.();
        mapRef.current.touchZoom?.disable?.();
        mapRef.current.doubleClickZoom?.disable?.();
        mapRef.current.stop?.();
        mapRef.current.off?.();
        mapRef.current.remove();
        mapRef.current = null;
      }
      if (mapElementRef.current && (mapElementRef.current as any)._leaflet_id) {
        delete (mapElementRef.current as any)._leaflet_id;
      }
    };
  }, [backendStatus]);

  // Load sites
  useEffect(() => {
    if (backendStatus !== 'ready') return;
    Promise.all([
      api.heritage.list({ limit: '200' }),
      api.sakoci.publicList().catch(() => [] as PublicSakoci[]),
    ]).then(([{ data }, publicSakoci]) => {
      setSites(data);
      setSakociList(publicSakoci);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [backendStatus]);

  useEffect(() => {
    if (backendStatus !== 'ready') return;
    const timer = window.setInterval(() => {
      api.sakoci.publicList()
        .then(setSakociList)
        .catch(() => undefined);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [backendStatus]);

  // Signature of the currently active trip routes (sorted trip ids that should show their
  // route polyline). This is a PRIMITIVE string, so even though sakociList changes identity
  // every 1s poll, this memo's *value* only changes when a trip actually starts/ends or the
  // "show route" flag is toggled — which is what we want the route-drawing effect to react to.
  // Without this, the route polyline was being torn down and re-fetched from the backend every
  // single second (on every position poll), causing the flicker/"muncul-hilang" effect.
  const activeTripSignature = useMemo(() => {
    const ids = [...new Set(
      sakociList
        .filter((sakoci) => sakoci.showPublicCurrentRoute !== false)
        .map((sakoci) => Number(sakoci.activeTripId))
        .filter((tripId) => Number.isInteger(tripId) && tripId > 0),
    )].sort((a, b) => a - b);
    return ids.join(',');
  }, [sakociList]);

  // Route polyline — fetched & drawn ONCE per active-trip-set change, not on every position poll.
  useEffect(() => {
    if (!mapReady || !leafletRef.current || !mapRef.current) return;
    let disposed = false;
    const L = leafletRef.current;
    const map = mapRef.current;

    const drawPublicRoutes = async () => {
      const tripIds = activeTripSignature
        ? activeTripSignature.split(',').map(Number)
        : [];
      const routeData = tripIds.length
        ? await Promise.all(tripIds.map((tripId) => loadPublicPlaybackData(tripId)))
        : [];
      if (disposed) return;

      if (publicRouteLayerRef.current) {
        publicRouteLayerRef.current.remove();
        publicRouteLayerRef.current = null;
      }

      const features = routeData.flatMap((item) => geojsonFeatures(item?.geojson));

      const graphLayers: any[] = [];
      routeData.forEach((item) => {
        (item?.nodes ?? []).forEach((node, index) => {
          if (!Number.isFinite(Number(node.latitude)) || !Number.isFinite(Number(node.longitude))) return;
          graphLayers.push(L.circleMarker([Number(node.latitude), Number(node.longitude)], {
            radius: index % 3 === 0 ? 4 : 3,
            color: '#ffffff',
            weight: 2,
            fillColor: '#15803d',
            fillOpacity: 0.95,
            opacity: 1,
          }).addTo(map).bindTooltip(`Node rute #${node.id}`, { direction: 'top', opacity: 0.9 }));
        });
      });

      publicRouteLayerRef.current = { remove: () => graphLayers.forEach((layer) => layer.remove()) };
      if (features.length) try {
        const routeLayer = L.geoJSON({
          type: 'FeatureCollection',
          features,
        }, {
          style: { color: '#16a34a', weight: 7, opacity: 0.9 },
        }).addTo(map);
        publicRouteLayerRef.current = {
          remove: () => {
            routeLayer.remove();
            graphLayers.forEach((layer) => layer.remove());
          },
        };
      } catch {}
    };

    drawPublicRoutes();
    return () => {
      disposed = true;
      if (publicRouteLayerRef.current) {
        publicRouteLayerRef.current.remove();
        publicRouteLayerRef.current = null;
      }
    };
  }, [activeTripSignature, mapReady]);

  // Sakoci radius overlay — this genuinely needs to follow the sakoci's live position, but we
  // still avoid hitting the backend and redrawing every single 1s poll: only refetch for a
  // sakoci once it has moved more than RADIUS_REFRESH_THRESHOLD_M since the last fetch.
  const lastRadiusFetchPositionRef = useRef<Map<number, { lat: number; lng: number }>>(new Map());
  useEffect(() => {
    if (!mapReady || !leafletRef.current || !mapRef.current) return;
    let disposed = false;
    const L = leafletRef.current;
    const map = mapRef.current;
    const RADIUS_REFRESH_THRESHOLD_M = 30;

    const updateRadiusOverlay = async () => {
      const candidates = sakociList.filter(
        (sakoci) => sakoci.showSakociGraphRadius !== false && sakoci.latitude && sakoci.longitude,
      );

      if (!candidates.length) {
        if (sakociGraphLayerRef.current) {
          sakociGraphLayerRef.current.remove();
          sakociGraphLayerRef.current = null;
        }
        lastRadiusFetchPositionRef.current.clear();
        return;
      }

      const needsFetch = candidates.some((sakoci) => {
        const last = lastRadiusFetchPositionRef.current.get(sakoci.id);
        if (!last) return true;
        const distance = haversineMetersLocal(last.lat, last.lng, Number(sakoci.latitude), Number(sakoci.longitude));
        return distance > RADIUS_REFRESH_THRESHOLD_M;
      });
      // Also refetch if the set of candidate sakoci ids changed (new sakoci went active, etc).
      const idsChanged = candidates.some((sakoci) => !lastRadiusFetchPositionRef.current.has(sakoci.id))
        || lastRadiusFetchPositionRef.current.size !== candidates.length;

      if (!needsFetch && !idsChanged) return; // nothing moved enough — skip network call & redraw entirely

      const radiusGraphs = await Promise.all(
        candidates.map((sakoci) => api.graph.radius(Number(sakoci.latitude), Number(sakoci.longitude), 2000).catch(() => null)),
      );
      if (disposed) return;

      if (sakociGraphLayerRef.current) {
        sakociGraphLayerRef.current.remove();
        sakociGraphLayerRef.current = null;
      }

      const radiusLayers: any[] = [];
      radiusGraphs.filter(Boolean).forEach((graph) => {
        const layers = drawSakociGraphRadius(L, map, graph as any);
        radiusLayers.push(...layers);
      });
      sakociGraphLayerRef.current = { remove: () => radiusLayers.forEach((layer) => layer.remove()) };

      lastRadiusFetchPositionRef.current = new Map(
        candidates.map((sakoci) => [sakoci.id, { lat: Number(sakoci.latitude), lng: Number(sakoci.longitude) }]),
      );
    };

    updateRadiusOverlay();
    return () => {
      disposed = true;
    };
  }, [sakociList, mapReady]);

  // Wire global popup callbacks
  useEffect(() => {
    (window as any).__selectSite = (id: number) => {
      const s = sites.find(x => x.id === id);
      if (s) setSelectedSite(s);
    };
    (window as any).__toggleRoute = (id: number) => {
      setSelectedForRoute(prev =>
        prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
      );
    };
  }, [sites]);

  // Draw markers
  useEffect(() => {
    if (!mapReady || !leafletRef.current || sites.length === 0) return;
    const L = leafletRef.current;
    const map = mapRef.current;
    heritageMarkersRef.current.forEach(m => m.remove());
    heritageMarkersRef.current = [];

    const filtered = filterCat ? sites.filter(s => s.category === filterCat) : sites;

    filtered.forEach(site => {
      if (!site.latitude || !site.longitude) return;
      const color = CATEGORY_COLOR[site.category] ?? CATEGORY_COLOR.DEFAULT;
      const isSelected = selectedForRoute.includes(site.id);
      const tspOrder = routeResult?.orderedDestinations.findIndex(destination => destination.id === site.id) ?? -1;
      const order = tspOrder >= 0 ? tspOrder + 1 : selectedForRoute.indexOf(site.id) + 1;

      const icon = createHeritageIcon(L, site.category, color, isSelected, order);

      const marker = L.marker([Number(site.latitude), Number(site.longitude)], { icon })
        .addTo(map)
        .bindPopup(`
          <div style="min-width:210px;font-family:sans-serif">
            <h3 style="font-weight:700;font-size:13px;margin:0 0 5px;color:#1a3a2e;line-height:1.3">${site.name}</h3>
            <span style="background:${color};color:white;padding:2px 8px;border-radius:9999px;font-size:10px;font-weight:600">
              ${CATEGORY_LABEL[site.category] ?? site.category}
            </span>
            <p style="font-size:11px;color:#666;margin:7px 0 3px">📍 ${site.address ?? '-'}</p>
            <p style="font-size:11px;color:#888;margin:0 0 10px">🏙 ${site.kecamatan ?? '-'}</p>
            <div style="display:flex;gap:5px">
              <button onclick="window.__selectSite(${site.id})"
                style="background:#1a3a2e;color:white;border:none;padding:5px 10px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:600">
                📋 Detail
              </button>
              <button onclick="window.__toggleRoute(${site.id})"
                style="background:${isSelected ? '#dc2626' : '#d97706'};color:white;border:none;padding:5px 10px;border-radius:6px;cursor:pointer;font-size:11px;font-weight:600">
                ${isSelected ? '✕ Hapus' : '+ Rute'}
              </button>
            </div>
          </div>
        `, { maxWidth: 260 });

      heritageMarkersRef.current.push(marker);
    });
  }, [sites, filterCat, selectedForRoute, routeResult, mapReady]);

  useEffect(() => {
    if (!mapReady || !leafletRef.current) return;
    const L = leafletRef.current;
    const map = mapRef.current;
    const visibleIds = new Set<number>();

    sakociList.forEach(sakoci => {
      if (!sakoci.latitude || !sakoci.longitude) return;
      visibleIds.add(sakoci.id);

      const nextLatLng = L.latLng(Number(sakoci.latitude), Number(sakoci.longitude));
      const existing = sakociMarkersRef.current.get(sakoci.id);
      const bearing = existing ? getBearing(existing.getLatLng(), nextLatLng) : 0;
      const icon = createSakociIcon(L, bearing, sakoci.image_url);
      const popup = `
        <div style="min-width:200px;font-family:sans-serif">
          <h3 style="font-weight:700;font-size:13px;margin:0 0 5px;color:#0f766e;line-height:1.3">${sakoci.name}</h3>
          <p style="font-size:11px;color:#666;margin:0 0 4px">Nomor polisi: ${sakoci.plate_number ?? '-'}</p>
          <p style="font-size:11px;color:#666;margin:0 0 4px">Status: ${sakoci.status}</p>
          <p style="font-size:11px;color:#888;margin:0">Update: ${sakoci.location_updated_at ? new Date(sakoci.location_updated_at).toLocaleString('id-ID') : '-'}</p>
        </div>
      `;

      if (!existing) {
        const marker = L.marker(nextLatLng, { icon })
          .addTo(map)
          .bindPopup(popup, { maxWidth: 240 });
        sakociMarkersRef.current.set(sakoci.id, marker);
        return;
      }

      existing.setIcon(icon);
      existing.setPopupContent(popup);
      animateMarker(existing, existing.getLatLng(), nextLatLng);
    });

    sakociMarkersRef.current.forEach((marker, id) => {
      if (!visibleIds.has(id)) {
        marker.remove();
        sakociMarkersRef.current.delete(id);
      }
    });
  }, [sakociList, mapReady]);

  useEffect(() => {
    if (!mapReady || !leafletRef.current || !mapRef.current) return;
    const L = leafletRef.current;
    const map = mapRef.current;
    const bounds = L.latLngBounds([]);

    if (routeLayerRef.current) routeLayerRef.current.remove();
    if (alternativeLayerRef.current) alternativeLayerRef.current.remove();

    const routeLayers: any[] = [];
    const alternativeLayers: any[] = [];

    if (routeResult && showOptimalRoute) {
      if (routeResult.geojson) {
        const main = L.geoJSON(routeResult.geojson, {
          style: (feature: any) => ({
            color: feature?.properties?.source === 'OSRM_ALTERNATIVE' ? '#2563eb' : '#15803d',
            weight: feature?.properties?.source === 'OSRM_ALTERNATIVE' ? 3 : 5,
            opacity: feature?.properties?.source === 'OSRM_ALTERNATIVE' ? 0.35 : 0.9,
            dashArray: feature?.properties?.source === 'OSRM_ALTERNATIVE' ? '8 8' : undefined,
          }),
        }).addTo(map);
        routeLayers.push(main);
        const routeBounds = main.getBounds();
        if (routeBounds.isValid()) bounds.extend(routeBounds);
      }

    }

    routeLayerRef.current = { remove: () => routeLayers.forEach(layer => layer.remove()) };
    alternativeLayerRef.current = { remove: () => alternativeLayers.forEach(layer => layer.remove()) };

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [mapReady, routeResult, showAlternatives, showOptimalRoute]);

  const getUserLocation = () => {
    navigator.geolocation.getCurrentPosition(
      pos => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLoc(loc);
        if (mapRef.current && leafletRef.current) {
          const L = leafletRef.current;
          L.marker([loc.lat, loc.lng], {
            icon: L.divIcon({
              className: '',
              html: `<div style="width:16px;height:16px;background:#3b82f6;border:3px solid white;border-radius:50%;box-shadow:0 0 0 4px rgba(59,130,246,0.3)"></div>`,
              iconSize: [16, 16],
              iconAnchor: [8, 8],
            }),
          }).addTo(mapRef.current).bindPopup('📍 Lokasi Anda');
          mapRef.current.setView([loc.lat, loc.lng], 15);
        }
      },
      () => alert('Tidak dapat mengakses lokasi. Pastikan izin lokasi diaktifkan.'),
    );
  };

  const computeRoute = useCallback(async () => {
    if (selectedForRoute.length < 2) {
      alert('Pilih minimal 2 situs dengan menekan "+ Rute" pada popup marker');
      return;
    }
    if (!userLoc) {
      alert('Aktifkan "Gunakan Lokasi Saya" sebagai titik jemput/start rute terlebih dahulu.');
      return;
    }
    setRouteLoading(true);

    try {
      const result = await api.routing.preview({
        pickup: {
          latitude: userLoc.lat,
          longitude: userLoc.lng,
        },
        destinationIds: selectedForRoute,
      });
      setRouteResult(result);
    } catch (err: any) {
      alert(`Gagal menghitung rute: ${err.message}. Periksa koneksi ke backend.`);
    } finally {
      setRouteLoading(false);
    }
  }, [selectedForRoute, userLoc]);

  const clearRoute = () => {
    if (routeLayerRef.current) routeLayerRef.current.remove();
    setSelectedForRoute([]);
    setRouteResult(null);
  };

  const visibleSites = filterCat ? sites.filter(site => site.category === filterCat) : sites;
  const searchResults = search.trim()
    ? visibleSites.filter(site => {
        const query = search.toLowerCase();
        return site.name.toLowerCase().includes(query)
          || (site.address ?? '').toLowerCase().includes(query)
          || (site.kecamatan ?? '').toLowerCase().includes(query);
      }).slice(0, 8)
    : visibleSites.slice(0, 8);

  const focusSite = (site: HeritageSite) => {
    if (mapRef.current && site.latitude && site.longitude) {
      mapRef.current.setView([Number(site.latitude), Number(site.longitude)], 17, { animate: true });
    }
    setSelectedSite(site);
    setMobilePanelOpen(false);
  };

  if (backendStatus !== 'ready') {
    return <LoadingSkeleton className="h-[calc(100dvh-64px)] min-h-[560px] w-full rounded-none lg:h-[calc(100dvh-80px)]" />;
  }

  return (
    <div className="relative flex h-[calc(100dvh-64px)] min-h-[560px] overflow-hidden bg-slate-100 lg:h-[calc(100dvh-80px)]">
      {mobilePanelOpen && (
        <button
          onClick={() => setMobilePanelOpen(false)}
          className="absolute inset-0 z-[1100] bg-slate-950/40 backdrop-blur-[2px] lg:hidden"
          aria-label="Tutup kontrol peta"
        />
      )}
      {/* Sidebar */}
      <div
        className={`fixed inset-x-0 bottom-0 z-[1200] flex max-h-[82dvh] flex-col overflow-hidden rounded-t-3xl border border-white/70 bg-white/95 shadow-2xl backdrop-blur-xl transition-all duration-300 lg:relative lg:inset-auto lg:z-auto lg:max-h-none lg:rounded-none lg:border-y-0 lg:border-l-0 lg:bg-white lg:backdrop-blur-none ${
          mobilePanelOpen ? 'translate-y-0' : 'translate-y-full'
        } ${sidebarOpen ? 'lg:w-[360px] lg:translate-x-0 lg:translate-y-0' : 'lg:w-0 lg:-translate-x-full lg:translate-y-0'}`}
      >
        <div className="mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-gray-300 lg:hidden" />
        <div className="flex w-full min-w-0 shrink-0 items-center justify-between bg-gradient-to-br from-[#1a3a2e] to-[#2d6a4f] p-4 text-white lg:min-w-[360px]">
          <div>
            <h2 className="font-bold text-lg">🗺 Jelajah Cimahi</h2>
            <p className="text-xs text-green-200 mt-0.5">Peta heritage interaktif</p>
          </div>
          <button
            onClick={() => setMobilePanelOpen(false)}
            className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white/80 hover:bg-white/20 lg:hidden"
            aria-label="Tutup kontrol peta"
          >
            ✕
          </button>
          <button
            onClick={() => setSidebarOpen(false)}
            className="hidden h-9 w-9 place-items-center rounded-full bg-white/10 text-white/80 hover:bg-white/20 lg:grid"
            aria-label="Tutup kontrol peta"
          >
            ✕
          </button>
        </div>

        <div className="grid min-w-0 grid-cols-3 border-b bg-white p-2 lg:min-w-[360px]">
          {([
            ['explore', '⌕', 'Jelajah'],
            ['route', '🧭', 'Rute'],
            ['layers', '◫', 'Layer'],
          ] as Array<[PanelTab, string, string]>).map(([key, icon, label]) => (
            <button
              key={key}
              onClick={() => setActivePanel(key)}
              className={`relative rounded-xl px-2 py-2 text-xs font-semibold transition ${
                activePanel === key ? 'bg-[#1a3a2e] text-white' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              <span className="mr-1">{icon}</span>{label}
              {key === 'route' && selectedForRoute.length > 0 && (
                <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-amber-500 px-1 text-[9px] text-white">
                  {selectedForRoute.length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex-1 min-w-0 overflow-y-auto p-4 space-y-4 lg:min-w-[360px]">
          {activePanel === 'explore' && (
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Cari lokasi</label>
                <label className="flex items-center gap-2 rounded-xl border bg-gray-50 px-3 focus-within:border-[#1a3a2e] focus-within:ring-2 focus-within:ring-green-100">
                  <span className="text-gray-400">⌕</span>
                  <input
                    value={search}
                    onChange={event => setSearch(event.target.value)}
                    placeholder="Nama situs, alamat, kecamatan..."
                    className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none"
                  />
                  {search && <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-700">✕</button>}
                </label>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">Kategori</label>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  <button
                    onClick={() => setFilterCat('')}
                    className={`whitespace-nowrap rounded-full px-3 py-2 text-xs font-semibold ${
                      !filterCat ? 'bg-[#1a3a2e] text-white' : 'border bg-white text-gray-600'
                    }`}
                  >
                    Semua · {sites.length}
                  </button>
                  {Object.entries(CATEGORY_LABEL).map(([key]) => (
                    <button
                      key={key}
                      onClick={() => setFilterCat(key)}
                      className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-xs font-semibold ${
                        filterCat === key ? 'text-white shadow' : 'border bg-white text-gray-600'
                      }`}
                      style={filterCat === key ? { backgroundColor: CATEGORY_COLOR[key] } : undefined}
                    >
                      <span className="grid h-5 w-5 place-items-center rounded-md text-[10px] text-white" style={{ backgroundColor: CATEGORY_COLOR[key] }}>
                        {CATEGORY_SHORT[key]}
                      </span>
                      {sites.filter(site => site.category === key).length}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Lokasi ditemukan</p>
                  <span className="text-xs text-gray-400">{visibleSites.length} situs</span>
                </div>
                <div className="space-y-2">
                  {searchResults.map(site => (
                    <button
                      key={site.id}
                      onClick={() => focusSite(site)}
                      className="group flex w-full items-center gap-3 rounded-2xl border bg-white p-3 text-left transition hover:border-[#1a3a2e]/30 hover:bg-green-50"
                    >
                      <span
                        className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xs font-bold text-white shadow-sm"
                        style={{ backgroundColor: CATEGORY_COLOR[site.category] ?? CATEGORY_COLOR.DEFAULT }}
                      >
                        {CATEGORY_SHORT[site.category] ?? 'W'}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-gray-800">{site.name}</span>
                        <span className="block truncate text-xs text-gray-400">{site.kecamatan ?? site.address ?? 'Cimahi'}</span>
                      </span>
                      <span className="text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-[#1a3a2e]">›</span>
                    </button>
                  ))}
                  {searchResults.length === 0 && (
                    <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-gray-400">
                      Tidak ada situs yang cocok.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Legend */}
          {activePanel === 'layers' && <div className="bg-gray-50 rounded-2xl p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Legenda</p>
            <div className="space-y-1.5">
              {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                <div key={k} className="flex items-center gap-2 text-xs text-gray-700">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-white shadow"
                    style={{ background: CATEGORY_COLOR[k] }}>
                    <span className="text-[11px] font-bold">{CATEGORY_SHORT[k] ?? 'W'}</span>
                  </span>
                  {v}
                </div>
              ))}
              <div className="flex items-center gap-2 text-xs text-gray-700 border-t pt-1.5 mt-1.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 border-[#1a3a2e] bg-amber-500 text-[11px] font-bold text-white shadow" />
                Situs dipilih untuk rute
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-700">
                <span className="h-1 w-8 rounded bg-green-700" />
                Rute optimal
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-700">
                <span className="h-0 w-8 border-t-2 border-dashed border-blue-600" />
                Alternatif lintasan
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-700">
                <span className="h-2 w-2 rounded-full bg-slate-600" />
                Node graph
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-700">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-teal-700 text-white shadow">
                  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                    <path fill="currentColor" d="M6 4h12c1.4 0 2.5 1.1 2.5 2.5V16c0 .9-.6 1.7-1.4 2v1.1c0 .5-.4.9-.9.9h-1.1c-.5 0-.9-.4-.9-.9V18H7.8v1.1c0 .5-.4.9-.9.9H5.8c-.5 0-.9-.4-.9-.9V18c-.8-.3-1.4-1.1-1.4-2V6.5C3.5 5.1 4.6 4 6 4Zm.3 2C5.9 6 5.5 6.4 5.5 6.8V11h14V6.8c0-.4-.4-.8-.8-.8H6.3Zm1 10.3a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4Zm10.4 0a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4Z"/>
                  </svg>
                </span>
                Sakoci publik ({sakociList.length})
              </div>
            </div>
            <div className="mt-4 space-y-2 border-t pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Tampilan peta</p>
              {[
                ['Rute optimal', showOptimalRoute, setShowOptimalRoute],
                ['Alternatif lintasan', showAlternatives, setShowAlternatives],
              ].map(([label, checked, setter]) => (
                <label key={String(label)} className="flex cursor-pointer items-center justify-between rounded-xl border bg-white px-3 py-2.5 text-sm text-gray-700">
                  <span>{String(label)}</span>
                  <input
                    type="checkbox"
                    checked={Boolean(checked)}
                    onChange={event => (setter as (value: boolean) => void)(event.target.checked)}
                    className="h-4 w-4 accent-[#1a3a2e]"
                  />
                </label>
              ))}
            </div>
          </div>}

          {/* Routing */}
          {activePanel === 'route' && <div className="border rounded-2xl p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-600 uppercase">
              🧭 Rute Optimal – Dijkstra
            </p>
            <p className="text-xs text-gray-400">
              Klik marker di peta lalu "+ Rute" untuk memilih situs. Minimal 2 situs.
            </p>

            <button onClick={getUserLocation}
              className="w-full text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-lg px-3 py-2 hover:bg-blue-100 transition flex items-center justify-center gap-2">
              📍 {userLoc ? '✓ Lokasi tersimpan' : 'Gunakan Lokasi Saya'}
            </button>

            <div className="grid grid-cols-1 gap-1.5 text-xs">
              <label className="flex items-center justify-between gap-2 bg-gray-50 border rounded-lg px-3 py-2">
                <span>Tampilkan rute optimal</span>
                <input type="checkbox" checked={showOptimalRoute} onChange={e => setShowOptimalRoute(e.target.checked)} />
              </label>
              <label className="flex items-center justify-between gap-2 bg-gray-50 border rounded-lg px-3 py-2">
                <span>Tampilkan alternatif lintasan</span>
                <input type="checkbox" checked={showAlternatives} onChange={e => setShowAlternatives(e.target.checked)} />
              </label>
            </div>

            {/* Selected sites */}
            {selectedForRoute.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 mb-1">{selectedForRoute.length} situs dipilih:</p>
                <div className="space-y-1 max-h-28 overflow-y-auto">
                  {selectedForRoute.map((id, idx) => {
                    const s = sites.find(x => x.id === id);
                    return s ? (
                      <div key={id} className="flex items-center gap-1.5 text-xs bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5">
                        <span className="w-4 h-4 bg-[#1a3a2e] text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {idx + 1}
                        </span>
                        <span className="flex-1 truncate">{s.name}</span>
                        <button onClick={() => setSelectedForRoute(p => p.filter(x => x !== id))}
                          className="text-red-400 hover:text-red-600 flex-shrink-0">✕</button>
                      </div>
                    ) : null;
                  })}
                </div>
              </div>
            )}

            <button onClick={computeRoute}
              disabled={routeLoading || selectedForRoute.length < 2}
              className="w-full bg-[#1a3a2e] text-white rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-40 hover:bg-[#2d6a4f] transition flex items-center justify-center gap-2">
              {routeLoading ? (
                <><span className="animate-spin">⏳</span> Menghitung rute...</>
              ) : (
                '🧭 Hitung Rute Optimal'
              )}
            </button>

            {routeResult && (
              <button onClick={clearRoute}
                className="w-full bg-red-50 text-red-600 border border-red-200 rounded-lg px-3 py-1.5 text-xs hover:bg-red-100 transition">
                🗑 Hapus Rute
              </button>
            )}
          </div>}

          {/* Route result */}
          {activePanel === 'route' && routeResult && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
              <p className="font-bold text-blue-900 text-sm mb-2">📊 Hasil Rute Optimal</p>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-white rounded-lg p-2 text-center">
                  <p className="text-xs text-gray-500">Total Jarak</p>
                  <p className="font-bold text-[#1a3a2e]">{formatKm(routeResult.totalDistanceKm)}</p>
                </div>
                <div className="bg-white rounded-lg p-2 text-center">
                  <p className="text-xs text-gray-500">Estimasi Waktu</p>
                  <p className="font-bold text-[#1a3a2e]">{routeResult.totalDurationMinutes ? `${Math.round(routeResult.totalDurationMinutes)} menit` : '-'}</p>
                </div>
              </div>
              <p className="text-xs font-semibold text-blue-800 mb-1.5">Urutan kunjungan optimal:</p>
              <div className="space-y-1">
                {routeResult.orderedDestinations.map((d, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span className="w-5 h-5 bg-[#1a3a2e] text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                      {i + 1}
                    </span>
                    <span className="truncate text-gray-700">{d.name}</span>
                  </div>
                ))}
              </div>
              {routeResult.segments?.length > 0 && (
                <div className="mt-3 border-t pt-2 space-y-1">
                  <p className="text-xs font-semibold text-blue-800">Detail per segmen:</p>
                  {routeResult.segments.map((seg: any, i: number) => (
                    <div key={i} className="text-xs text-gray-600 border rounded-lg bg-white px-2 py-1.5">
                      <div className="flex justify-between gap-2">
                        <span className="truncate">{seg.from.name} → {seg.to.name}</span>
                        <span className="flex-shrink-0 text-blue-700 font-medium">{formatKm(seg.distanceKm)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Stats footer */}
          <div className="text-xs text-gray-400 border-t pt-3">
            {loading ? (
              <span className="animate-pulse">Memuat data situs...</span>
            ) : (
              <span>
                Menampilkan <strong className="text-gray-700">{filterCat ? sites.filter(s => s.category === filterCat).length : sites.length}</strong> dari{' '}
                <strong className="text-gray-700">{sites.length}</strong> situs
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Map container */}
      <div className="flex-1 relative min-w-0">
        {/* Toggle button */}
        <button
          onClick={() => setSidebarOpen(v => !v)}
          className="absolute left-4 top-4 z-[1000] hidden items-center gap-2 rounded-2xl border border-white/70 bg-white/95 px-4 py-3 text-sm font-semibold text-[#1a3a2e] shadow-xl backdrop-blur hover:bg-white lg:flex"
        >
          {sidebarOpen ? '◀ Tutup panel' : '☰ Kontrol peta'}
        </button>

        {/* Map */}
        <div ref={mapElementRef} id="leaflet-map" className="w-full h-full" />

        <div className="absolute left-3 right-3 top-3 z-[1000] flex gap-2 lg:hidden">
          <button
            onClick={() => setMobilePanelOpen(true)}
            className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/70 bg-white text-xl text-[#1a3a2e] shadow-xl"
            aria-label="Buka kontrol peta"
          >
            ☰
          </button>
          <label className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-white/70 bg-white/95 px-4 shadow-xl backdrop-blur">
            <span className="text-gray-400">⌕</span>
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              onFocus={() => { setActivePanel('explore'); setMobilePanelOpen(true); }}
              placeholder="Cari situs heritage..."
              className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none"
            />
          </label>
        </div>

        <div className="absolute bottom-5 left-3 z-[900] flex max-w-[calc(100%-5rem)] gap-2 overflow-x-auto sm:left-auto sm:right-4">
          <span className="whitespace-nowrap rounded-full border border-white/70 bg-white/95 px-3 py-2 text-xs font-semibold text-gray-700 shadow-lg backdrop-blur">
            🏛 {visibleSites.length} situs
          </span>
          <span className="whitespace-nowrap rounded-full border border-white/70 bg-white/95 px-3 py-2 text-xs font-semibold text-teal-700 shadow-lg backdrop-blur">
            🚐 {sakociList.length} Sakoci
          </span>
          {selectedForRoute.length > 0 && (
            <button
              onClick={() => { setActivePanel('route'); setMobilePanelOpen(true); }}
              className="whitespace-nowrap rounded-full bg-amber-500 px-3 py-2 text-xs font-bold text-white shadow-lg lg:hidden"
            >
              {selectedForRoute.length} tujuan
            </button>
          )}
        </div>

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 z-[900] flex items-center justify-center bg-white/75 backdrop-blur-sm">
            <div className="text-center">
              <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-[#1a3a2e] text-2xl text-white shadow-xl animate-pulse">🗺</div>
              <p className="font-semibold text-[#1a3a2e]">Menyiapkan peta heritage</p>
              <p className="mt-1 text-xs text-gray-500">Memuat situs dan kendaraan...</p>
            </div>
          </div>
        )}
      </div>

      {/* Site detail panel */}
      {selectedSite && (
        <div className="absolute inset-0 z-[1300] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[3px] sm:items-center sm:p-5">
          <button
            onClick={() => setSelectedSite(null)}
            className="absolute inset-0 cursor-default"
            aria-label="Tutup detail situs"
          />

          <article className="relative flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-h-[86dvh] sm:rounded-3xl">
            <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-[#1a3a2e] to-[#2d6a4f]">
              {getSiteImage(selectedSite) && (
                <>
                  <img
                    src={getSiteImage(selectedSite)}
                    alt={selectedSite.name}
                    className="absolute inset-0 h-full w-full object-cover opacity-40"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#10271f] via-[#1a3a2e]/75 to-[#1a3a2e]/35" />
                </>
              )}

              <div className="relative p-5 text-white sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <span className="inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
                      {CATEGORY_LABEL[selectedSite.category] ?? selectedSite.category}
                    </span>
                    <h3 className="mt-3 text-xl font-bold leading-tight sm:text-2xl">{selectedSite.name}</h3>
                    <p className="mt-2 flex items-start gap-2 text-sm text-green-50/90">
                      <span aria-hidden="true">📍</span>
                      <span>{selectedSite.address ?? 'Alamat belum tersedia'}</span>
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedSite(null)}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-black/20 text-lg text-white backdrop-blur transition hover:bg-black/35"
                    aria-label="Tutup detail situs"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>

            <div className="overflow-y-auto">
              <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6">
                <SiteInfo icon="🏙" label="Wilayah" value={[selectedSite.kelurahan, selectedSite.kecamatan].filter(Boolean).join(', ') || '-'} />
                <SiteInfo icon="✓" label="Status" value={selectedSite.status || '-'} capitalize />
                <SiteInfo icon="🔖" label="Nomor Register" value={selectedSite.no_register || '-'} mono />
                <SiteInfo icon="📅" label="Tahun Register" value={selectedSite.tahun_register || '-'} />
                <SiteInfo
                  icon="⌖"
                  label="Koordinat"
                  value={selectedSite.latitude && selectedSite.longitude
                    ? `${Number(selectedSite.latitude).toFixed(6)}, ${Number(selectedSite.longitude).toFixed(6)}`
                    : '-'}
                  mono
                />
                <SiteInfo icon="📜" label="SK Penetapan" value={selectedSite.sk_penetapan || '-'} />
              </div>

              {selectedSite.description && (
                <div className="border-t px-5 py-5 sm:px-6">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Tentang situs</p>
                  <p className="mt-2 line-clamp-4 text-sm leading-6 text-gray-600">{selectedSite.description}</p>
                </div>
              )}
            </div>

            <div className="grid shrink-0 grid-cols-2 gap-2 border-t bg-white p-4 sm:flex sm:justify-end sm:p-5">
              <button
                onClick={() => { (window as any).__toggleRoute(selectedSite.id); setSelectedSite(null); }}
                className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${
                  selectedForRoute.includes(selectedSite.id)
                    ? 'bg-red-100 text-red-700 hover:bg-red-200'
                    : 'bg-amber-500 text-white hover:bg-amber-600'
                }`}
              >
                {selectedForRoute.includes(selectedSite.id) ? '✕ Hapus dari Rute' : '+ Tambah ke Rute'}
              </button>
              <a
                href={`/heritage/${selectedSite.id}`}
                className="rounded-xl bg-[#1a3a2e] px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-[#2d6a4f]"
              >
                Lihat Detail Lengkap
              </a>
            </div>
          </article>
        </div>
      )}
    </div>
  );
}

function SiteInfo({
  icon,
  label,
  value,
  mono = false,
  capitalize = false,
}: {
  icon: string;
  label: string;
  value: string;
  mono?: boolean;
  capitalize?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-gray-50 p-3.5">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-sm shadow-sm" aria-hidden="true">
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
          <p className={`mt-1 break-words text-sm font-medium text-gray-700 ${mono ? 'font-mono text-xs' : ''} ${capitalize ? 'capitalize' : ''}`}>
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

function getSiteImage(site: HeritageSite) {
  return backendAssetUrl((site.images ?? []).find(image => image.is_visible !== false && image.url)?.url
    ?? site.image_url
    ?? '');
}

function formatKm(value?: number | null) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '-';
  return `${Number(value).toFixed(2)} km`;
}

async function loadPublicPlaybackData(tripId: number) {
  try {
    const route = await api.tripPlayback.publicRoute(tripId)
      .catch(() => api.tripPlayback.route(tripId));
    const graph = route.graph ?? null;
    return {
      geojson: route.geometry ? drawableGeojson(route.geometry) : playbackGraphGeojson(graph),
      nodes: graph?.nodes ?? [],
    };
  } catch {
    return null;
  }
}

function playbackGraphGeojson(graph: PlaybackGraph | null) {
  const features = (graph?.edges ?? [])
    .map((edge) => edge.geometry)
    .filter(Boolean)
    .map((geometry) => ({
      type: 'Feature' as const,
      geometry,
      properties: {},
    }));
  return features.length ? { type: 'FeatureCollection' as const, features } : null;
}

function drawSakociGraphRadius(L: any, map: any, graph: PlaybackGraph & { enabled?: boolean }) {
  if (!graph?.enabled) return [];
  const layers: any[] = [];
  const edgeFeatures = (graph.edges ?? [])
    .map((edge) => edge.geometry)
    .filter(Boolean)
    .map((geometry) => ({
      type: 'Feature' as const,
      geometry,
      properties: {},
    }));

  if (edgeFeatures.length) {
    layers.push(L.geoJSON({ type: 'FeatureCollection', features: edgeFeatures }, {
      style: { color: '#64748b', weight: 2, opacity: 0.22 },
      interactive: false,
    }).addTo(map));
  }

  (graph.nodes ?? []).forEach((node) => {
    if (!Number.isFinite(Number(node.latitude)) || !Number.isFinite(Number(node.longitude))) return;
    layers.push(L.circleMarker([Number(node.latitude), Number(node.longitude)], {
      radius: 2.5,
      color: '#475569',
      weight: 1,
      fillColor: '#cbd5e1',
      fillOpacity: 0.42,
      opacity: 0.3,
      interactive: false,
    }).addTo(map));
  });

  return layers;
}

function drawableGeojson(geometry: TripRoutePlayback['geometry']) {
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

function haversineMetersLocal(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
}

function geojsonFeatures(geojson: any) {
  if (!geojson) return [];
  if (geojson.type === 'FeatureCollection' && Array.isArray(geojson.features)) return geojson.features;
  if (geojson.type === 'Feature') return [geojson];
  if (geojson.type && geojson.coordinates) {
    return [{ type: 'Feature' as const, geometry: geojson, properties: {} }];
  }
  return [];
}

function createSakociIcon(L: any, bearing: number, imageUrl?: string | null) {
  const resolvedImageUrl = backendAssetUrl(imageUrl ?? '');
  const content = resolvedImageUrl
    ? `<img src="${resolvedImageUrl}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;transform:rotate(${-bearing}deg)" />`
    : `<svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" style="display:block">
          <path fill="white" d="M6.2 3.5h11.6c1.4 0 2.6 1.2 2.6 2.6v10.3c0 1-.7 1.9-1.6 2.3v1.1c0 .5-.4.9-.9.9h-1.4c-.5 0-.9-.4-.9-.9v-.9H8.4v.9c0 .5-.4.9-.9.9H6.1c-.5 0-.9-.4-.9-.9v-1.1a2.5 2.5 0 0 1-1.6-2.3V6.1c0-1.4 1.2-2.6 2.6-2.6Zm.4 2.2c-.5 0-.9.4-.9.9v5h16.6v-5c0-.5-.4-.9-.9-.9H6.6Zm1.1 11.7a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8Zm8.6 0a1.4 1.4 0 1 0 0-2.8 1.4 1.4 0 0 0 0 2.8ZM7 7.2v2.7h3.8V7.2H7Zm5.2 0v2.7H17V7.2h-4.8Z"/>
        </svg>`;
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:58px;height:58px;display:flex;align-items:center;justify-content:center">
      <div style="position:absolute;width:46px;height:46px;border-radius:9999px;background:rgba(15,118,110,0.2);animation:sakoci-pulse 1.6s ease-out infinite"></div>
      <div style="position:relative;width:44px;height:44px;border-radius:${resolvedImageUrl ? '9999px' : '16px'};overflow:hidden;background:linear-gradient(135deg,#0f766e,#14b8a6);border:4px solid white;box-shadow:0 8px 20px rgba(0,0,0,0.38);display:flex;align-items:center;justify-content:center;transform:rotate(${bearing}deg)">
        ${content}
      </div>
      <style>@keyframes sakoci-pulse{0%{transform:scale(.7);opacity:.95}100%{transform:scale(1.45);opacity:0}}</style>
    </div>`,
    iconSize: [58, 58],
    iconAnchor: [29, 29],
  });
}

function createHeritageIcon(L: any, category: string, color: string, selected: boolean, order: number) {
  const bg = selected ? '#f59e0b' : color;
  const iconSvg = getCategorySvg(category);

  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:${selected ? 44 : 38}px;height:${selected ? 50 : 44}px;filter:drop-shadow(0 5px 10px rgba(0,0,0,.35));">
      <div style="position:absolute;inset:0;display:flex;align-items:flex-start;justify-content:center">
        <div style="width:${selected ? 38 : 32}px;height:${selected ? 38 : 32}px;border-radius:14px 14px 14px 4px;background:${bg};border:3px solid white;transform:rotate(-45deg);"></div>
      </div>
      <div style="position:absolute;top:${selected ? 4 : 3}px;left:0;right:0;height:${selected ? 32 : 28}px;display:flex;align-items:center;justify-content:center;color:white;">
        ${selected ? `<span style="font-size:13px;font-weight:800;line-height:1">${order}</span>` : iconSvg}
      </div>
    </div>`,
    iconSize: [selected ? 44 : 38, selected ? 50 : 44],
    iconAnchor: [selected ? 22 : 19, selected ? 46 : 40],
  });
}

function getCategorySvg(category: string) {
  if (category === 'BG') {
    return `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M4 20V9.5L12 4l8 5.5V20h-4v-6h-4v6H4Zm4-2h2v-4H8v4Zm0-6h2v-2H8v2Zm6 0h2v-2h-2v2Z"/></svg>`;
  }
  if (category === 'SI') {
    return `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 3 3 8v2h18V8l-9-5ZM5 20h14v-2H5v2Zm2-3h2v-6H7v6Zm4 0h2v-6h-2v6Zm4 0h2v-6h-2v6Z"/></svg>`;
  }
  if (category === 'BD') {
    return `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M8 4h8l2 4-6 13L6 8l2-4Zm1.2 2-1 2h3V6H9.2Zm4.3 0v2h3l-1-2h-2Zm-4.2 4 2.7 6.1L14.7 10H9.3Z"/></svg>`;
  }
  return `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M12 3c3.3 0 6 2.7 6 6 0 4.5-6 12-6 12S6 13.5 6 9c0-3.3 2.7-6 6-6Zm0 8.5A2.5 2.5 0 1 0 12 6a2.5 2.5 0 0 0 0 5.5Z"/></svg>`;
}

function animateMarker(marker: any, from: any, to: any) {
  if (from.lat === to.lat && from.lng === to.lng) return;
  const duration = 1400;
  const start = performance.now();

  const step = (now: number) => {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    marker.setLatLng([
      from.lat + (to.lat - from.lat) * eased,
      from.lng + (to.lng - from.lng) * eased,
    ]);
    if (progress < 1) requestAnimationFrame(step);
  };

  requestAnimationFrame(step);
}

function getBearing(from: any, to: any) {
  const fromLat = degreesToRadians(from.lat);
  const toLat = degreesToRadians(to.lat);
  const deltaLng = degreesToRadians(to.lng - from.lng);
  const y = Math.sin(deltaLng) * Math.cos(toLat);
  const x = Math.cos(fromLat) * Math.sin(toLat) -
    Math.sin(fromLat) * Math.cos(toLat) * Math.cos(deltaLng);
  return (radiansToDegrees(Math.atan2(y, x)) + 360) % 360;
}

function degreesToRadians(value: number) {
  return value * Math.PI / 180;
}

function radiansToDegrees(value: number) {
  return value * 180 / Math.PI;
}
