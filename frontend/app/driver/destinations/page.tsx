'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, HeritageSite } from '@/lib/api';
import { DriverEmpty, DriverError, DriverLoading } from '@/components/driver/DriverPageState';
import BackendAssetImage from '@/components/ui/BackendAssetImage';

export default function DriverDestinationsPage() {
  const [items, setItems] = useState<HeritageSite[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await api.driver.destinations()); setError(''); }
    catch (err: any) { setError(err.message ?? 'Gagal memuat destinasi'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const filtered = useMemo(() => items.filter((item) =>
    `${item.name} ${item.address ?? ''} ${item.kecamatan ?? ''}`.toLowerCase().includes(query.toLowerCase()),
  ), [items, query]);

  return (
    <main>
      <header className="bg-[#1a3a2e] px-5 pb-7 pt-7 text-white">
        <h1 className="text-2xl font-bold">Daftar Destinasi</h1>
        <p className="mt-1 text-sm text-emerald-100">Informasi lokasi heritage untuk kebutuhan perjalanan.</p>
        <div className="mt-5 flex min-h-12 items-center rounded-2xl bg-white px-4 text-slate-700 shadow-lg">
          <span className="mr-3">⌕</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari destinasi..." className="w-full bg-transparent text-sm outline-none" />
        </div>
      </header>
      <div className="space-y-4 px-4 py-5">
        {loading ? <DriverLoading /> : error ? <DriverError message={error} retry={load} /> :
          filtered.length ? filtered.map((site) => <DestinationCard key={site.id} site={site} />) :
          <DriverEmpty title="Destinasi tidak ditemukan" description="Coba gunakan kata pencarian yang berbeda." icon="⌖" />}
      </div>
    </main>
  );
}

function DestinationCard({ site }: { site: HeritageSite }) {
  const maps = Number.isFinite(Number(site.latitude)) && Number.isFinite(Number(site.longitude))
    ? `https://www.google.com/maps/dir/?api=1&destination=${site.latitude},${site.longitude}`
    : '';
  return (
    <article className="overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-sm">
      {site.image_url ? <BackendAssetImage src={site.image_url} alt="" className="h-40 w-full object-cover" /> :
        <div className="grid h-32 place-items-center bg-emerald-50 text-5xl">🏛</div>}
      <div className="p-5">
        <h2 className="text-lg font-bold text-slate-900">{site.name}</h2>
        <p className="mt-1 text-sm text-slate-500">{site.address ?? site.kecamatan ?? '-'}</p>
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{site.description ?? 'Informasi destinasi heritage Cimahi.'}</p>
        <div className="mt-4 rounded-2xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">
          <strong>Catatan Driver</strong><br />Perhatikan akses kendaraan dan gunakan titik berhenti yang aman.
        </div>
        {maps && <a href={maps} target="_blank" rel="noreferrer" className="mt-4 flex min-h-11 items-center justify-center rounded-xl border border-[#1a3a2e] font-bold text-[#1a3a2e]">Buka Navigasi</a>}
      </div>
    </article>
  );
}
