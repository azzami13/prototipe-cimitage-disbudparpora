'use client';
import { useEffect, useState } from 'react';
import { api, HeritageMediaItem, HeritageSite } from '@/lib/api';
import HeritageCoordinatePicker from '@/components/maps/HeritageCoordinatePicker';

const CAT_LABEL: Record<string, string> = {
  BG: 'Bangunan Gedung', SI: 'Situs', BD: 'Benda Cagar Budaya', KA: 'Kawasan Adat',
};

const EMPTY: Partial<HeritageSite> = {
  name: '', category: 'BG', address: '', kelurahan: '', kecamatan: '',
  latitude: undefined, longitude: undefined, no_register: '', status: 'aktif',
  images: [], youtube_links: [], pdf_files: [],
};

export default function AdminHeritagePage() {
  const [sites, setSites] = useState<HeritageSite[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [form, setForm] = useState<Partial<HeritageSite>>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [uploading, setUploading] = useState<'images' | 'pdf_files' | null>(null);

  const load = () => {
    setLoading(true);
    const params: Record<string, string> = { page: String(page), limit: '15' };
    if (search) params.search = search;
    api.heritage.list(params).then(({ data, total }) => {
      setSites(data); setTotal(total);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [search, page]);

  const set = (key: keyof HeritageSite, val: any) =>
    setForm(f => ({ ...f, [key]: val }));

  const openCreate = () => { setForm(EMPTY); setModal('create'); };
  const openEdit = (s: HeritageSite) => {
    setForm({
      ...s,
      images: s.images ?? [],
      youtube_links: s.youtube_links ?? [],
      pdf_files: s.pdf_files ?? [],
    });
    setModal('edit');
  };

  const addMedia = (key: 'images' | 'youtube_links' | 'pdf_files', item: HeritageMediaItem) => {
    setForm(f => ({ ...f, [key]: [...((f[key] as HeritageMediaItem[]) ?? []), item] }));
  };

  const updateMedia = (
    key: 'images' | 'youtube_links' | 'pdf_files',
    index: number,
    patch: Partial<HeritageMediaItem>,
  ) => {
    setForm(f => ({
      ...f,
      [key]: ((f[key] as HeritageMediaItem[]) ?? []).map((item, i) =>
        i === index ? { ...item, ...patch } : item,
      ),
    }));
  };

  const removeMedia = (key: 'images' | 'youtube_links' | 'pdf_files', index: number) => {
    setForm(f => ({
      ...f,
      [key]: ((f[key] as HeritageMediaItem[]) ?? []).filter((_, i) => i !== index),
    }));
  };

  const uploadMedia = async (key: 'images' | 'pdf_files', file?: File) => {
    if (!file) return;
    const items = (form[key] as HeritageMediaItem[]) ?? [];
    const max = key === 'images' ? 5 : 2;
    if (items.length >= max) return alert(key === 'images' ? 'Gambar maksimal 5 file' : 'File PDF maksimal 2 file');

    setUploading(key);
    try {
      const uploaded = await api.heritage.upload(file);
      addMedia(key, {
        url: uploaded.url,
        title: file.name.replace(/\.[^.]+$/, ''),
        is_visible: true,
      });
    } catch (err: any) {
      alert(err.message ?? 'Gagal upload file');
    } finally {
      setUploading(null);
    }
  };

  const addYoutube = () => {
    const items = form.youtube_links ?? [];
    if (items.length >= 2) return alert('Link YouTube maksimal 2');
    addMedia('youtube_links', { url: '', title: '', is_visible: true });
  };

  const save = async () => {
    if (!form.name?.trim()) return alert('Nama situs wajib diisi');
    setSaving(true);
    try {
      const payload = cleanHeritageForm(form);
      if (modal === 'create') {
        await api.heritage.create(payload);
      } else if (form.id) {
        await api.heritage.update(form.id, payload);
      }
      setModal(null);
      load();
    } catch (err: any) {
      alert(err.message ?? 'Gagal menyimpan');
    } finally { setSaving(false); }
  };

  const del = async (id: number, name: string) => {
    if (!confirm(`Hapus "${name}"?`)) return;
    setDeleting(id);
    try { await api.heritage.delete(id); load(); }
    catch (err: any) { alert(err.message ?? 'Gagal menghapus'); }
    finally { setDeleting(null); }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <a href="/admin" className="text-sm text-gray-500 hover:text-[#1a3a2e] mb-1 block">← Admin Dashboard</a>
          <h1 className="text-2xl font-bold text-[#1a3a2e]">🏛 Kelola Situs Heritage</h1>
        </div>
        <button onClick={openCreate}
          className="bg-[#1a3a2e] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-[#2d6a4f] transition">
          + Tambah Situs
        </button>
      </div>

      <div className="flex gap-3 mb-5">
        <input type="text" placeholder="🔍 Cari nama situs..." value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="border rounded-lg px-4 py-2 text-sm flex-1" />
        <span className="self-center text-sm text-gray-500">{total} total</span>
      </div>

      <div className="bg-white rounded-2xl shadow overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">ID</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Nama Situs</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Kategori</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Kecamatan</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Koordinat</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              Array(8).fill(0).map((_, i) => (
                <tr key={i}><td colSpan={7} className="px-4 py-3"><div className="h-4 bg-gray-100 animate-pulse rounded" /></td></tr>
              ))
            ) : sites.map(s => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-400 font-mono text-xs">{s.id}</td>
                <td className="px-4 py-3 font-medium max-w-xs truncate">{s.name}</td>
                <td className="px-4 py-3">
                  <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                    {s.category}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{s.kecamatan ?? '-'}</td>
                <td className="px-4 py-3 text-xs text-gray-400 font-mono">
                  {s.latitude ? `${Number(s.latitude).toFixed(4)}, ${Number(s.longitude).toFixed(4)}` : '—'}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${s.status === 'aktif' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                    {s.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(s)}
                      className="text-xs bg-amber-500 text-white px-2 py-1 rounded hover:bg-amber-600">✏</button>
                    <button onClick={() => del(s.id, s.name)} disabled={deleting === s.id}
                      className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 disabled:opacity-40">🗑</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex gap-2 mt-4 justify-center">
        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
          className="px-4 py-1.5 border rounded-lg text-sm disabled:opacity-40">← Prev</button>
        <span className="px-3 py-1.5 text-sm text-gray-600">Hal {page} / {Math.ceil(total / 15)}</span>
        <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / 15)}
          className="px-4 py-1.5 border rounded-lg text-sm disabled:opacity-40">Next →</button>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <div className="bg-white rounded-t-2xl shadow-2xl w-full max-w-3xl max-h-[94vh] overflow-y-auto sm:rounded-2xl sm:max-h-[90vh]">
            <div className="p-5 border-b flex justify-between items-center">
              <h2 className="font-bold text-[#1a3a2e]">
                {modal === 'create' ? '+ Tambah Situs Heritage' : '✏ Edit Situs Heritage'}
              </h2>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <MField label="Nama Situs *">
                <input value={form.name ?? ''} onChange={e => set('name', e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Nama situs cagar budaya" />
              </MField>
              <div className="grid gap-3 sm:grid-cols-2">
                <MField label="Kategori">
                  <select value={form.category ?? 'BG'} onChange={e => set('category', e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm">
                    {Object.entries(CAT_LABEL).map(([k, v]) => <option key={k} value={k}>{k} - {v}</option>)}
                  </select>
                </MField>
                <MField label="Status">
                  <select value={form.status ?? 'aktif'} onChange={e => set('status', e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="aktif">Aktif</option>
                    <option value="tidak aktif">Tidak Aktif</option>
                    <option value="dalam kajian">Dalam Kajian</option>
                  </select>
                </MField>
              </div>
              <MField label="Alamat">
                <input value={form.address ?? ''} onChange={e => set('address', e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </MField>
              <div className="grid gap-3 sm:grid-cols-2">
                <MField label="Kelurahan">
                  <input value={form.kelurahan ?? ''} onChange={e => set('kelurahan', e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm" />
                </MField>
                <MField label="Kecamatan">
                  <select value={form.kecamatan ?? ''} onChange={e => set('kecamatan', e.target.value)}
                    className="w-full border rounded-lg px-3 py-2 text-sm">
                    <option value="">Pilih...</option>
                    <option>Cimahi Tengah</option>
                    <option>Cimahi Utara</option>
                    <option>Cimahi Selatan</option>
                  </select>
                </MField>
              </div>
              <MField label="Koordinat">
                <HeritageCoordinatePicker
                  value={{
                    lat: typeof form.latitude === 'number' ? form.latitude : Number(form.latitude) || undefined,
                    lng: typeof form.longitude === 'number' ? form.longitude : Number(form.longitude) || undefined,
                  }}
                  onChange={point => setForm(f => ({
                    ...f,
                    latitude: point.lat,
                    longitude: point.lng,
                  }))}
                />
              </MField>
              <MField label="No. Register">
                <input value={form.no_register ?? ''} onChange={e => set('no_register', e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </MField>
              <MField label="Deskripsi">
                <textarea rows={3} value={form.description ?? ''} onChange={e => set('description', e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </MField>
              <MediaSection
                form={form}
                uploading={uploading}
                onUpload={uploadMedia}
                onAddYoutube={addYoutube}
                onUpdate={updateMedia}
                onRemove={removeMedia}
              />
            </div>
            <div className="sticky bottom-0 bg-white p-4 sm:p-5 border-t flex gap-3 justify-end">
              <button onClick={() => setModal(null)}
                className="px-5 py-2 border rounded-lg text-sm hover:bg-gray-50">Batal</button>
              <button onClick={save} disabled={saving}
                className="px-5 py-2 bg-[#1a3a2e] text-white rounded-lg text-sm font-semibold hover:bg-[#2d6a4f] disabled:opacity-50">
                {saving ? '⏳ Menyimpan...' : '💾 Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">{label}</label>
      {children}
    </div>
  );
}

function MediaSection({
  form,
  uploading,
  onUpload,
  onAddYoutube,
  onUpdate,
  onRemove,
}: {
  form: Partial<HeritageSite>;
  uploading: 'images' | 'pdf_files' | null;
  onUpload: (key: 'images' | 'pdf_files', file?: File) => void;
  onAddYoutube: () => void;
  onUpdate: (key: 'images' | 'youtube_links' | 'pdf_files', index: number, patch: Partial<HeritageMediaItem>) => void;
  onRemove: (key: 'images' | 'youtube_links' | 'pdf_files', index: number) => void;
}) {
  const images = form.images ?? [];
  const videos = form.youtube_links ?? [];
  const pdfs = form.pdf_files ?? [];

  return (
    <div className="border rounded-xl p-4 space-y-5">
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase">Media Detail Aset</p>
        <p className="text-xs text-gray-400 mt-1">Atur media yang akan muncul di halaman detail situs.</p>
      </div>

      <div className="space-y-2">
        <MediaHeader title={`Gambar (${images.length}/5)`}>
          <label className={`text-xs border rounded px-3 py-1.5 cursor-pointer ${images.length >= 5 ? 'opacity-40 pointer-events-none' : 'hover:bg-gray-50'}`}>
            {uploading === 'images' ? 'Mengupload...' : '+ Upload Gambar'}
            <input type="file" accept="image/*" className="hidden"
              onChange={e => onUpload('images', e.target.files?.[0])} />
          </label>
        </MediaHeader>
        <MediaList empty="Belum ada gambar">
          {images.map((item, index) => (
            <MediaEditor
              key={`${item.url}-${index}`}
              item={item}
              index={index}
              type="image"
              onUpdate={patch => onUpdate('images', index, patch)}
              onRemove={() => onRemove('images', index)}
            />
          ))}
        </MediaList>
      </div>

      <div className="space-y-2">
        <MediaHeader title={`YouTube (${videos.length}/2)`}>
          <button type="button" onClick={onAddYoutube} disabled={videos.length >= 2}
            className="text-xs border rounded px-3 py-1.5 hover:bg-gray-50 disabled:opacity-40">
            + Tambah Link
          </button>
        </MediaHeader>
        <MediaList empty="Belum ada link YouTube">
          {videos.map((item, index) => (
            <MediaEditor
              key={`${item.url}-${index}`}
              item={item}
              index={index}
              type="youtube"
              onUpdate={patch => onUpdate('youtube_links', index, patch)}
              onRemove={() => onRemove('youtube_links', index)}
            />
          ))}
        </MediaList>
      </div>

      <div className="space-y-2">
        <MediaHeader title={`PDF (${pdfs.length}/2)`}>
          <label className={`text-xs border rounded px-3 py-1.5 cursor-pointer ${pdfs.length >= 2 ? 'opacity-40 pointer-events-none' : 'hover:bg-gray-50'}`}>
            {uploading === 'pdf_files' ? 'Mengupload...' : '+ Upload PDF'}
            <input type="file" accept="application/pdf" className="hidden"
              onChange={e => onUpload('pdf_files', e.target.files?.[0])} />
          </label>
        </MediaHeader>
        <MediaList empty="Belum ada PDF">
          {pdfs.map((item, index) => (
            <MediaEditor
              key={`${item.url}-${index}`}
              item={item}
              index={index}
              type="pdf"
              onUpdate={patch => onUpdate('pdf_files', index, patch)}
              onRemove={() => onRemove('pdf_files', index)}
            />
          ))}
        </MediaList>
      </div>
    </div>
  );
}

function MediaHeader({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-xs font-semibold text-gray-500 uppercase">{title}</p>
      {children}
    </div>
  );
}

function MediaList({ empty, children }: { empty: string; children: React.ReactNode }) {
  const hasItems = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <div className="space-y-2">
      {hasItems ? children : <p className="text-xs text-gray-400 border rounded-lg px-3 py-3">{empty}</p>}
    </div>
  );
}

function MediaEditor({
  item,
  index,
  type,
  onUpdate,
  onRemove,
}: {
  item: HeritageMediaItem;
  index: number;
  type: 'image' | 'youtube' | 'pdf';
  onUpdate: (patch: Partial<HeritageMediaItem>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="border rounded-lg p-3 grid md:grid-cols-[92px_1fr_auto] gap-3 items-start">
      <MediaPreview item={item} type={type} />
      <div className="space-y-2 min-w-0">
        <input value={item.title ?? ''} onChange={e => onUpdate({ title: e.target.value })}
          className="w-full border rounded px-3 py-2 text-sm" placeholder={`Judul ${index + 1}`} />
        <input value={item.url ?? ''} onChange={e => onUpdate({ url: e.target.value })}
          className="w-full border rounded px-3 py-2 text-xs font-mono" placeholder={type === 'youtube' ? 'https://www.youtube.com/watch?v=...' : 'URL file'} />
        <label className="inline-flex items-center gap-2 text-xs text-gray-600">
          <input type="checkbox" checked={item.is_visible !== false}
            onChange={e => onUpdate({ is_visible: e.target.checked })} />
          Tampilkan di detail aset
        </label>
      </div>
      <button type="button" onClick={onRemove}
        className="text-xs bg-red-50 text-red-700 border border-red-200 px-3 py-2 rounded hover:bg-red-100">
        Hapus
      </button>
    </div>
  );
}

function MediaPreview({ item, type }: { item: HeritageMediaItem; type: 'image' | 'youtube' | 'pdf' }) {
  if (type === 'image' && item.url) {
    return <img src={item.url} alt="" className="w-full h-20 object-cover rounded border bg-gray-50" />;
  }

  if (type === 'youtube') {
    const id = getYoutubeId(item.url);
    return id
      ? <img src={`https://img.youtube.com/vi/${id}/mqdefault.jpg`} alt="" className="w-full h-20 object-cover rounded border bg-gray-50" />
      : <div className="h-20 rounded border bg-gray-50 flex items-center justify-center text-xs text-gray-400">YouTube</div>;
  }

  return <div className="h-20 rounded border bg-gray-50 flex items-center justify-center text-xs font-semibold text-red-600">PDF</div>;
}

function getYoutubeId(url?: string) {
  if (!url) return '';
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match?.[1] ?? '';
}

function cleanHeritageForm(form: Partial<HeritageSite>) {
  const images = cleanMedia(form.images).slice(0, 5);
  return {
    ...form,
    images,
    youtube_links: cleanMedia(form.youtube_links).slice(0, 2),
    pdf_files: cleanMedia(form.pdf_files).slice(0, 2),
    image_url: form.image_url || images[0]?.url,
  };
}

function cleanMedia(items?: HeritageMediaItem[]) {
  return (items ?? [])
    .filter(item => item.url?.trim())
    .map(item => ({
      url: item.url.trim(),
      title: item.title?.trim() || undefined,
      is_visible: item.is_visible !== false,
    }));
}
