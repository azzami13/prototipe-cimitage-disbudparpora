'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, DriverTrip } from '@/lib/api';
import GuideTripCard from '@/components/guide/GuideTripCard';
import { GuideEmpty, GuideError, GuideLoading } from '@/components/guide/GuidePageState';

const tabs = [
  { key: 'upcoming', label: 'Mendatang' },
  { key: 'active', label: 'Aktif' },
  { key: 'completed', label: 'Selesai' },
] as const;

export default function GuideTasksPage() {
  const [active, setActive] = useState<(typeof tabs)[number]['key']>('active');
  const [trips, setTrips] = useState<DriverTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTrips(await api.guide.tasks(active));
      setError('');
    } catch (err: any) {
      setError(err.message ?? 'Gagal memuat tugas');
    } finally {
      setLoading(false);
    }
  }, [active]);

  useEffect(() => { load(); }, [load]);

  return (
    <main className="px-4 py-5">
      <h1 className="text-2xl font-bold text-[#1a3a2e]">Tugas Guide</h1>
      <div className="mt-4 grid grid-cols-3 rounded-2xl bg-white p-1 shadow-sm">
        {tabs.map((tab) => <button key={tab.key} onClick={() => setActive(tab.key)} className={`min-h-11 rounded-xl text-sm font-bold ${active === tab.key ? 'bg-[#1a3a2e] text-white' : 'text-slate-500'}`}>{tab.label}</button>)}
      </div>
      <div className="mt-5 space-y-4">
        {loading ? <GuideLoading text="Memuat tugas..." /> : error ? <GuideError message={error} retry={load} /> : trips.length ? trips.map((trip) => <GuideTripCard key={trip.id} trip={trip} />) : <GuideEmpty title="Belum ada tugas" description="Tugas pada kategori ini akan muncul setelah Admin melakukan assignment." />}
      </div>
    </main>
  );
}
