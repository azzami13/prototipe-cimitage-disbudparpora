'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { api, DriverTrip, Sakoci, SakociBody, SakociStatus, SakociTrackingVisibility, SystemSettings, TripIncident } from '@/lib/api';
import { io } from 'socket.io-client';
import { useSession } from 'next-auth/react';
import { useBackendReadiness } from '@/components/providers/BackendReadinessProvider';
import { API_ORIGIN as SOCKET_BASE } from '@/lib/runtime-config';
import { can } from '@/lib/rbac';

const DriverTripMap = dynamic(() => import('@/components/driver/DriverTripMap'), {
  ssr: false,
  loading: () => <div className="h-64 w-full rounded-3xl bg-slate-200" />,
});

const emptyForm: SakociBody = {
  name: '',
  code: '',
  plate_number: '',
  image_url: '',
  status: 'available',
  active: true,
  tracking_enabled: true,
  tracking_visibility: 'admin',
  latitude: null,
  longitude: null,
  notes: '',
};

const statusLabels: Record<SakociStatus, string> = {
  available: 'Siap digunakan',
  assigned: 'Sedang bertugas',
  maintenance: 'Perawatan',
  inactive: 'Tidak aktif',
};

const visibilityLabels: Record<SakociTrackingVisibility, string> = {
  public: 'Tampil di peta umum',
  user: 'Tampil di detail pemesan',
  admin: 'Admin saja',
  hidden: 'Tidak ditampilkan',
};

const inputClass = 'w-full rounded-lg border px-3 py-2 text-sm';

