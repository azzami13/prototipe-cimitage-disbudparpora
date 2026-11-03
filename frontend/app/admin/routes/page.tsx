'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  api,
  TourPackage,
  PackageRoute,
  HeritageSite,
  CreatePackageRouteBody,
} from '@/lib/api';
import AdminRouteVisualization from '@/components/admin/AdminRouteVisualization';

const CAT_COLOR: Record<string, string> = {
  BG: 'bg-blue-100 text-blue-800',
  SI: 'bg-red-100 text-red-800',
  BD: 'bg-amber-100 text-amber-800',
  KA: 'bg-green-100 text-green-800',
};
const CAT_LABEL: Record<string, string> = {
  BG: 'Bangunan Gedung',
  SI: 'Situs',
  BD: 'Benda',
  KA: 'Kawasan',
};

export default function AdminRoutesPage() {
  const [packages, setPackages] = useState<TourPackage[]>([]);
  const [allSites, setAllSites] = useState<HeritageSite[]>([]);
  const [routes, setRoutes] = useState<PackageRoute[]>([]);

  const [selectedPkgId, setSelectedPkgId] = useState<number | null>(null);
  const [loadingPkgs, setLoadingPkgs] = useState(true);
  const [loadingRoutes, setLoadingRoutes] = useState(false);
  const [loadingSites, setLoadingSites] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [siteSearch, setSiteSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleting, setDeleting] = useState<number | null>(null);

  const [editingNotes, setEditingNotes] = useState<number | null>(null);
  const [notesValue, setNotesValue] = useState('');

  // ─── Load packages ────────────────────────────────────────────────────────
  useEffect(() => {
    setLoadingPkgs(true);
    api.packages
      .list({ limit: '100' })
      .then(({ data }) => setPackages(data))
      .catch(() => {})
      .finally(() => setLoadingPkgs(false));
  }, []);

  // ─── Load all heritage sites ───────────────────────────────────────────────
  useEffect(() => {
    setLoadingSites(true);
    api.heritage
      .list({ limit: '200' })
      .then(({ data }) => setAllSites(data))
      .catch(() => {})
      .finally(() => setLoadingSites(false));
  }, []);

  // ─── Load routes for selected package ─────────────────────────────────────
  const loadRoutes = useCallback(() => {
    if (!selectedPkgId) { setRoutes([]); return; }
    setLoadingRoutes(true);
    api.packageRoutes
      .list(selectedPkgId)
      .then((data) => setRoutes(data.sort((a, b) => a.sequence - b.sequence)))
      .catch(() => {})
      .finally(() => setLoadingRoutes(false));
  }, [selectedPkgId]);

  useEffect(() => { loadRoutes(); }, [loadRoutes]);

  // ─── Computed ─────────────────────────────────────────────────────────────
  const usedSiteIds = new Set(routes.map((r) => r.heritage_site_id));
  const availableSites = allSites.filter((s) => !usedSiteIds.has(s.id));
  const filteredAvailable = siteSearch
    ? availableSites.filter(
        (s) =>
          s.name.toLowerCase().includes(siteSearch.toLowerCase()) ||
          (s.kecamatan ?? '').toLowerCase().includes(siteSearch.toLowerCase()),
      )
    : availableSites;

  const selectedPkg = packages.find((p) => p.id === selectedPkgId);

  // ─── Add route ────────────────────────────────────────────────────────────
  const openAddModal = () => {
    setSiteSearch('');
    setShowAddModal(true);
  };

  const handleAddSite = async (site: HeritageSite) => {
    if (!selectedPkgId) return;
    setSaving(true);
    try {
      await api.packageRoutes.create({
        tour_package_id: selectedPkgId,
        heritage_site_id: site.id,
        sequence: routes.length + 1,
        notes: '',
      } as CreatePackageRouteBody);
      setShowAddModal(false);
      loadRoutes();
    } catch (err: any) {
      alert(err.message ?? 'Gagal menambahkan situs');
    } finally {
      setSaving(false);
    }
  };

  // ─── Delete route ──────────────────────────────────────────────────────────
  const handleDelete = async (route: PackageRoute) => {
    if (!confirm(`Hapus "${route.heritage_site?.name}" dari paket ini?`)) return;
    setDeleting(route.id);
    try {
      await api.packageRoutes.delete(route.id);
      loadRoutes();
    } catch {
      alert('Gagal menghapus route');
    } finally {
      setDeleting(null);
    }
  };

  // ─── Reorder ──────────────────────────────────────────────────────────────
  const moveRoute = async (index: number, direction: 'up' | 'down') => {
    const newRoutes = [...routes];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= newRoutes.length) return;

    [newRoutes[index], newRoutes[swapIndex]] = [newRoutes[swapIndex], newRoutes[index]];

    const items = newRoutes.map((r, i) => ({ id: r.id, sequence: i + 1 }));
    setRoutes(newRoutes.map((r, i) => ({ ...r, sequence: i + 1 })));

    try {
      if (selectedPkgId) {
        await api.packageRoutes.bulkReorder(selectedPkgId, items);
      }
    } catch {
      loadRoutes();
      alert('Gagal mengubah urutan');
    }
  };

  // ─── Update notes ──────────────────────────────────────────────────────────
  const saveNotes = async (routeId: number) => {
    try {
      await api.packageRoutes.update(routeId, { notes: notesValue });
      setEditingNotes(null);
      loadRoutes();
    } catch {
      alert('Gagal menyimpan catatan');
    }
  };

  // ─── Clear all routes ──────────────────────────────────────────────────────
  const handleClearAll = async () => {
    if (!selectedPkgId) return;
    if (!confirm(`Hapus SEMUA ${routes.length} route dari paket ini?`)) return;
    try {
      await api.packageRoutes.removeAllByPackage(selectedPkgId);
      loadRoutes();
    } catch {
      alert('Gagal menghapus semua route');
    }
  };

  // ─── Render
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <a
          href="/admin"
          className="text-sm text-gray-500 hover:text-[#1a3a2e] mb-1 block"
        >
          ← Admin Dashboard
        </a>
        <h1 className="text-2xl font-bold text-[#1a3a2e]">
          🗺 Kelola Package Routes
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Atur situs heritage dan urutan kunjungan untuk setiap paket wisata
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* ── Left: Package Selector ── */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl shadow overflow-hidden">
            <div className="px-4 py-3 bg-[#1a3a2e] text-white flex items-center justify-between">
              <h2 className="font-semibold text-sm">Pilih Paket Wisata</h2>
              <span className="text-xs text-green-300">{packages.length} paket</span>
            </div>

            {loadingPkgs ? (
              <div className="p-4 space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : packages.length === 0 ? (
              <div className="p-8 text-center text-gray-400">
                <div className="text-3xl mb-2">📦</div>
                <p className="text-sm">Belum ada paket wisata</p>
                <a
                  href="/admin/paket"
                  className="text-blue-600 hover:underline text-xs mt-1 block"
                >
                  Buat paket baru →
                </a>
              </div>
            ) : (
              <div className="divide-y max-h-[60vh] overflow-y-auto">
                {packages.map((pkg) => (
                  <button
                    key={pkg.id}
                    onClick={() => setSelectedPkgId(pkg.id)}
                    className={`w-full text-left px-4 py-3 transition hover:bg-gray-50 ${
                      selectedPkgId === pkg.id
                        ? 'bg-green-50 border-l-4 border-[#1a3a2e]'
                        : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p
                          className={`font-semibold text-sm truncate ${
                            selectedPkgId === pkg.id ? 'text-[#1a3a2e]' : 'text-gray-800'
                          }`}
                        >
                          {pkg.name}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">{pkg.code}</p>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            pkg.active
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {pkg.active ? 'Aktif' : 'Nonaktif'}
                        </span>
                        <span className="text-xs text-gray-400">
                          {pkg.routes?.length ?? 0} situs
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Route Manager ── */}
        <div className="lg:col-span-2">
          {!selectedPkgId ? (
            <div className="bg-white rounded-2xl shadow flex items-center justify-center h-64 text-gray-400">
              <div className="text-center">
                <div className="text-5xl mb-3">👈</div>
                <p>Pilih paket wisata di sebelah kiri</p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow overflow-hidden">
              {/* Route Manager Header */}
              <div className="px-5 py-4 border-b flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-[#1a3a2e]">{selectedPkg?.name}</h2>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {routes.length} situs dalam rute · {selectedPkg?.code}
                  </p>
                </div>
                <div className="flex gap-2">
                  {routes.length > 0 && (
                    <button
                      onClick={handleClearAll}
                      className="text-xs bg-red-50 text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-100 transition"
                    >
                      🗑 Hapus Semua
                    </button>
                  )}
                  <button
                    onClick={openAddModal}
                    className="text-xs bg-[#1a3a2e] text-white px-3 py-1.5 rounded-lg hover:bg-[#2d6a4f] transition"
                  >
                    + Tambah Situs
                  </button>
                </div>
              </div>

              {/* Routes List */}
              {loadingRoutes ? (
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : routes.length === 0 ? (
                <div className="p-12 text-center text-gray-400">
                  <div className="text-4xl mb-3">🗺</div>
                  <p className="mb-3">Belum ada situs dalam rute ini</p>
                  <button
                    onClick={openAddModal}
                    className="bg-[#1a3a2e] text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-[#2d6a4f] transition"
                  >
                    + Tambah Situs Pertama
                  </button>
                </div>
              ) : (
                <div className="divide-y">
                  {routes.map((route, index) => (
                    <div
                      key={route.id}
                      className="px-5 py-3 flex items-start gap-3 hover:bg-gray-50 transition"
                    >
                      {/* Sequence badge */}
                      <div className="w-7 h-7 bg-[#1a3a2e] text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                        {route.sequence}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-gray-800 truncate">
                          {route.heritage_site?.name}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span
                            className={`text-xs px-1.5 py-0.5 rounded-full ${
                              CAT_COLOR[route.heritage_site?.category ?? ''] ??
                              'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {CAT_LABEL[route.heritage_site?.category ?? ''] ??
                              route.heritage_site?.category}
                          </span>
                          <span className="text-xs text-gray-400">
                            {route.heritage_site?.kecamatan}
                          </span>
                        </div>

                        {/* Notes inline editor */}
                        {editingNotes === route.id ? (
                          <div className="mt-2 flex gap-2">
                            <input
                              autoFocus
                              value={notesValue}
                              onChange={(e) => setNotesValue(e.target.value)}
                              placeholder="Catatan untuk situs ini..."
                              className="flex-1 border rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#1a3a2e]"
                            />
                            <button
                              onClick={() => saveNotes(route.id)}
                              className="text-xs bg-[#1a3a2e] text-white px-2 py-1 rounded-lg"
                            >
                              ✓
                            </button>
                            <button
                              onClick={() => setEditingNotes(null)}
                              className="text-xs text-gray-500 px-1"
                            >
                              ✕
                            </button>
                          </div>
                        ) : route.notes ? (
                          <p
                            className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded mt-1 cursor-pointer hover:bg-amber-100 transition inline-block"
                            onClick={() => {
                              setEditingNotes(route.id);
                              setNotesValue(route.notes ?? '');
                            }}
                          >
                            💡 {route.notes}
                          </p>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingNotes(route.id);
                              setNotesValue('');
                            }}
                            className="text-xs text-gray-400 hover:text-gray-600 mt-1 transition"
                          >
                            + tambah catatan
                          </button>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => moveRoute(index, 'up')}
                          disabled={index === 0}
                          className="w-7 h-7 rounded-lg border flex items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-30 transition text-xs"
                          title="Pindah ke atas"
                        >
                          ▲
                        </button>
                        <button
                          onClick={() => moveRoute(index, 'down')}
                          disabled={index === routes.length - 1}
                          className="w-7 h-7 rounded-lg border flex items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-30 transition text-xs"
                          title="Pindah ke bawah"
                        >
                          ▼
                        </button>
                        <button
                          onClick={() => handleDelete(route)}
                          disabled={deleting === route.id}
                          className="w-7 h-7 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center text-red-500 hover:bg-red-100 disabled:opacity-40 transition text-xs"
                          title="Hapus dari rute"
                        >
                          {deleting === route.id ? '…' : '✕'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Footer summary */}
              {routes.length > 0 && (
                <div className="px-5 py-3 bg-gray-50 border-t flex items-center justify-between text-xs text-gray-500">
                  <span>
                    Total: <strong className="text-gray-700">{routes.length} situs</strong>
                  </span>
                  <span>Urutan dapat diubah dengan tombol ▲▼</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {selectedPkgId && routes.length > 0 && (
        <AdminRouteVisualization
          routes={routes}
          packageName={selectedPkg?.name}
        />
      )}

      {/* ── Add Site Modal ── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
            {/* Modal header */}
            <div className="p-5 border-b flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="font-bold text-[#1a3a2e]">+ Tambah Situs ke Rute</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {selectedPkg?.name} · {availableSites.length} situs tersedia
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-700 text-xl leading-none"
              >
                ✕
              </button>
            </div>

            {/* Search */}
            <div className="px-5 py-3 border-b flex-shrink-0">
              <input
                type="text"
                placeholder="🔍 Cari nama situs atau kecamatan..."
                value={siteSearch}
                onChange={(e) => setSiteSearch(e.target.value)}
                autoFocus
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a2e]"
              />
            </div>

            {/* Site list */}
            <div className="flex-1 overflow-y-auto divide-y">
              {loadingSites ? (
                <div className="p-8 text-center text-gray-400">
                  <p>⏳ Memuat situs...</p>
                </div>
              ) : filteredAvailable.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <p>
                    {siteSearch
                      ? 'Tidak ada situs ditemukan'
                      : 'Semua situs sudah ditambahkan'}
                  </p>
                </div>
              ) : (
                filteredAvailable.slice(0, 50).map((site) => (
                  <button
                    key={site.id}
                    onClick={() => handleAddSite(site)}
                    disabled={saving}
                    className="w-full text-left px-5 py-3 hover:bg-green-50 transition flex items-center gap-3 disabled:opacity-50"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-800 truncate">
                        {site.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded-full ${
                            CAT_COLOR[site.category] ?? 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {CAT_LABEL[site.category] ?? site.category}
                        </span>
                        <span className="text-xs text-gray-400 truncate">
                          {site.kecamatan}
                        </span>
                      </div>
                    </div>
                    <span className="text-xs text-[#1a3a2e] font-semibold flex-shrink-0">
                      + Tambah
                    </span>
                  </button>
                ))
              )}
            </div>

            {/* Modal footer */}
            <div className="px-5 py-3 border-t flex-shrink-0 flex justify-between items-center">
              <span className="text-xs text-gray-400">
                {filteredAvailable.length} situs tersedia
              </span>
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-1.5 border rounded-lg text-sm hover:bg-gray-50 transition"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
