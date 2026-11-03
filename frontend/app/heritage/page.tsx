'use client';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, HeritageSite } from '@/lib/api';
import { backendAssetUrl } from '@/lib/runtime-config';

const CAT_LABEL: Record<string, string> = {
  BG: 'Bangunan Gedung', SI: 'Situs', BD: 'Benda Cagar Budaya', KA: 'Kawasan Adat',
};
const CAT_COLOR: Record<string, string> = {
  BG: 'bg-blue-100 text-blue-800', SI: 'bg-red-100 text-red-800',
  BD: 'bg-amber-100 text-amber-800', KA: 'bg-green-100 text-green-800',
};
const CAT_ICON: Record<string, string> = {
  BG: '🏢', SI: '🗿', BD: '⚙️', KA: '🌿',
};

export default function HeritagePage() {
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto px-4 py-8" />}>
      <HeritageContent />
    </Suspense>
  );
}

function HeritageContent() {
  const searchParams = useSearchParams();
  const [sites, setSites] = useState<HeritageSite[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(searchParams.get('category') ?? '');
  const [kecamatan, setKecamatan] = useState('');
  const [sortNearest, setSortNearest] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    const params: Record<string, string> = { page: String(page), limit: '12' };
    if (search) params.search = search;
    if (category) params.category = category;
    if (kecamatan) params.kecamatan = kecamatan;
    if (sortNearest && userLocation) {
      params.sort = 'nearest';
      params.latitude = String(userLocation.latitude);
      params.longitude = String(userLocation.longitude);
    }
    api.heritage.list(params).then(({ data, total }) => {
      setSites(data); setTotal(total); setLoading(false);
    }).catch(() => setLoading(false));
  }, [search, category, kecamatan, sortNearest, userLocation, page]);

  const totalPages = Math.ceil(total / 12);
  const canUseNearest = Boolean(userLocation && sortNearest);

  const enableNearestFilter = () => {
    setLocationError('');

    if (sortNearest && userLocation) {
      setSortNearest(false);
      setPage(1);
      return;
    }

    if (!('geolocation' in navigator)) {
      setLocationError('Browser tidak mendukung akses lokasi.');
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setSortNearest(true);
        setPage(1);
        setLocating(false);
      },
      () => {
        setLocationError('Izin lokasi ditolak atau lokasi tidak tersedia.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-[#1a3a2e] mb-2">🏛 Direktori Situs Heritage</h1>
        <p className="text-gray-500">Data resmi cagar budaya Kota Cimahi tahun 2025</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text" placeholder="🔍 Cari nama situs..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="border rounded-lg px-4 py-2 text-sm flex-1 min-w-48"
        />
        <select value={category} onChange={e => { setCategory(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm">
          <option value="">Semua Kategori</option>
          {Object.entries(CAT_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={kecamatan} onChange={e => { setKecamatan(e.target.value); setPage(1); }}
          className="border rounded-lg px-3 py-2 text-sm">
          <option value="">Semua Kecamatan</option>
          <option value="Cimahi Tengah">Cimahi Tengah</option>
          <option value="Cimahi Utara">Cimahi Utara</option>
          <option value="Cimahi Selatan">Cimahi Selatan</option>
        </select>
        <button
          type="button"
          onClick={enableNearestFilter}
          disabled={locating}
          className={`rounded-lg border px-4 py-2 text-sm font-medium transition disabled:cursor-wait disabled:opacity-60 ${
            canUseNearest
              ? 'border-[#1a3a2e] bg-[#1a3a2e] text-white'
              : 'border-gray-200 bg-white text-gray-700 hover:border-[#1a3a2e] hover:text-[#1a3a2e]'
          }`}
        >
          {locating ? 'Mencari lokasi...' : canUseNearest ? 'Terdekat aktif' : 'Terdekat dari saya'}
        </button>
      </div>
      {locationError && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
          {locationError}
        </p>
      )}

      {/* Count */}
      <p className="text-sm text-gray-500 mb-4">
        Menampilkan <strong>{sites.length}</strong> dari <strong>{total}</strong> situs
        {canUseNearest ? ' berdasarkan lokasi terdekat' : ''}
      </p>

      {/* Grid */}
      {loading ? (
        <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array(8).fill(0).map((_, i) => (
            <div key={i} className="bg-gray-100 rounded-xl h-48 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid md:grid-cols-3 lg:grid-cols-4 gap-4">
          {sites.map(site => {
            const primaryImage = getPrimaryImage(site);

            return (
              <a key={site.id} href={`/heritage/${site.id}`}
                className="bg-white rounded-xl shadow hover:shadow-md transition overflow-hidden group">
                {primaryImage ? (
                  <img
                    src={primaryImage}
                    alt={site.name}
                    className="h-32 w-full object-cover bg-gray-100 transition duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-32 bg-gradient-to-br from-[#1a3a2e] to-[#2d6a4f] flex items-center justify-center text-4xl">
                    {CAT_ICON[site.category] ?? '🏛'}
                  </div>
                )}
                <div className="p-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CAT_COLOR[site.category] ?? 'bg-gray-100 text-gray-700'}`}>
                    {CAT_LABEL[site.category] ?? site.category}
                  </span>
                  <h3 className="font-bold text-sm text-[#1a3a2e] mt-2 leading-tight group-hover:text-green-700 transition line-clamp-2">
                    {site.name}
                  </h3>
                  <p className="text-xs text-gray-500 mt-1 truncate">📍 {site.kecamatan ?? site.address ?? '-'}</p>
                  {canUseNearest && typeof site.distance_km === 'number' && (
                    <p className="mt-2 text-xs font-semibold text-[#1a3a2e]">
                      {formatDistance(site.distance_km)} dari lokasi Anda
                    </p>
                  )}
                </div>
              </a>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-8">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-4 py-2 border rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50">← Prev</button>
          {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => setPage(p)}
              className={`w-9 h-9 rounded-lg text-sm font-medium ${p === page ? 'bg-[#1a3a2e] text-white' : 'border hover:bg-gray-50'}`}>
              {p}
            </button>
          ))}
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
            className="px-4 py-2 border rounded-lg text-sm disabled:opacity-40 hover:bg-gray-50">Next →</button>
        </div>
      )}
    </div>
  );
}

function getPrimaryImage(site: HeritageSite) {
  return backendAssetUrl(site.images?.find(item => item.is_visible !== false && item.url)?.url
    ?? site.image_url
    ?? '');
}

function formatDistance(distanceKm: number) {
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m`;
  return `${distanceKm.toFixed(distanceKm < 10 ? 1 : 0)} km`;
}