export default function MonitoringPage() {
  const { status: backendStatus } = useBackendReadiness();
  const { data: session, status: sessionStatus } = useSession();
  const [items, setItems] = useState<Sakoci[]>([]);
  const [form, setForm] = useState<SakociBody>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [activeTrips, setActiveTrips] = useState<DriverTrip[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [incidentDrafts, setIncidentDrafts] = useState<Record<number, { status: TripIncident['status']; resolution_note: string }>>({});
  const [savingIncidentId, setSavingIncidentId] = useState<number | null>(null);
  const canManageSettings = can(session?.user?.role, 'settings.manage');

  const load = async () => {
    setLoading(true);
    try {
      const [sakoci, trips, systemSettings] = await Promise.all([
        api.sakoci.list(),
        api.tripAssignments.active(),
        api.operations.settings().catch(() => null),
      ]);
      setItems(sakoci);
      setActiveTrips(trips);
      setSettings(systemSettings);
      setMessage('');
    } catch (err: any) {
      setMessage(err.message ?? 'Gagal memuat data Sakoci');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // Mode demo tidak memiliki websocket: segarkan berkala agar posisi Sakoci terlihat bergerak.
    if (process.env.NEXT_PUBLIC_DEMO_MODE !== 'true') return;
    const timer = window.setInterval(() => load(), 5000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (backendStatus !== 'ready' || sessionStatus !== 'authenticated' || !session?.accessToken) return;
    const socket = io(`${SOCKET_BASE}/trip-monitoring`, {
      transports: ['websocket'],
      auth: { token: session.accessToken },
      autoConnect: false,
    });
    const connectTimer = window.setTimeout(() => socket.connect(), 0);
    const refresh = () => load();
    socket.on('trip-updated', refresh);
    socket.on('trip-location', refresh);
    return () => {
      window.clearTimeout(connectTimer);
      if (socket.connected) socket.disconnect();
    };
  }, [backendStatus, session?.accessToken, sessionStatus]);

  const set = <K extends keyof SakociBody>(key: K, value: SakociBody[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setMessage('');
  };

  const edit = (sakoci: Sakoci) => {
    setEditingId(sakoci.id);
    setForm({
      name: sakoci.name,
      code: sakoci.code ?? '',
      plate_number: sakoci.plate_number ?? '',
      image_url: sakoci.image_url ?? '',
      status: sakoci.status,
      active: sakoci.active,
      tracking_enabled: sakoci.tracking_enabled,
      tracking_visibility: sakoci.tracking_visibility,
      latitude: sakoci.latitude ?? null,
      longitude: sakoci.longitude ?? null,
      notes: sakoci.notes ?? '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const reset = () => {
    setEditingId(null);
    setForm(emptyForm);
    setMessage('');
  };

  const save = async () => {
    if (!form.name.trim()) return setMessage('Nama Sakoci wajib diisi');
    setSaving(true);
    try {
      const body = {
        ...form,
        name: form.name.trim(),
        latitude: form.latitude === null || form.latitude === undefined ? undefined : Number(form.latitude),
        longitude: form.longitude === null || form.longitude === undefined ? undefined : Number(form.longitude),
      };
      if (editingId) {
        await api.sakoci.update(editingId, body);
        setMessage('Data Sakoci berhasil diperbarui');
      } else {
        await api.sakoci.create(body);
        setMessage('Sakoci baru berhasil ditambahkan');
      }
      reset();
      await load();
    } catch (err: any) {
      setMessage(err.message ?? 'Gagal menyimpan Sakoci');
    } finally {
      setSaving(false);
    }
  };

  const toggleTracking = async (sakoci: Sakoci) => {
    await api.sakoci.update(sakoci.id, { tracking_enabled: !sakoci.tracking_enabled });
    await load();
  };

  const toggleGraphRadius = async () => {
    if (!settings || !canManageSettings) return;
    const next = await api.operations.updateSettings({
      showSakociGraphRadius: !settings.showSakociGraphRadius,
    });
    setSettings(next);
    setMessage(`Visualisasi graph sekitar Sakoci ${next.showSakociGraphRadius ? 'diaktifkan' : 'dinonaktifkan'}.`);
  };

  const togglePublicRoute = async () => {
    if (!settings || !canManageSettings) return;
    const nextPublicRoute = !settings.showPublicCurrentRoute;
    const next = await api.operations.updateSettings({
      publicTrackingEnabled: true,
      showPublicCurrentRoute: nextPublicRoute,
    });
    setSettings(next);
    setMessage(`Rute Sakoci di peta customer ${next.showPublicCurrentRoute ? 'diaktifkan' : 'dinonaktifkan'}.`);
  };

  const incidentDraft = (incident: TripIncident) => incidentDrafts[incident.id] ?? {
    status: incident.status,
    resolution_note: incident.resolution_note ?? '',
  };

  const setIncidentDraft = (incident: TripIncident, patch: Partial<{ status: TripIncident['status']; resolution_note: string }>) => {
    setIncidentDrafts((current) => ({
      ...current,
      [incident.id]: {
        ...incidentDraft(incident),
        ...patch,
      },
    }));
  };

  const saveIncident = async (tripId: number, incident: TripIncident) => {
    const draft = incidentDraft(incident);
    setSavingIncidentId(incident.id);
    try {
      await api.tripAssignments.updateIncidentStatus(tripId, incident.id, {
        status: draft.status,
        resolution_note: draft.resolution_note,
      });
      setMessage('Status incident berhasil diperbarui.');
      await load();
    } catch (err: any) {
      setMessage(err.message ?? 'Gagal memperbarui incident');
    } finally {
      setSavingIncidentId(null);
    }
  };

  const fmtDate = (value?: string | null) =>
    value ? new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-';

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#1a3a2e]">Tracking Sakoci</h1>
        <p className="text-sm text-gray-500">Kelola armada, status, lokasi, dan aturan tampilan tracking.</p>
      </div>

      <section className="rounded-xl bg-white p-5 shadow">
        <h2 className="mb-4 font-bold text-[#1a3a2e]">{editingId ? 'Edit Sakoci' : 'Tambah Sakoci'}</h2>
        {message && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {message}
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Nama Sakoci">
            <input value={form.name} onChange={(e) => set('name', e.target.value)} className={inputClass} placeholder="Sakoci 01" />
          </Field>
          <Field label="Kode">
            <input value={form.code ?? ''} onChange={(e) => set('code', e.target.value)} className={inputClass} placeholder="SKC-01" />
          </Field>
          <Field label="Nomor Polisi">
            <input value={form.plate_number ?? ''} onChange={(e) => set('plate_number', e.target.value)} className={inputClass} placeholder="D 1234 CIM" />
          </Field>
          <Field label="Status">
            <select value={form.status} onChange={(e) => set('status', e.target.value as SakociStatus)} className={inputClass}>
              {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
          <Field label="Visibilitas Tracking">
            <select value={form.tracking_visibility} onChange={(e) => set('tracking_visibility', e.target.value as SakociTrackingVisibility)} className={inputClass}>
              {Object.entries(visibilityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </Field>
          <Field label="Lokasi Aktif">
            <div className="flex h-10 items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={Boolean(form.active)} onChange={(e) => set('active', e.target.checked)} />
                Armada aktif
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={Boolean(form.tracking_enabled)} onChange={(e) => set('tracking_enabled', e.target.checked)} />
                Tracking aktif
              </label>
            </div>
          </Field>
          <Field label="Latitude">
            <input type="number" value={form.latitude ?? ''} onChange={(e) => set('latitude', e.target.value === '' ? null : Number(e.target.value))} className={inputClass} />
          </Field>
          <Field label="Longitude">
            <input type="number" value={form.longitude ?? ''} onChange={(e) => set('longitude', e.target.value === '' ? null : Number(e.target.value))} className={inputClass} />
          </Field>
          <Field label="Catatan">
            <input value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} className={inputClass} />
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-3">
          {editingId && <button onClick={reset} className="rounded-lg border px-4 py-2 text-sm font-semibold text-gray-600">Batal</button>}
          <button onClick={save} disabled={saving} className="rounded-lg bg-[#1a3a2e] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {saving ? 'Menyimpan...' : 'Simpan Sakoci'}
          </button>
        </div>
      </section>

      <section className="rounded-xl bg-white p-5 shadow">
        <h2 className="font-bold text-[#1a3a2e] mb-2">Pengaturan Visualisasi Peta GIS</h2>
        {!canManageSettings && (
          <p className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Pengaturan visualisasi global hanya dapat diubah oleh Super Admin.
          </p>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          <div className="border rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3">
                <p className="font-semibold text-gray-800">Rute di Peta Customer</p>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  settings?.showPublicCurrentRoute
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  {settings?.showPublicCurrentRoute ? 'Aktif' : 'Mati'}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">Menampilkan rute perjalanan Sakoci yang sedang aktif di peta publik.</p>
            </div>
            <button
              onClick={togglePublicRoute}
              disabled={!settings || !canManageSettings}
              className="mt-4 w-full rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 transition-colors bg-gray-600 hover:bg-gray-700"
            >
              {settings?.showPublicCurrentRoute ? 'Nonaktifkan' : 'Aktifkan'}
            </button>
          </div>

          <div className="border rounded-xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3">
                <p className="font-semibold text-gray-800">Graph Sekitar Sakoci (Radius 2km)</p>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  settings?.showSakociGraphRadius
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-700'
                }`}>
                  {settings?.showSakociGraphRadius ? 'Aktif' : 'Mati'}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">Tampilkan node dan edge dari graph rute di sekitar posisi Sakoci untuk semua peta (admin, driver, customer).</p>
            </div>
            <button
              onClick={toggleGraphRadius}
              disabled={!settings || !canManageSettings}
              className="mt-4 w-full rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 transition-colors bg-gray-600 hover:bg-gray-700"
            >
              {settings?.showSakociGraphRadius ? 'Nonaktifkan' : 'Aktifkan'}
            </button>
          </div>

        </div>
      </section>

      <section className="rounded-xl bg-white shadow">
        <div className="border-b px-5 py-4">
          <h2 className="font-bold text-[#1a3a2e]">Daftar Sakoci</h2>
        </div>
        {loading ? (
          <p className="p-5 text-sm text-gray-500">Memuat data Sakoci...</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-5 py-3">Sakoci</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Tracking</th>
                  <th className="px-5 py-3">Lokasi</th>
                  <th className="px-5 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((sakoci) => (
                  <tr key={sakoci.id}>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-gray-800">{sakoci.name}</p>
                      <p className="text-xs text-gray-500">{sakoci.code || '-'} • {sakoci.plate_number || '-'}</p>
                      {sakoci.image_url && <p className="mt-1 text-xs text-emerald-700">Foto marker tersedia</p>}
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-medium text-gray-700">{statusLabels[sakoci.status]}</p>
                      <p className="text-xs text-gray-500">{sakoci.active ? 'Armada aktif' : 'Armada mati'}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-medium text-gray-700">{sakoci.tracking_enabled ? 'Aktif' : 'Mati'}</p>
                      <p className="text-xs text-gray-500">{visibilityLabels[sakoci.tracking_visibility]}</p>
                    </td>
                    <td className="px-5 py-4 text-gray-600">
                      <p>{sakoci.latitude && sakoci.longitude ? `${sakoci.latitude}, ${sakoci.longitude}` : '-'}</p>
                      <p className="text-xs text-gray-500">{fmtDate(sakoci.location_updated_at)}</p>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => toggleTracking(sakoci)} className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-gray-700">
                          {sakoci.tracking_enabled ? 'Matikan' : 'Aktifkan'}
                        </button>
                        <button onClick={() => edit(sakoci)} className="rounded-lg bg-[#1a3a2e] px-3 py-1.5 text-xs font-semibold text-white">
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400">Belum ada data Sakoci.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-xl bg-white shadow">
        <div className="border-b px-5 py-4">
          <h2 className="font-bold text-[#1a3a2e]">Trip Driver Aktif</h2>
          <p className="mt-1 text-xs text-gray-500">Status operasional dan posisi terakhir Sakoci dari aplikasi Driver.</p>
        </div>
        <div className="grid gap-4 p-5 lg:grid-cols-2">
          {activeTrips.map((trip) => {
            const activeStop = trip.itinerary_items?.find((item) => item.id === trip.current_itinerary_item_id);
            const lat = trip.booking?.vehicle_latitude ?? trip.sakoci?.latitude;
            const lng = trip.booking?.vehicle_longitude ?? trip.sakoci?.longitude;
            const stops = trip.itinerary_items?.filter((item) => item.stop_type === 'DESTINATION') ?? [];
            const completedStops = stops.filter((item) => ['COMPLETED', 'SKIPPED'].includes(item.stop_status)).length;
            const activeIncidents = trip.incidents?.filter((incident) => incident.status !== 'RESOLVED').length ?? 0;
            return (
              <article key={trip.id} className="rounded-xl border border-emerald-100 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-gray-800">{trip.booking_reference}</p>
                    <p className="text-sm text-gray-500">{trip.driver?.name} • {trip.sakoci?.code || trip.sakoci?.name}</p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">{trip.trip_status}</span>
                </div>
                <p className="mt-3 text-sm text-gray-600">Tujuan aktif: <strong>{activeStop?.name ?? '-'}</strong></p>
                <div className="mt-3 grid gap-2 text-xs text-gray-600 sm:grid-cols-3">
                  <p className="rounded-lg bg-gray-50 p-2">Route: <strong>{routeStatusLabel(trip.route_snapshot?.route_status)}</strong></p>
                  <p className="rounded-lg bg-gray-50 p-2">Progress: <strong>{completedStops}/{stops.length}</strong></p>
                  <p className={`rounded-lg p-2 ${activeIncidents ? 'bg-amber-50 text-amber-800' : 'bg-gray-50'}`}>Incident: <strong>{activeIncidents}</strong></p>
                </div>
                {trip.incidents?.length ? (
                  <div className="mt-4 space-y-3 rounded-xl border border-amber-100 bg-amber-50/40 p-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-amber-800">Penanganan Incident</p>
                    {trip.incidents.map((incident) => {
                      const draft = incidentDraft(incident);
                      return (
                        <div key={incident.id} className="rounded-lg bg-white p-3 text-xs shadow-sm">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="font-bold text-gray-800">{incident.issue_type}</p>
                              <p className="mt-1 text-gray-600">{incident.description}</p>
                              <p className="mt-1 text-gray-400">Dilaporkan {fmtDate(incident.reported_at)}</p>
                            </div>
                            <select
                              value={draft.status}
                              onChange={(event) => setIncidentDraft(incident, { status: event.target.value as TripIncident['status'] })}
                              className="rounded-lg border px-2 py-1 text-xs font-semibold"
                            >
                              <option value="OPEN">OPEN</option>
                              <option value="IN_REVIEW">IN_REVIEW</option>
                              <option value="RESOLVED">RESOLVED</option>
                            </select>
                          </div>
                          <textarea
                            value={draft.resolution_note}
                            onChange={(event) => setIncidentDraft(incident, { resolution_note: event.target.value })}
                            placeholder="Catatan penanganan admin"
                            className="mt-2 w-full rounded-lg border px-3 py-2 text-xs"
                            rows={2}
                          />
                          <div className="mt-2 flex items-center justify-between gap-2">
                            <span className="text-gray-400">
                              {incident.resolved_at ? `Selesai ${fmtDate(incident.resolved_at)}` : 'Belum selesai'}
                            </span>
                            <button
                              onClick={() => saveIncident(trip.id, incident)}
                              disabled={savingIncidentId === incident.id}
                              className="rounded-lg bg-[#1a3a2e] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                            >
                              {savingIncidentId === incident.id ? 'Menyimpan...' : 'Simpan'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : null}
                <p className="mt-1 text-xs text-gray-500">Tracking {trip.tracking_active ? 'aktif' : 'tidak aktif'} • update {fmtDate(trip.booking?.vehicle_location_updated_at)}</p>
                {trip.route_snapshot && (
                  <div className="mt-4 overflow-hidden rounded-2xl border border-emerald-100">
                    <DriverTripMap
                      trip={trip}
                      currentPosition={lat && lng ? { latitude: Number(lat), longitude: Number(lng) } : null}
                      heightClass="h-64"
                    />
                  </div>
                )}
                <div className="mt-4 flex gap-2">
                  <a href={`/admin/booking/${trip.booking_id}`} className="rounded-lg bg-[#1a3a2e] px-3 py-2 text-xs font-bold text-white">Detail Booking</a>
                  {lat && lng && <a href={`https://www.google.com/maps?q=${lat},${lng}`} target="_blank" rel="noreferrer" className="rounded-lg border px-3 py-2 text-xs font-bold text-gray-700">Buka Posisi</a>}
                </div>
              </article>
            );
          })}
          {!activeTrips.length && <p className="text-sm text-gray-400">Belum ada trip Driver aktif.</p>}
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-gray-700">{label}</span>
      {children}
    </label>
  );
}

function routeStatusLabel(status?: string | null) {
  if (status === 'final') return 'Final';
  if (status === 'stale') return 'Stale';
  if (status === 'failed') return 'Gagal';
  return 'Belum ada';
}
