'use client';
import { useEffect, useState } from 'react';
import { api, TourPackage, HeritageSite } from '@/lib/api';

type FormState = {
  code: string;
  name: string;
  description: string;
  price_per_person: number;
  duration_hours: number;
  heritageIds: number[];
};

const EMPTY_FORM: FormState = {
  code: '', name: '', description: '', price_per_person: 0, duration_hours: 4, heritageIds: [],
};

export default function AdminPaketPage() {
  const [packages, setPackages] = useState<TourPackage[]>([]);
  const [allSites, setAllSites] = useState<HeritageSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editId, setEditId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [siteSearch, setSiteSearch] = useState('');

  const load = () => {
    setLoading(true);
  
    Promise.all([
      api.packages.list(),
      api.heritage.list({ limit: '200' }),
    ])
      .then(([pkgRes, { data }]) => {
        const pkgs = Array.isArray(pkgRes)
          ? pkgRes
          : Array.isArray(pkgRes?.data)
            ? pkgRes.data
            : [];
  
        setPackages(pkgs);
        setAllSites(data ?? []);
      })
      .catch((err) => {
        console.error('Failed to load admin packages:', err);
        setPackages([]);
        setAllSites([]);
      })
      .finally(() => setLoading(false));
  };
  
  useEffect(() => { load(); }, []);

  const set = (key: keyof FormState, val: any) => setForm(f => ({ ...f, [key]: val }));

  const toggleSite = (id: number) => {
    setForm(f => ({
      ...f,
      heritageIds: f.heritageIds.includes(id)
        ? f.heritageIds.filter(x => x !== id)
        : [...f.heritageIds, id],
    }));
  };

  const openCreate = () => { setForm(EMPTY_FORM); setEditId(null); setModal('create'); };
  const openEdit = (pkg: TourPackage) => {
    setForm({
      code: pkg.code,
      name: pkg.name,
      description: pkg.description ?? '',
      price_per_person: Number(pkg.price_per_person),
      duration_hours: pkg.duration_hours ?? 4,
      heritageIds: pkg.routes?.sort((a, b) => a.sequence - b.sequence).map(r => r.heritage_site.id) ?? [],
    });
    setEditId(pkg.id);
    setModal('edit');
  };

  const save = async () => {
    if (!form.code.trim()) return alert('Kode paket wajib diisi');
    if (!form.name.trim()) return alert('Nama paket wajib diisi');
    if (form.heritageIds.length < 1) return alert('Pilih minimal 1 situs heritage');
    setSaving(true);
    try {
      if (modal === 'create') {
        await api.packages.create(form);
      } else if (editId) {
        await api.packages.update(editId, form);
      }
      setModal(null);
      load();
    } catch (err: any) {
      alert(err.message ?? 'Gagal menyimpan');
    } finally { setSaving(false); }
  };

  const del = async (id: number, name: string) => {
    if (!confirm(`Hapus paket "${name}"?`)) return;
    setDeleting(id);
    try { await api.packages.delete(id); load(); }
    catch { alert('Gagal menghapus'); }
    finally { setDeleting(null); }
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

  const filteredSites = siteSearch
    ? allSites.filter(s => s.name.toLowerCase().includes(siteSearch.toLowerCase()))
    : allSites;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <a href="/admin" className="text-sm text-gray-500 hover:text-[#1a3a2e] mb-1 block">← Admin Dashboard</a>
          <h1 className="text-2xl font-bold text-[#1a3a2e]">📦 Kelola Paket Wisata</h1>
        </div>
        <button onClick={openCreate}
          className="bg-[#1a3a2e] text-white px-5 py-2 rounded-lg text-sm font-semibold hover:bg-[#2d6a4f] transition">
          + Buat Paket Baru
        </button>
      </div>

      {/* Grid cards */}
      {loading ? (
        <div className="grid md:grid-cols-3 gap-5">
          {[1, 2, 3].map(i => <div key={i} className="bg-gray-100 rounded-2xl h-56 animate-pulse" />)}
        </div>
      ) : packages.length === 0 ? (
        <div className="text-center py-24 text-gray-400">
          <div className="text-5xl mb-3">📦</div>
          <p className="mb-4">Belum ada paket wisata</p>
          <button onClick={openCreate}
            className="bg-[#1a3a2e] text-white px-5 py-2 rounded-lg text-sm font-semibold">
            + Buat Paket Pertama
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {packages.map(pkg => (
            <div key={pkg.id} className="bg-white rounded-2xl shadow overflow-hidden">
              <div className="bg-gradient-to-br from-[#1a3a2e] to-[#2d6a4f] text-white p-5">
                <span className="text-xs bg-amber-400 text-amber-900 px-2 py-0.5 rounded-full font-bold">
                  {pkg.code}
                </span>
                <h3 className="text-lg font-bold mt-2">{pkg.name}</h3>
                <p className="text-green-200 text-sm mt-1 line-clamp-2">{pkg.description}</p>
              </div>
              <div className="p-4">
                <div className="flex justify-between text-sm text-gray-600 mb-3">
                  <span>📍 {pkg.routes?.length ?? 0} destinasi</span>
                  <span>⏱ {pkg.duration_hours ?? '?'}j</span>
                  <span className="font-bold text-[#1a3a2e]">{fmt(pkg.price_per_person)}</span>
                </div>

                {/* Route list preview */}
                <div className="space-y-1 mb-3 max-h-24 overflow-y-auto">
                  {pkg.routes?.sort((a, b) => a.sequence - b.sequence).map(r => (
                    <div key={r.id} className="flex items-center gap-2 text-xs text-gray-600">
                      <span className="w-5 h-5 bg-[#1a3a2e] text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                        {r.sequence}
                      </span>
                      <span className="truncate">{r.heritage_site?.name}</span>
                    </div>
                  ))}
                </div>

                {/* Status badge */}
                <div className="flex items-center justify-between">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${pkg.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                    {pkg.active ? '● Aktif' : '○ Nonaktif'}
                  </span>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(pkg)}
                      className="text-xs bg-amber-500 text-white px-3 py-1 rounded-lg hover:bg-amber-600 transition">
                      ✏ Edit
                    </button>
                    <button onClick={() => del(pkg.id, pkg.name)} disabled={deleting === pkg.id}
                      className="text-xs bg-red-500 text-white px-3 py-1 rounded-lg hover:bg-red-600 transition disabled:opacity-40">
                      🗑
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <div className="bg-white rounded-t-2xl shadow-2xl w-full max-w-2xl max-h-[94vh] flex flex-col sm:rounded-2xl sm:max-h-[92vh]">
            {/* Modal header */}
            <div className="p-5 border-b flex justify-between items-center flex-shrink-0">
              <h2 className="font-bold text-[#1a3a2e] text-lg">
                {modal === 'create' ? '+ Buat Paket Wisata Baru' : '✏ Edit Paket Wisata'}
              </h2>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">✕</button>
            </div>

            {/* Modal body */}
            <div className="overflow-y-auto flex-1 p-5 space-y-4">
              {/* Code & Name */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Kode Paket *</label>
                  <input value={form.code} onChange={e => set('code', e.target.value)}
                    placeholder="PKG-MILITER"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a2e]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Nama Paket *</label>
                  <input value={form.name} onChange={e => set('name', e.target.value)}
                    placeholder="Wisata Heritage Militer"
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a2e]" />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Deskripsi</label>
                <textarea rows={3} value={form.description} onChange={e => set('description', e.target.value)}
                  placeholder="Deskripsi singkat paket wisata..."
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a2e]" />
              </div>

              {/* Price & Duration */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Harga / Orang (Rp)</label>
                  <input type="number" min={0} value={form.price_per_person}
                    onChange={e => set('price_per_person', Number(e.target.value))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a2e]" />
                  <p className="text-xs text-gray-400 mt-0.5">= {fmt(form.price_per_person)}</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Durasi (Jam)</label>
                  <input type="number" min={1} max={24} value={form.duration_hours}
                    onChange={e => set('duration_hours', Number(e.target.value))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a3a2e]" />
                </div>
              </div>

              {/* Heritage site picker */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-gray-500 uppercase">
                    Pilih Situs Heritage *
                    <span className="ml-2 bg-[#1a3a2e] text-white px-1.5 py-0.5 rounded-full text-xs">
                      {form.heritageIds.length} dipilih
                    </span>
                  </label>
                </div>

                {/* Selected sites preview (ordered) */}
                {form.heritageIds.length > 0 && (
                  <div className="mb-2 p-2 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-xs text-green-700 font-semibold mb-1">Urutan rute saat ini:</p>
                    <div className="flex flex-wrap gap-1">
                      {form.heritageIds.map((id, idx) => {
                        const s = allSites.find(x => x.id === id);
                        return s ? (
                          <span key={id}
                            className="inline-flex items-center gap-1 text-xs bg-white border border-green-300 text-green-800 px-2 py-0.5 rounded-full">
                            <span className="w-4 h-4 bg-[#1a3a2e] text-white rounded-full text-xs flex items-center justify-center font-bold">
                              {idx + 1}
                            </span>
                            {s.name.length > 20 ? s.name.substring(0, 20) + '…' : s.name}
                            <button onClick={() => toggleSite(id)} className="text-red-400 hover:text-red-600 ml-0.5">✕</button>
                          </span>
                        ) : null;
                      })}
                    </div>
                  </div>
                )}

                {/* Search */}
                <input type="text" placeholder="🔍 Cari situs..." value={siteSearch}
                  onChange={e => setSiteSearch(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-[#1a3a2e]" />

                {/* Site list */}
                <div className="border rounded-lg max-h-48 overflow-y-auto divide-y">
                  {filteredSites.slice(0, 40).map(site => {
                    const checked = form.heritageIds.includes(site.id);
                    const order = form.heritageIds.indexOf(site.id) + 1;
                    return (
                      <button key={site.id} onClick={() => toggleSite(site.id)}
                        className={`w-full text-left px-3 py-2.5 flex items-center gap-3 hover:bg-gray-50 transition ${checked ? 'bg-green-50' : ''}`}>
                        <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 text-xs font-bold transition ${checked ? 'bg-[#1a3a2e] text-white' : 'border-2 border-gray-300 text-transparent'}`}>
                          {checked ? order : '✓'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm truncate ${checked ? 'font-semibold text-[#1a3a2e]' : 'text-gray-700'}`}>
                            {site.name}
                          </p>
                          <p className="text-xs text-gray-400 truncate">{site.category} · {site.kecamatan}</p>
                        </div>
                      </button>
                    );
                  })}
                  {filteredSites.length === 0 && (
                    <p className="text-center py-6 text-sm text-gray-400">Tidak ada situs ditemukan</p>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Urutan klik = urutan rute. Algoritma Dijkstra akan mengoptimalkan urutan ini.
                </p>
              </div>
            </div>

            {/* Modal footer */}
            <div className="p-4 sm:p-5 border-t flex-shrink-0 flex gap-3 justify-end">
              <button onClick={() => setModal(null)}
                className="px-5 py-2 border rounded-lg text-sm hover:bg-gray-50 transition">
                Batal
              </button>
              <button onClick={save} disabled={saving}
                className="px-6 py-2 bg-[#1a3a2e] text-white rounded-lg text-sm font-semibold hover:bg-[#2d6a4f] transition disabled:opacity-50 flex items-center gap-2">
                {saving ? '⏳ Menyimpan...' : '💾 Simpan Paket'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
