'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api, GuideDashboard } from '@/lib/api';
import { GuideEmpty, GuideError, GuideLoading } from '@/components/guide/GuidePageState';
import { activeItem, currentGuideStatus, formatDuration, formatTime, tripStatusLabels, tripTitle } from '@/components/guide/guide-utils';
import { useBackendReadiness } from '@/components/providers/BackendReadinessProvider';

export default function GuideHomePage() {
  const { status: backendStatus } = useBackendReadiness();
  const [data, setData] = useState<GuideDashboard | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api.guide.dashboard());
      setError('');
    } catch (err: any) {
      setError(err.message ?? 'Gagal memuat beranda Guide');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (backendStatus !== 'ready') return;
    load();
    const timer = window.setInterval(load, 20_000);
    return () => window.clearInterval(timer);
  }, [backendStatus, load]);

  if (loading && !data) return <GuideLoading />;
  if (error && !data) return <GuideError message={error} retry={load} />;
  if (!data) return null;

  const hour = new Date().getHours();
  const greeting = hour < 11 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : hour < 18 ? 'Selamat sore' : 'Selamat malam';
  const trip = data.primary_trip;
  const current = trip ? activeItem(trip) : null;
  const destinationCount = trip?.itinerary_items?.filter((item) => item.stop_type === 'DESTINATION').length ?? 0;
  const route = trip?.route_snapshot;

  return (
    <main>
      <header className="rounded-b-[2rem] bg-[#1a3a2e] px-5 pb-9 pt-7 text-white">
        <p className="text-sm text-emerald-100">{greeting},</p>
        <h1 className="mt-1 text-2xl font-bold">{data.guide.name} 👋</h1>
        <div className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-full bg-white/10 px-4 text-sm font-semibold">
          <span className={`h-2.5 w-2.5 rounded-full ${data.summary.active ? 'bg-amber-400' : data.summary.upcoming ? 'bg-sky-400' : 'bg-emerald-400'}`} />
          {data.summary.active ? 'Sedang Bertugas' : data.summary.upcoming ? 'Siap Bertugas' : 'Belum Ada Tugas'}
        </div>
      </header>

      <div className="-mt-4 space-y-5 px-4">
        {trip ? (
          <section className="rounded-3xl bg-white p-5 shadow-[0_16px_45px_rgba(15,23,42,0.12)]">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.15em] text-emerald-700">{data.summary.active ? 'Tugas Aktif' : 'Tugas Terdekat'}</p>
            <h2 className="mt-3 text-xl font-bold leading-snug text-slate-900">{tripTitle(trip)}</h2>
            <p className="mt-1 text-sm font-bold text-slate-400">Booking: {trip.booking_reference}</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Metric label="Jadwal Wisatawan" value={formatTime(trip.scheduled_user_pickup_at)} />
              <Metric label="Peserta" value={`${trip.booking?.participants ?? 0} Orang`} />
              <Metric label="Driver" value={trip.driver?.name ?? '-'} />
              <Metric label="Sakoci" value={`${trip.sakoci?.code || trip.sakoci?.name} • ${trip.sakoci?.plate_number || '-'}`} />
            </div>
            <div className="mt-4 flex justify-between text-sm text-slate-500">
              <span>{destinationCount} Lokasi</span>
              <span>Estimasi {formatDuration(route?.total_duration_minutes ?? trip.estimated_duration_minutes)}</span>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-slate-50 p-4">
              <Metric label="Status Route" value={routeStatusLabel(route?.route_status)} />
              <Metric label="Jarak Snapshot" value={route?.total_distance_km ? `${Number(route.total_distance_km).toFixed(1)} km` : '-'} />
            </div>
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="text-xs text-slate-400">Status Kendaraan</p>
              <p className="mt-1 font-bold text-[#1a3a2e]">{tripStatusLabels[trip.trip_status]}{current && trip.trip_status.includes('DESTINATION') ? ` • ${current.name}` : ''}</p>
              <p className="mt-3 text-xs text-slate-400">Status Guide</p>
              <p className="mt-1 font-bold text-[#1a3a2e]">{currentGuideStatus(trip)}</p>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Link href={`/guide/tasks/${trip.id}`} className="flex min-h-12 items-center justify-center rounded-2xl bg-[#1a3a2e] font-bold text-white">Buka Tugas Aktif</Link>
              <Link href={`/guide/tasks/${trip.id}`} className="flex min-h-12 items-center justify-center rounded-2xl border border-[#1a3a2e] font-bold text-[#1a3a2e]">Lapor Kendala</Link>
            </div>
          </section>
        ) : (
          <GuideEmpty title="Belum ada tugas wisata hari ini 🗺️" description="Tugas baru dari Admin akan muncul otomatis di halaman ini." />
        )}
        <section className="rounded-3xl bg-white p-5 shadow-sm">
          <h2 className="text-sm font-bold text-slate-800">Fokus Pendampingan</h2>
          <p className="mt-2 text-sm text-slate-500">Guide memakai itinerary final dari Admin dan tidak menghitung ulang route. Materi destinasi tersedia di detail tugas.</p>
        </section>
        <section>
          <h2 className="px-1 text-sm font-bold text-slate-800">Ringkasan Tugas</h2>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Summary label="Tugas Hari Ini" value={data.summary.today} color="bg-sky-50 text-sky-700" />
            <Summary label="Tugas Aktif" value={data.summary.active} color="bg-amber-50 text-amber-700" />
            <Summary label="Tugas Mendatang" value={data.summary.upcoming} color="bg-violet-50 text-violet-700" />
            <Summary label="Tugas Selesai" value={data.summary.completed} color="bg-emerald-50 text-emerald-700" />
          </div>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[11px] font-bold uppercase text-slate-400">{label}</p><p className="mt-1 font-bold text-slate-800">{value}</p></div>;
}

function Summary({ label, value, color }: { label: string; value: number; color: string }) {
  return <div className={`rounded-2xl p-4 ${color}`}><p className="text-2xl font-black">{value}</p><p className="mt-1 text-xs font-semibold">{label}</p></div>;
}

function routeStatusLabel(status?: string | null) {
  if (status === 'final') return 'Final';
  if (status === 'stale') return 'Perlu Diperbarui';
  if (status === 'failed') return 'Gagal';
  return 'Belum Tersedia';
}
