'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, GuideDestinationsResponse, HeritageSite } from '@/lib/api';
import { GuideError, GuideLoading } from '@/components/guide/GuidePageState';
import { formatDate, guideSessionLabels } from '@/components/guide/guide-utils';
import BackendAssetImage from '@/components/ui/BackendAssetImage';

export default function GuideDestinationsPage() {
  const [data, setData] = useState<GuideDestinationsResponse | null>(null);
  const [tab, setTab] = useState<'mine' | 'all'>('mine');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api.guide.destinations());
      setError('');
    } catch (err: any) {
      setError(err.message ?? 'Gagal memuat destinasi');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!loading && data && data.task_destinations.length === 0) {
      setTab('all');
    }
  }, [data, loading]);

  const all = useMemo(() => {
    const items = data?.all_destinations ?? [];
    const q = query.trim().toLowerCase();
    return q ? items.filter((site) => `${site.name} ${site.category} ${site.address ?? ''}`.toLowerCase().includes(q)) : items;
  }, [data, query]);

  if (loading && !data) return <GuideLoading text="Memuat destinasi..." />;
  if (error && !data) return <GuideError message={error} retry={load} />;

  return (
    <main className="px-4 py-5">
      <h1 className="text-2xl font-bold text-[#1a3a2e]">Destinasi</h1>
      <div className="mt-4 grid grid-cols-2 rounded-2xl bg-white p-1 shadow-sm">
        <button onClick={() => setTab('mine')} className={`min-h-11 rounded-xl text-sm font-bold ${tab === 'mine' ? 'bg-[#1a3a2e] text-white' : 'text-slate-500'}`}>Destinasi Tugas Saya</button>
        <button onClick={() => setTab('all')} className={`min-h-11 rounded-xl text-sm font-bold ${tab === 'all' ? 'bg-[#1a3a2e] text-white' : 'text-slate-500'}`}>Semua Destinasi</button>
      </div>
      {tab === 'all' && <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari situs, kategori, lokasi..." className="mt-4 min-h-12 w-full rounded-2xl border border-slate-200 px-4 text-sm" />}
      <div className="mt-5 space-y-4">
        {tab === 'mine'
          ? (data?.task_destinations?.length ? data.task_destinations.map((item) => (
            <article key={`${item.trip_id}-${item.id}`} className="rounded-3xl bg-white p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">{item.booking_reference} • {formatDate(item.scheduled_user_pickup_at)}</p>
              <h2 className="mt-2 text-lg font-bold text-slate-900">{item.name}</h2>
              <p className="mt-1 text-sm text-slate-500">{item.address ?? '-'}</p>
              <p className="mt-3 text-sm font-bold text-[#1a3a2e]">Sesi Guide: {item.guide_session ? guideSessionLabels[item.guide_session.session_status] : '-'}</p>
              <div className="mt-4 grid gap-2">
                {item.heritage_site_id && <Link href={`/guide/destinations/${item.heritage_site_id}`} className="flex min-h-11 items-center justify-center rounded-2xl bg-[#1a3a2e] text-sm font-bold text-white">Lihat Materi Situs</Link>}
                {item.latitude && item.longitude && <a href={`https://www.google.com/maps?q=${item.latitude},${item.longitude}`} target="_blank" rel="noreferrer" className="flex min-h-11 items-center justify-center rounded-2xl border border-[#1a3a2e] text-sm font-bold text-[#1a3a2e]">Buka Navigasi</a>}
              </div>
            </article>
          )) : <Empty />)
          : (all.length ? all.map((site) => <SiteCard key={site.id} site={site} />) : <Empty />)}
      </div>
    </main>
  );
}

function SiteCard({ site }: { site: HeritageSite }) {
  return (
    <article className="rounded-3xl bg-white p-5 shadow-sm">
      {site.image_url && <BackendAssetImage src={site.image_url} alt={site.name} className="mb-4 h-36 w-full rounded-2xl object-cover" />}
      <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">{site.category}</p>
      <h2 className="mt-2 text-lg font-bold text-slate-900">{site.name}</h2>
      <p className="mt-1 line-clamp-3 text-sm text-slate-500">{site.description || site.address || '-'}</p>
      <div className="mt-4 grid gap-2">
        <Link href={`/guide/destinations/${site.id}`} className="flex min-h-11 items-center justify-center rounded-2xl bg-[#1a3a2e] text-sm font-bold text-white">Lihat Detail Situs</Link>
        {site.latitude && site.longitude && <a href={`https://www.google.com/maps?q=${site.latitude},${site.longitude}`} target="_blank" rel="noreferrer" className="flex min-h-11 items-center justify-center rounded-2xl border border-[#1a3a2e] text-sm font-bold text-[#1a3a2e]">Buka Navigasi</a>}
      </div>
    </article>
  );
}

function Empty() {
  return <section className="rounded-3xl bg-white p-6 text-center text-sm text-slate-500 shadow-sm">Belum ada destinasi untuk ditampilkan.</section>;
}
