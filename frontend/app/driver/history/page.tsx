'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, DriverTrip } from '@/lib/api';
import DriverTripCard from '@/components/driver/DriverTripCard';
import { DriverEmpty, DriverError, DriverLoading } from '@/components/driver/DriverPageState';

const filters = ['Hari Ini', 'Minggu Ini', 'Bulan Ini', 'Semua'] as const;

export default function DriverHistoryPage() {
  const [items, setItems] = useState<DriverTrip[]>([]);
  const [filter, setFilter] = useState<(typeof filters)[number]>('Bulan Ini');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true);
    try { setItems(await api.driver.history()); setError(''); }
    catch (err: any) { setError(err.message ?? 'Gagal memuat riwayat'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const filtered = useMemo(() => items.filter((trip) => {
    if (filter === 'Semua') return true;
    const completed = new Date(trip.completed_at ?? trip.updated_at);
    const now = new Date();
    if (filter === 'Hari Ini') return completed.toDateString() === now.toDateString();
    if (filter === 'Minggu Ini') return now.getTime() - completed.getTime() <= 7 * 86_400_000;
    return completed.getMonth() === now.getMonth() && completed.getFullYear() === now.getFullYear();
  }), [items, filter]);
  return (
    <main>
      <header className="bg-[#1a3a2e] px-5 pb-6 pt-7 text-white">
        <h1 className="text-2xl font-bold">Riwayat Perjalanan</h1>
        <p className="mt-1 text-sm text-emerald-100">Trip yang telah Anda selesaikan.</p>
      </header>
      <div className="overflow-x-auto px-4 py-4">
        <div className="flex min-w-max gap-2">
          {filters.map((item) => <button key={item} onClick={() => setFilter(item)} className={`min-h-11 rounded-full px-4 text-sm font-bold ${filter === item ? 'bg-[#1a3a2e] text-white' : 'bg-white text-slate-500'}`}>{item}</button>)}
        </div>
      </div>
      <div className="space-y-4 px-4">
        {loading ? <DriverLoading /> : error ? <DriverError message={error} retry={load} /> :
          filtered.length ? filtered.map((trip) => <DriverTripCard key={trip.id} trip={trip} />) :
          <DriverEmpty title="Belum ada riwayat perjalanan" description="Perjalanan yang selesai akan tersimpan di halaman ini." icon="◷" />}
      </div>
    </main>
  );
}
