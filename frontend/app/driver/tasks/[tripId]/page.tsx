'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { api, DriverTrip, TripActionBody } from '@/lib/api';
import { DriverError, DriverLoading } from '@/components/driver/DriverPageState';
import { useBackendReadiness } from '@/components/providers/BackendReadinessProvider';
import {
  actionForTrip,
  activeItem,
  formatDuration,
  formatTime,
  tripStatusLabels,
  tripTitle,
} from '@/components/driver/driver-utils';

const DriverTripMap = dynamic(() => import('@/components/driver/DriverTripMap'), {
  ssr: false,
  loading: () => <div className="h-[330px] w-full rounded-3xl bg-slate-200" />,
});

const issueTypes = [
  'Kendaraan Bermasalah',
  'Macet Berat',
  'Jalan Ditutup',
  'Wisatawan Belum Hadir',
  'Lokasi Penjemputan Berubah',
  'GPS Bermasalah',
  'Lainnya',
];

export default function DriverTaskDetailPage() {
  const { status: backendStatus } = useBackendReadiness();
  const params = useParams();
  const tripId = Number(params.tripId);
  const [trip, setTrip] = useState<DriverTrip | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [position, setPosition] = useState<{ latitude: number; longitude: number; accuracy?: number } | null>(null);
  const [trackingError, setTrackingError] = useState('');
  const [locationUpdatedAt, setLocationUpdatedAt] = useState<Date | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [issueType, setIssueType] = useState(issueTypes[0]);
  const [issueNote, setIssueNote] = useState('');
  const watchId = useRef<number | null>(null);
  const lastSent = useRef(0);

  const load = useCallback(async (silent = false) => {
    if (!Number.isInteger(tripId) || tripId < 1) {
      setError('Nomor trip tidak valid');
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    try {
      setTrip(await api.driver.task(tripId));
      setError('');
    } catch (err: any) {
      setError(err.message ?? 'Gagal memuat detail tugas');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    if (backendStatus !== 'ready') return;
    load();
    const timer = window.setInterval(() => load(true), 15_000);
    return () => window.clearInterval(timer);
  }, [backendStatus, load]);

  const stopTracking = useCallback(() => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
  }, []);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setTrackingError('Perangkat tidak mendukung GPS.');
      return;
    }
    if (watchId.current !== null) return;
    setTrackingError('');
    watchId.current = navigator.geolocation.watchPosition(
      async (result) => {
        const next = {
          latitude: result.coords.latitude,
          longitude: result.coords.longitude,
          accuracy: result.coords.accuracy,
        };
        setPosition(next);
        const now = Date.now();
        if (now - lastSent.current < 10_000) return;
        lastSent.current = now;
        try {
          await api.driver.location(tripId, {
            ...next,
            speed_kmh: result.coords.speed == null ? null : result.coords.speed * 3.6,
            heading: result.coords.heading,
          });
          setLocationUpdatedAt(new Date());
          setTrackingError('');
        } catch (err: any) {
          setTrackingError(err.message ?? 'Lokasi belum dapat diperbarui');
        }
      },
      (gpsError) => setTrackingError(gpsError.message || 'Periksa GPS dan izin lokasi perangkat.'),
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
    );
  }, [tripId]);

  useEffect(() => {
    if (trip?.tracking_active && !['COMPLETED', 'CANCELLED'].includes(trip.trip_status)) startTracking();
    else stopTracking();
    return stopTracking;
  }, [trip?.tracking_active, trip?.trip_status, startTracking, stopTracking]);

  const primaryAction = trip ? actionForTrip(trip) : null;
  const current = trip ? activeItem(trip) : null;
  const currentGuideSession = trip && current
    ? trip.guide_sessions?.find((session) => session.itinerary_item_id === current.id)
    : null;
  const guideBlocksNext = Boolean(
    trip?.tour_guide_id &&
    primaryAction &&
    ['START_NEXT_STOP', 'COMPLETE_TRIP'].includes(primaryAction.action) &&
    current?.stop_type === 'DESTINATION' &&
    currentGuideSession &&
    !['COMPLETED', 'SKIPPED'].includes(currentGuideSession.session_status),
  );
  const nearDestination = useMemo(() => {
    if (!position || !current?.latitude || !current?.longitude) return false;
    return distanceKm(position.latitude, position.longitude, Number(current.latitude), Number(current.longitude)) <= 0.25;
  }, [position, current]);

  const runAction = async () => {
    if (!trip || !primaryAction) return;
    if (primaryAction.confirm && !window.confirm(`Konfirmasi: ${primaryAction.label}?`)) return;
    setSaving(true);
    try {
      const body: TripActionBody = {
        action: primaryAction.action,
        itineraryItemId: primaryAction.itineraryItemId,
        nextItineraryItemId: primaryAction.nextItineraryItemId,
        latitude: position?.latitude,
        longitude: position?.longitude,
      };
      const updated = await api.driver.action(trip.id, body);
      setTrip(updated);
      if (primaryAction.action === 'START_TO_PICKUP') startTracking();
    } catch (err: any) {
      alert(err.message ?? 'Aksi perjalanan gagal');
      await load(true);
    } finally {
      setSaving(false);
    }
  };

  const reportIssue = async () => {
    if (!trip || !issueNote.trim()) return alert('Catatan kendala wajib diisi');
    setSaving(true);
    try {
      await api.driver.incident(trip.id, {
        issue_type: issueType,
        description: issueNote.trim(),
        latitude: position?.latitude,
        longitude: position?.longitude,
      });
      setIssueNote('');
      setHelpOpen(false);
      await load(true);
      alert('Laporan kendala berhasil dikirim ke Admin.');
    } catch (err: any) {
      alert(err.message ?? 'Laporan gagal dikirim');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !trip) return <DriverLoading text="Membuka tugas..." />;
  if (error && !trip) return <DriverError message={error} retry={() => load()} />;
  if (!trip) return null;

  const lastLocation = locationUpdatedAt
    ?? (trip.booking?.vehicle_location_updated_at ? new Date(trip.booking.vehicle_location_updated_at) : null);
  const mapPosition = position
    ?? (
      trip.booking?.vehicle_latitude && trip.booking?.vehicle_longitude
        ? { latitude: Number(trip.booking.vehicle_latitude), longitude: Number(trip.booking.vehicle_longitude) }
        : trip.sakoci?.latitude && trip.sakoci?.longitude
          ? { latitude: Number(trip.sakoci.latitude), longitude: Number(trip.sakoci.longitude) }
          : null
    );
  const mapsUrl = current?.latitude && current?.longitude
    ? `https://www.google.com/maps/dir/?api=1&destination=${current.latitude},${current.longitude}&travelmode=driving`
    : '';

  return (
    <main className="pb-32">
      <header className="bg-[#1a3a2e] px-4 pb-6 pt-4 text-white">
        <div className="flex min-h-11 items-center justify-between">
          <Link href="/driver/tasks" className="flex min-h-11 items-center px-1 text-sm font-semibold text-emerald-100">← Kembali</Link>
          <button onClick={() => setHelpOpen(true)} className="min-h-11 rounded-xl bg-white/10 px-4 text-sm font-bold">? Bantuan</button>
        </div>
        <p className="mt-3 text-xs font-bold uppercase tracking-[0.15em] text-emerald-200">
          {trip.trip_status === 'COMPLETED' ? 'Riwayat Tugas' : 'Tugas Aktif'}
        </p>
        <h1 className="mt-1 text-xl font-bold">{trip.booking_reference}</h1>
        <p className="mt-2 text-sm text-emerald-100">{tripTitle(trip)}</p>
        <p className="text-sm text-emerald-100">{trip.sakoci?.code || trip.sakoci?.name} • {trip.sakoci?.plate_number || '-'}</p>
      </header>

      <div className="space-y-4 px-4 py-5">
        {trip.trip_status === 'CANCELLED' && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <strong>Assignment dibatalkan Admin.</strong><br />{trip.cancellation_reason}
          </div>
        )}
        <section className="rounded-3xl bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Status Saat Ini</p>
          <h2 className="mt-2 text-xl font-bold text-[#1a3a2e]">
            {trip.trip_status.includes('EN_ROUTE') ? '🛣️ ' : trip.trip_status === 'COMPLETED' ? '✓ ' : '● '}
            {tripStatusLabels[trip.trip_status]}{current && ['EN_ROUTE_TO_DESTINATION', 'AT_DESTINATION'].includes(trip.trip_status) ? ` • ${current.name}` : ''}
          </h2>
        </section>

        <section className="grid grid-cols-3 gap-2 rounded-3xl bg-white p-4 shadow-sm">
          <TimeInfo label="Driver Wajib Siap" value={formatTime(trip.driver_ready_at)} />
          <TimeInfo label="Jadwal Wisatawan" value={formatTime(trip.scheduled_user_pickup_at)} />
          <TimeInfo label="Estimasi" value={formatDuration(trip.estimated_duration_minutes)} />
        </section>

        {trip.tracking_active ? (
          <section className={`rounded-2xl border p-4 ${trackingError ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
            <p className={`font-bold ${trackingError ? 'text-amber-800' : 'text-emerald-800'}`}>
              {trackingError ? '⚠ Lokasi belum dapat diperbarui' : '● Tracking Sakoci Aktif'}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              {trackingError || (lastLocation ? `Lokasi terakhir diperbarui ${lastLocation.toLocaleTimeString('id-ID')} WIB` : 'Menunggu pembaruan GPS...')}
            </p>
            {trackingError && <button onClick={startTracking} className="mt-3 min-h-11 rounded-xl bg-amber-700 px-4 text-sm font-bold text-white">Coba Lagi</button>}
          </section>
        ) : (
          <section className="rounded-2xl bg-slate-100 p-4 text-sm text-slate-500">
            Tracking akan aktif setelah Anda mulai menuju lokasi penjemputan.
          </section>
        )}

        <DriverTripMap trip={trip} currentPosition={mapPosition} />

        {current && (
          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Tujuan Aktif</p>
            <h2 className="mt-2 text-lg font-bold text-slate-900">{current.name}</h2>
            <p className="mt-1 text-sm text-slate-500">{current.address ?? '-'}</p>
            {position && current.latitude && current.longitude && (
              <div className="mt-4 flex justify-between rounded-2xl bg-slate-50 p-3 text-sm">
                <span className="text-slate-400">Jarak perkiraan</span>
                <strong>{distanceKm(position.latitude, position.longitude, Number(current.latitude), Number(current.longitude)).toFixed(1)} km</strong>
              </div>
            )}
            {nearDestination && (
              <div className="mt-3 rounded-2xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">
                Anda tampaknya sudah dekat dengan {current.name}.
              </div>
            )}
            {mapsUrl && <a href={mapsUrl} target="_blank" rel="noreferrer" className="mt-4 flex min-h-12 items-center justify-center rounded-2xl border border-[#1a3a2e] font-bold text-[#1a3a2e]">Buka Navigasi</a>}
          </section>
        )}

        {trip.tour_guide_id && current?.stop_type === 'DESTINATION' && (
          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Status Tour Guide</p>
            <h2 className="mt-2 text-lg font-bold text-[#1a3a2e]">{guideStatusLabel(currentGuideSession?.session_status)}</h2>
            {guideBlocksNext && <p className="mt-2 rounded-2xl bg-amber-50 p-3 text-sm text-amber-800">Menunggu Tour Guide menyelesaikan sesi destinasi.</p>}
          </section>
        )}

        <section className="rounded-3xl bg-white p-5 shadow-sm">
          <h2 className="font-bold text-slate-900">Progress Rute</h2>
          <div className="mt-4 space-y-1">
            {[...(trip.itinerary_items ?? [])].sort((a, b) => a.sequence - b.sequence).map((item, index) => {
              const active = item.id === trip.current_itinerary_item_id && !['COMPLETED', 'SKIPPED'].includes(item.stop_status);
              const done = item.stop_status === 'COMPLETED';
              const skipped = item.stop_status === 'SKIPPED';
              return (
                <div key={item.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className={`grid h-8 w-8 place-items-center rounded-full text-sm font-bold ${done ? 'bg-emerald-600 text-white' : skipped ? 'bg-red-100 text-red-700' : active ? 'bg-amber-400 text-white' : 'bg-slate-100 text-slate-400'}`}>
                      {done ? '✓' : skipped ? '!' : active ? '→' : '○'}
                    </span>
                    {index < trip.itinerary_items.length - 1 && <span className="h-8 w-0.5 bg-slate-100" />}
                  </div>
                  <div className="pt-1">
                    <p className={`text-sm font-bold ${active ? 'text-amber-700' : 'text-slate-700'}`}>{item.name}</p>
                    <p className="text-xs text-slate-400">{item.stop_type === 'PICKUP' ? 'Titik Penjemputan' : item.stop_type === 'ENDPOINT' ? 'Titik Akhir' : `Destinasi ${item.sequence}`}</p>
                    {item.skip_reason && <p className="mt-1 text-xs text-red-600">{item.skip_reason}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {trip.incidents?.length > 0 && (
          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <h2 className="font-bold text-slate-900">Laporan Kendala</h2>
            {trip.incidents.map((incident) => (
              <div key={incident.id} className="mt-3 rounded-2xl bg-amber-50 p-3 text-sm">
                <div className="flex justify-between gap-2"><strong>{incident.issue_type}</strong><span className="text-xs text-amber-700">{incident.status}</span></div>
                <p className="mt-1 text-slate-600">{incident.description}</p>
              </div>
            ))}
          </section>
        )}
      </div>

      {primaryAction && (
        <div className="fixed inset-x-0 bottom-[72px] z-40 mx-auto max-w-xl border-t border-emerald-100 bg-white/95 p-3 backdrop-blur">
          <button onClick={runAction} disabled={saving || guideBlocksNext}
            className={`min-h-14 w-full rounded-2xl px-4 font-bold text-white shadow-lg disabled:opacity-50 ${nearDestination ? 'bg-amber-500 ring-4 ring-amber-100' : 'bg-[#1a3a2e]'}`}>
            {saving ? 'Memproses...' : primaryAction.label}
          </button>
        </div>
      )}

      {helpOpen && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50">
          <button className="absolute inset-0" onClick={() => setHelpOpen(false)} aria-label="Tutup bantuan" />
          <section className="relative z-10 max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-t-[2rem] bg-white p-5 pb-8">
            <div className="mx-auto h-1.5 w-12 rounded-full bg-slate-200" />
            <div className="mt-5 flex items-center justify-between">
              <h2 className="text-xl font-bold">Bantuan & Laporan Kendala</h2>
              <button onClick={() => setHelpOpen(false)} className="grid h-11 w-11 place-items-center rounded-full bg-slate-100">×</button>
            </div>
            <label className="mt-5 block text-sm font-bold text-slate-700">Jenis Kendala</label>
            <select value={issueType} onChange={(event) => setIssueType(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 px-3 text-sm">
              {issueTypes.map((item) => <option key={item}>{item}</option>)}
            </select>
            <label className="mt-4 block text-sm font-bold text-slate-700">Catatan</label>
            <textarea value={issueNote} onChange={(event) => setIssueNote(event.target.value)} rows={4} placeholder="Jelaskan kendala yang sedang terjadi..." className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm" />
            <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
              Lokasi saat ini: {position ? `${position.latitude.toFixed(6)}, ${position.longitude.toFixed(6)}` : 'belum tersedia'}
            </div>
            <button onClick={reportIssue} disabled={saving} className="mt-5 min-h-12 w-full rounded-2xl bg-[#1a3a2e] font-bold text-white disabled:opacity-50">
              Kirim Laporan
            </button>
            <a href="tel:112" className="mt-3 flex min-h-12 items-center justify-center rounded-2xl border border-emerald-800 font-bold text-emerald-800">Hubungi Admin Operasional</a>
          </section>
        </div>
      )}
    </main>
  );
}

function guideStatusLabel(status?: string | null) {
  if (status === 'READY' || status === 'PENDING') return 'Menunggu Sesi Guide Dimulai';
  if (status === 'IN_PROGRESS') return 'Sesi Penjelasan Berlangsung';
  if (status === 'COMPLETED') return '✓ Peserta Siap Melanjutkan';
  if (status === 'SKIPPED') return 'Sesi Guide Dilewati';
  return 'Belum Ada Sesi Guide';
}

function TimeInfo({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[10px] font-bold uppercase leading-4 text-slate-400">{label}</p><p className="mt-1 text-sm font-bold text-slate-800">{value}</p></div>;
}

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const radius = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
