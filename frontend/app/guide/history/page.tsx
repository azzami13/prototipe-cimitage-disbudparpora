'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import GuideTripCard from '@/components/guide/GuideTripCard';
import { GuideEmpty, GuideError, GuideLoading } from '@/components/guide/GuidePageState';
import { api, DriverTrip } from '@/lib/api';

const filters = ['Hari Ini', 'Minggu Ini', 'Bulan Ini', 'Semua'] as const;

export default function GuideHistoryPage() {
  const [trips, setTrips] = useState<DriverTrip[]>([]);
  const [filter, setFilter] = useState<(typeof filters)[number]>('Semua');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTrips(await api.guide.history());
      setError('');
    } catch (err: any) {
      setError(err.message ?? 'Gagal memuat riwayat');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const now = new Date();
    return trips.filter((trip) => {
      if (filter === 'Semua') return true;
      const date = new Date(trip.completed_at ?? trip.driver_ready_at);
      const diff = now.getTime() - date.getTime();
      if (filter === 'Hari Ini') return date.toDateString() === now.toDateString();
      if (filter === 'Minggu Ini') return diff <= 7 * 24 * 60 * 60 * 1000;
      return diff <= 31 * 24 * 60 * 60 * 1000;
    });
  }, [filter, trips]);

  return (
    <main className="px-4 py-5">
      <h1 className="text-2xl font-bold text-[#1a3a2e]">Riwayat Guide</h1>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {filters.map((item) => <button key={item} onClick={() => setFilter(item)} className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-bold ${filter === item ? 'bg-[#1a3a2e] text-white' : 'bg-white text-slate-500'}`}>{item}</button>)}
      </div>
      <div className="mt-5 space-y-4">
        {loading ? <GuideLoading text="Memuat riwayat..." /> : error ? <GuideError message={error} retry={load} /> : filtered.length ? filtered.map((trip) => <GuideTripCard key={trip.id} trip={trip} />) : <GuideEmpty title="Belum ada riwayat" description="Trip selesai milik Anda akan muncul di sini." />}
      </div>
    </main>
  );
}
