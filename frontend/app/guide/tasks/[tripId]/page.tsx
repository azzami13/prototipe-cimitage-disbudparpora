'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { api, DriverTrip, HeritageSite } from '@/lib/api';
import { GuideError, GuideLoading } from '@/components/guide/GuidePageState';
import { useBackendReadiness } from '@/components/providers/BackendReadinessProvider';
import BackendAssetImage from '@/components/ui/BackendAssetImage';
import { activeItem, currentGuideStatus, formatDuration, formatTime, guideSessionLabels, sessionForItem, tripStatusLabels, tripTitle } from '@/components/guide/guide-utils';

const issueTypes = ['Wisatawan Belum Hadir', 'Peserta Terpisah', 'Lokasi Ditutup', 'Lokasi Tidak Dapat Dikunjungi', 'Perubahan Rute', 'Cuaca Buruk', 'Kendala Kesehatan Peserta', 'Panduan Materi Destinasi', 'Lainnya'];

const DriverTripMap = dynamic(() => import('@/components/driver/DriverTripMap'), {
  ssr: false,
  loading: () => <div className="h-[330px] w-full rounded-3xl bg-slate-200" />,
});

export default function GuideTaskDetailPage() {
  const { status: backendStatus } = useBackendReadiness();
  const params = useParams();
  const tripId = Number(params.tripId);
  const [trip, setTrip] = useState<DriverTrip | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notes, setNotes] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);
  const [issueType, setIssueType] = useState(issueTypes[0]);
  const [issueNote, setIssueNote] = useState('');
  const [position, setPosition] = useState<{ latitude: number; longitude: number } | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!Number.isInteger(tripId) || tripId < 1) {
      setError('Nomor trip tidak valid');
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    try {
      const data = await api.guide.task(tripId);
      setTrip(data);
      const current = activeItem(data);
      setNotes(sessionForItem(data, current)?.notes ?? '');
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
    const timer = window.setInterval(() => load(true), 12_000);
    return () => window.clearInterval(timer);
  }, [backendStatus, load]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((result) => {
      setPosition({ latitude: result.coords.latitude, longitude: result.coords.longitude });
    });
  }, []);

  const current = trip ? activeItem(trip) : null;
  const currentSession = trip ? sessionForItem(trip, current) : null;
  const currentMaterial = current ? (current.guide_content_snapshot ?? current.heritage_site ?? null) as HeritageSite | null : null;
  const canStart = trip?.trip_status === 'AT_DESTINATION' && current?.stop_type === 'DESTINATION' && currentSession && ['READY', 'PENDING'].includes(currentSession.session_status);
  const canComplete = currentSession?.session_status === 'IN_PROGRESS';

  const runGuideAction = async (action: 'START_GUIDE_SESSION' | 'COMPLETE_GUIDE_SESSION' | 'SAVE_GUIDE_NOTE') => {
    if (!trip || !current) return;
    setSaving(true);
    try {
      const updated = await api.guide.action(trip.id, { action, itineraryItemId: current.id, notes });
      setTrip(updated);
      alert(action === 'START_GUIDE_SESSION' ? 'Sesi penjelasan dimulai.' : action === 'COMPLETE_GUIDE_SESSION' ? 'Sesi selesai. Driver sudah dapat melanjutkan.' : 'Catatan tersimpan.');
    } catch (err: any) {
      alert(err.message ?? 'Aksi Guide gagal');
      await load(true);
    } finally {
      setSaving(false);
    }
  };

  const reportIssue = async () => {
    if (!trip || !issueNote.trim()) return alert('Catatan kendala wajib diisi');
    setSaving(true);
    try {
      await api.guide.incident(trip.id, { issue_type: issueType, description: issueNote.trim(), latitude: position?.latitude, longitude: position?.longitude });
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

  if (loading && !trip) return <GuideLoading text="Membuka tugas..." />;
  if (error && !trip) return <GuideError message={error} retry={() => load()} />;
  if (!trip) return null;

  const pickup = trip.itinerary_items?.find((item) => item.stop_type === 'PICKUP');

  return (
    <main className="pb-36">
      <header className="bg-[#1a3a2e] px-4 pb-6 pt-4 text-white">
        <div className="flex min-h-11 items-center justify-between">
          <Link href="/guide/tasks" className="flex min-h-11 items-center px-1 text-sm font-semibold text-emerald-100">← Kembali</Link>
          <button onClick={() => setHelpOpen(true)} className="min-h-11 rounded-xl bg-white/10 px-4 text-sm font-bold">? Bantuan</button>
        </div>
        <p className="mt-3 text-xs font-bold uppercase tracking-[0.15em] text-emerald-200">{trip.trip_status === 'COMPLETED' ? 'Riwayat Tugas' : 'Tugas Wisata Aktif'}</p>
        <h1 className="mt-1 text-xl font-bold">{trip.booking_reference}</h1>
        <p className="mt-2 text-sm text-emerald-100">{tripTitle(trip)}</p>
        <p className="text-sm text-emerald-100">Driver: {trip.driver?.name ?? '-'} • {trip.sakoci?.code || trip.sakoci?.name}</p>
      </header>

      <div className="space-y-4 px-4 py-5">
        <section className="grid grid-cols-2 gap-2 rounded-3xl bg-white p-4 shadow-sm">
          <Info label="Jadwal Wisatawan" value={formatTime(trip.scheduled_user_pickup_at)} />
          <Info label="Jumlah Peserta" value={`${trip.booking?.participants ?? 0} Orang`} />
          <Info label="Penjemputan" value={pickup?.name ?? '-'} />
          <Info label="Estimasi Perjalanan" value={formatDuration(trip.estimated_duration_minutes)} />
        </section>

        <section className="rounded-3xl bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Status Sakoci</p>
          <h2 className="mt-2 text-lg font-bold text-[#1a3a2e]">{tripStatusLabels[trip.trip_status]}{current && trip.trip_status.includes('DESTINATION') ? ` • ${current.name}` : ''}</h2>
          <p className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-400">Status Sesi Guide</p>
          <p className="mt-2 text-lg font-bold text-slate-900">{currentGuideStatus(trip)}</p>
        </section>

        <DriverTripMap trip={trip} currentPosition={trip.booking?.vehicle_latitude && trip.booking?.vehicle_longitude ? { latitude: Number(trip.booking.vehicle_latitude), longitude: Number(trip.booking.vehicle_longitude) } : null} />

        <Itinerary trip={trip} />

        {current?.stop_type === 'DESTINATION' && (
          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Destinasi Aktif</p>
            <h2 className="mt-2 text-xl font-bold text-slate-900">{current.name}</h2>
            {trip.trip_status !== 'AT_DESTINATION' && <p className="mt-2 rounded-2xl bg-amber-50 p-3 text-sm text-amber-800">Sakoci masih menuju lokasi ini. Sesi penjelasan dapat dimulai setelah Sakoci tiba.</p>}
            <DestinationMaterial site={currentMaterial} />
            <label className="mt-5 block text-sm font-bold text-slate-700">Catatan Sesi Guide</label>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} className="mt-2 w-full rounded-2xl border border-slate-200 p-3 text-sm" placeholder="Catatan untuk sesi destinasi ini..." />
            <button onClick={() => runGuideAction('SAVE_GUIDE_NOTE')} disabled={saving || !currentSession} className="mt-3 min-h-11 w-full rounded-2xl border border-[#1a3a2e] font-bold text-[#1a3a2e] disabled:opacity-50">Simpan Catatan</button>
          </section>
        )}

        {trip.incidents?.length > 0 && (
          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <h2 className="font-bold text-slate-900">Laporan Kendala</h2>
            {trip.incidents.map((incident) => <div key={incident.id} className="mt-3 rounded-2xl bg-amber-50 p-3 text-sm"><div className="flex justify-between gap-2"><strong>{incident.issue_type}</strong><span className="text-xs text-amber-700">{incident.status}</span></div><p className="mt-1 text-slate-600">{incident.description}</p></div>)}
          </section>
        )}
      </div>

      {(canStart || canComplete) && (
        <div className="fixed inset-x-0 bottom-[72px] z-40 mx-auto max-w-xl border-t border-emerald-100 bg-white/95 p-3 backdrop-blur">
          {canStart && <button onClick={() => runGuideAction('START_GUIDE_SESSION')} disabled={saving} className="min-h-14 w-full rounded-2xl bg-[#1a3a2e] px-4 font-bold text-white shadow-lg disabled:opacity-50">Mulai Sesi Penjelasan</button>}
          {canComplete && <button onClick={() => runGuideAction('COMPLETE_GUIDE_SESSION')} disabled={saving} className="min-h-14 w-full rounded-2xl bg-[#1a3a2e] px-4 font-bold text-white shadow-lg disabled:opacity-50">Selesaikan Sesi & Peserta Siap Lanjut</button>}
        </div>
      )}

      {helpOpen && <HelpSheet issueType={issueType} setIssueType={setIssueType} issueNote={issueNote} setIssueNote={setIssueNote} saving={saving} reportIssue={reportIssue} close={() => setHelpOpen(false)} position={position} />}
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[10px] font-bold uppercase leading-4 text-slate-400">{label}</p><p className="mt-1 text-sm font-bold text-slate-800">{value}</p></div>;
}

function Itinerary({ trip }: { trip: DriverTrip }) {
  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm">
      <h2 className="font-bold text-slate-900">Progress Itinerary</h2>
      <div className="mt-4 space-y-1">
        {[...(trip.itinerary_items ?? [])].sort((a, b) => a.sequence - b.sequence).map((item, index) => {
          const active = item.id === trip.current_itinerary_item_id && !['COMPLETED', 'SKIPPED'].includes(item.stop_status);
          const done = item.stop_status === 'COMPLETED';
          const skipped = item.stop_status === 'SKIPPED';
          const session = sessionForItem(trip, item);
          return (
            <div key={item.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className={`grid h-8 w-8 place-items-center rounded-full text-sm font-bold ${done ? 'bg-emerald-600 text-white' : skipped ? 'bg-red-100 text-red-700' : active ? 'bg-amber-400 text-white' : 'bg-slate-100 text-slate-400'}`}>{done ? '✓' : skipped ? '!' : active ? '→' : '○'}</span>
                {index < trip.itinerary_items.length - 1 && <span className="h-8 w-0.5 bg-slate-100" />}
              </div>
              <div className="pt-1">
                <p className={`text-sm font-bold ${active ? 'text-amber-700' : 'text-slate-700'}`}>{item.name}</p>
                <p className="text-xs text-slate-400">{item.stop_type === 'PICKUP' ? 'Titik Penjemputan' : item.stop_type === 'ENDPOINT' ? 'Titik Akhir' : `Destinasi ${item.sequence}`}</p>
                {session && <p className="mt-1 text-xs text-emerald-700">Sesi Guide: {guideSessionLabels[session.session_status]}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function DestinationMaterial({ site }: { site?: HeritageSite | null }) {
  if (!site) return <p className="mt-3 text-sm text-slate-500">Materi destinasi belum tersedia.</p>;
  const media = [site.image_url, ...(site.images ?? []).map((item) => item.url)].filter(Boolean);
  return (
    <div className="mt-4 space-y-4">
      {media.length > 0 && <BackendAssetImage src={media[0]} alt={site.name} className="h-44 w-full rounded-2xl object-cover" />}
      {site.description && <p className="text-sm leading-6 text-slate-700">{site.description}</p>}
      <div className="grid grid-cols-2 gap-2 text-sm">
        {site.category && <Info label="Kategori" value={site.category} />}
        {site.status && <Info label="Status" value={site.status} />}
        {site.kelurahan && <Info label="Kelurahan" value={site.kelurahan} />}
        {site.kecamatan && <Info label="Kecamatan" value={site.kecamatan} />}
        {site.no_register && <Info label="No. Register" value={site.no_register} />}
        {site.tahun_register && <Info label="Tahun Register" value={site.tahun_register} />}
      </div>
      {site.address && <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">{site.address}</p>}
      {site.latitude && site.longitude && <a href={`https://www.google.com/maps?q=${site.latitude},${site.longitude}`} target="_blank" rel="noreferrer" className="flex min-h-12 items-center justify-center rounded-2xl border border-[#1a3a2e] font-bold text-[#1a3a2e]">Buka Navigasi</a>}
      {(site.youtube_links?.length || site.pdf_files?.length) ? <div className="space-y-2">{[...(site.youtube_links ?? []), ...(site.pdf_files ?? [])].filter((item) => item.url).map((item) => <a key={item.url} href={item.url} target="_blank" rel="noreferrer" className="block rounded-2xl bg-emerald-50 p-3 text-sm font-bold text-[#1a3a2e]">{item.title || item.url}</a>)}</div> : null}
    </div>
  );
}

function HelpSheet(props: { issueType: string; setIssueType: (v: string) => void; issueNote: string; setIssueNote: (v: string) => void; saving: boolean; reportIssue: () => void; close: () => void; position: { latitude: number; longitude: number } | null }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50">
      <button className="absolute inset-0" onClick={props.close} aria-label="Tutup bantuan" />
      <section className="relative z-10 max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-t-[2rem] bg-white p-5 pb-8">
        <div className="mx-auto h-1.5 w-12 rounded-full bg-slate-200" />
        <div className="mt-5 flex items-center justify-between"><h2 className="text-xl font-bold">Bantuan & Laporan Kendala</h2><button onClick={props.close} className="grid h-11 w-11 place-items-center rounded-full bg-slate-100">×</button></div>
        <label className="mt-5 block text-sm font-bold text-slate-700">Jenis Kendala</label>
        <select value={props.issueType} onChange={(event) => props.setIssueType(event.target.value)} className="mt-2 min-h-12 w-full rounded-xl border border-slate-200 px-3 text-sm">{issueTypes.map((item) => <option key={item}>{item}</option>)}</select>
        <label className="mt-4 block text-sm font-bold text-slate-700">Catatan</label>
        <textarea value={props.issueNote} onChange={(event) => props.setIssueNote(event.target.value)} rows={4} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm" placeholder="Jelaskan kendala yang sedang terjadi..." />
        <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs text-slate-500">Lokasi saat ini: {props.position ? `${props.position.latitude.toFixed(6)}, ${props.position.longitude.toFixed(6)}` : 'belum tersedia'}</div>
        <button onClick={props.reportIssue} disabled={props.saving} className="mt-5 min-h-12 w-full rounded-2xl bg-[#1a3a2e] font-bold text-white disabled:opacity-50">Kirim Laporan</button>
      </section>
    </div>
  );
}
