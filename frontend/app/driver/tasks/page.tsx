'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, DriverTrip } from '@/lib/api';
import DriverTripCard from '@/components/driver/DriverTripCard';
import { DriverEmpty, DriverError, DriverLoading } from '@/components/driver/DriverPageState';

const tabs = [
  { key: 'upcoming', label: 'Mendatang' },
  { key: 'active', label: 'Aktif' },
  { key: 'completed', label: 'Selesai' },
] as const;

export default function DriverTasksPage() {
  const [tab, setTab] = useState<(typeof tabs)[number]['key']>('active');
  const [trips, setTrips] = useState<DriverTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTrips(await api.driver.tasks(tab));
      setError('');
    } catch (err: any) {
      setError(err.message ?? 'Gagal memuat daftar tugas');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  return (
    <main>
      <header className="bg-[#1a3a2e] px-5 pb-6 pt-7 text-white">
        <p className="text-sm text-emerald-100">Operasional Driver</p>
        <h1 className="mt-1 text-2xl font-bold">Tugas Saya</h1>
      </header>
      <div className="sticky top-0 z-20 bg-[#f7faf8]/95 px-4 py-3 backdrop-blur">
        <div className="grid grid-cols-3 rounded-2xl bg-emerald-50 p-1">
          {tabs.map((item) => (
            <button key={item.key} onClick={() => setTab(item.key)}
              className={`min-h-11 rounded-xl text-sm font-bold ${tab === item.key ? 'bg-white text-[#1a3a2e] shadow-sm' : 'text-slate-400'}`}>
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-4 px-4 py-2">
        {loading ? <DriverLoading text="Memuat tugas..." /> :
          error ? <DriverError message={error} retry={load} /> :
          trips.length ? trips.map((trip) => <DriverTripCard key={trip.id} trip={trip} />) :
          <DriverEmpty title={`Belum ada tugas ${tabs.find((item) => item.key === tab)?.label.toLowerCase()}`} description="Assignment dari Admin akan muncul di sini." />}
      </div>
    </main>
  );
}
