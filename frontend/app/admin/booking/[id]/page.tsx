'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { api, AuthUser, Booking, BookingPaymentBody, DriverTrip, RouteSnapshot, Sakoci, TripAssignmentBody } from '@/lib/api';
import { io } from 'socket.io-client';
import { useSession } from 'next-auth/react';
import { useBackendReadiness } from '@/components/providers/BackendReadinessProvider';
import { API_ORIGIN as SOCKET_BASE } from '@/lib/runtime-config';

const DriverTripMap = dynamic(() => import('@/components/driver/DriverTripMap'), {
  ssr: false,
  loading: () => <div className="h-[360px] w-full rounded-3xl bg-slate-200" />,
});

const STATUS_LABEL: Record<string, string> = {
  pending: 'Menunggu konfirmasi',
  confirmed: 'Terkonfirmasi',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
};

const PAYMENT_LABEL: Record<string, string> = {
  unpaid: 'Belum dibayar',
  waiting_verification: 'Menunggu verifikasi',
  paid: 'Lunas',
  rejected: 'Ditolak',
  refunded: 'Dikembalikan',
};

const STATUS_OPTIONS = ['pending', 'confirmed', 'completed', 'cancelled'];
const PAYMENT_OPTIONS = ['unpaid', 'waiting_verification', 'paid', 'rejected', 'refunded'] as const;
const TRIP_STATUS_LABEL: Record<string, string> = {
  ASSIGNED: 'Ditugaskan',
  ACCEPTED: 'Tugas Diterima',
  EN_ROUTE_TO_PICKUP: 'Menuju Penjemputan',
  AT_PICKUP: 'Tiba di Penjemputan',
  EN_ROUTE_TO_DESTINATION: 'Menuju Destinasi',
  AT_DESTINATION: 'Sedang di Destinasi',
  EN_ROUTE_TO_ENDPOINT: 'Menuju Titik Akhir',
  COMPLETED: 'Perjalanan Selesai',
  CANCELLED: 'Dibatalkan',
  ISSUE_REPORTED: 'Kendala Dilaporkan',
};

export default function AdminBookingDetailPage({ params }: { params: { id: string } }) {
  const { status: backendStatus } = useBackendReadiness();
  const { data: session, status: sessionStatus } = useSession();
  const bookingId = Number(params.id);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [guides, setGuides] = useState<AuthUser[]>([]);
  const [drivers, setDrivers] = useState<AuthUser[]>([]);
  const [sakociList, setSakociList] = useState<Sakoci[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [error, setError] = useState('');
  const [payment, setPayment] = useState<BookingPaymentBody>({});
  const [locationForm, setLocationForm] = useState({ latitude: '', longitude: '' });
  const [driverTrip, setDriverTrip] = useState<DriverTrip | null>(null);
  const [routeSnapshot, setRouteSnapshot] = useState<RouteSnapshot | null>(null);
  const [activeTrips, setActiveTrips] = useState<DriverTrip[]>([]);
  const [tripForm, setTripForm] = useState({
    driver_id: '',
    tour_guide_id: '',
    sakoci_id: '',
    scheduled_user_pickup_at: '',
    driver_ready_at: '',
    estimated_duration_minutes: '120',
    endpoint_name: '',
    endpoint_address: '',
    endpoint_latitude: '',
    endpoint_longitude: '',
  });
  const [tripFormDirty, setTripFormDirty] = useState(false);
  const tripFormDirtyRef = useRef(false);

  const updateTripForm = (updater: typeof tripForm | ((current: typeof tripForm) => typeof tripForm)) => {
    setTripForm(updater);
    setTripFormDirty(true);
    tripFormDirtyRef.current = true;
  };

  const load = async (silent = false, syncTripForm = !tripFormDirtyRef.current) => {
    if (!Number.isInteger(bookingId) || bookingId < 1) {
      setError('Nomor booking tidak valid');
      setLoading(false);
      return;
    }

    if (!silent) setLoading(true);
    try {
      const [bookingData, guideData, driverData, sakociData, assignmentData, activeTripData, routeData] = await Promise.all([
        api.bookings.one(bookingId),
        api.bookings.staff('tour_guide'),
        api.bookings.staff('driver'),
        api.sakoci.list({ active: 'true' }),
        api.tripAssignments.one(bookingId),
        api.tripAssignments.active(),
        api.bookings.route(bookingId).catch(() => null),
      ]);
      setBooking(bookingData);
      setGuides(guideData);
      setDrivers(driverData);
      setSakociList(sakociData);
      setDriverTrip(assignmentData);
      setRouteSnapshot(routeData);
      setActiveTrips(activeTripData);
      setPayment({
        payment_status: bookingData.payment_status ?? 'unpaid',
        payment_method: bookingData.payment_method ?? '',
        paid_amount: Number(bookingData.paid_amount ?? bookingData.total_price ?? 0),
        payment_proof_url: bookingData.payment_proof_url ?? '',
        admin_payment_proof_url: bookingData.admin_payment_proof_url ?? '',
        payment_notes: bookingData.payment_notes ?? '',
      });
      setLocationForm({
        latitude: bookingData.vehicle_latitude ? String(bookingData.vehicle_latitude) : '',
        longitude: bookingData.vehicle_longitude ? String(bookingData.vehicle_longitude) : '',
      });
      const scheduledDefault = assignmentData?.scheduled_user_pickup_at
        ?? bookingDateTime(bookingData.visit_date, bookingData.pickup_time);
      const readyDefault = assignmentData?.driver_ready_at
        ?? (scheduledDefault ? new Date(new Date(scheduledDefault).getTime() - 30 * 60_000).toISOString() : '');
      const endpoint = assignmentData?.itinerary_items?.find((item) => item.stop_type === 'ENDPOINT');
      if (syncTripForm) {
        setTripForm({
          driver_id: String(assignmentData?.driver_id ?? bookingData.assigned_driver_id ?? ''),
          tour_guide_id: String(assignmentData?.tour_guide_id ?? bookingData.assigned_tour_guide_id ?? ''),
          sakoci_id: String(assignmentData?.sakoci_id ?? bookingData.sakoci_id ?? ''),
          scheduled_user_pickup_at: toLocalInput(scheduledDefault),
          driver_ready_at: toLocalInput(readyDefault),
          estimated_duration_minutes: String(
            assignmentData?.estimated_duration_minutes
            ?? (bookingData.tour_package?.duration_hours ? Number(bookingData.tour_package.duration_hours) * 60 : 120),
          ),
          endpoint_name: endpoint?.name ?? '',
          endpoint_address: endpoint?.address ?? '',
          endpoint_latitude: endpoint?.latitude == null ? '' : String(endpoint.latitude),
          endpoint_longitude: endpoint?.longitude == null ? '' : String(endpoint.longitude),
        });
      }
      setError('');
    } catch (err: any) {
      setError(err.message ?? 'Gagal memuat detail booking');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [bookingId]);

  useEffect(() => {
    if (backendStatus !== 'ready') return;
    const timer = window.setInterval(() => load(true), 8000);
    return () => window.clearInterval(timer);
  }, [backendStatus, bookingId]);

  useEffect(() => {
    if (backendStatus !== 'ready' || sessionStatus !== 'authenticated' || !session?.accessToken) return;
    if (!Number.isInteger(bookingId) || bookingId < 1) return;
    const socket = io(`${SOCKET_BASE}/booking-monitoring`, {
      transports: ['websocket'],
      query: { bookingId },
      auth: { token: session.accessToken },
      autoConnect: false,
    });
    const connectTimer = window.setTimeout(() => socket.connect(), 0);
    socket.on('connect', () => {
      setSocketConnected(true);
      socket.emit('join-booking', { bookingId });
    });
    socket.on('disconnect', () => setSocketConnected(false));
    socket.on('vehicle-location', (payload: { booking?: Booking }) => {
      if (payload.booking) setBooking(payload.booking);
    });

    return () => {
      window.clearTimeout(connectTimer);
      if (socket.connected) socket.disconnect();
    };
  }, [backendStatus, bookingId, session?.accessToken, sessionStatus]);

  useEffect(() => {
    if (backendStatus !== 'ready' || sessionStatus !== 'authenticated' || !session?.accessToken) return;
    const socket = io(`${SOCKET_BASE}/trip-monitoring`, {
      transports: ['websocket'],
      auth: { token: session.accessToken },
      autoConnect: false,
    });
    const connectTimer = window.setTimeout(() => socket.connect(), 0);
    socket.on('connect', () => {
      if (driverTrip?.id) socket.emit('join-trip', { tripId: driverTrip.id });
    });
    socket.on('trip-updated', (payload: { bookingId?: number; trip?: DriverTrip }) => {
      if (payload.bookingId === bookingId && payload.trip) setDriverTrip(payload.trip);
    });
    socket.on('trip-location', (payload: { bookingId?: number; latitude?: number; longitude?: number; updated_at?: string }) => {
      if (payload.bookingId !== bookingId) return;
      setBooking((current) => current ? {
        ...current,
        vehicle_latitude: payload.latitude,
        vehicle_longitude: payload.longitude,
        vehicle_location_updated_at: payload.updated_at,
      } : current);
    });
    return () => {
      window.clearTimeout(connectTimer);
      if (socket.connected) socket.disconnect();
    };
  }, [backendStatus, bookingId, driverTrip?.id, session?.accessToken, sessionStatus]);

  const destinations = useMemo(() => {
    if (!booking) return [];
    if (booking.booking_type === 'package') {
      return [...(booking.tour_package?.routes ?? [])]
        .sort((a, b) => a.sequence - b.sequence)
        .map((route) => route.heritage_site)
        .filter(Boolean);
    }
    return booking.private_destinations ?? [];
  }, [booking]);

  const assignmentConflicts = useMemo(() => {
    if (!tripForm.driver_ready_at || !tripForm.scheduled_user_pickup_at || !tripForm.estimated_duration_minutes) {
      return { drivers: new Set<number>(), guides: new Set<number>(), sakoci: new Set<number>() };
    }
    const start = new Date(tripForm.driver_ready_at).getTime();
    const scheduled = new Date(tripForm.scheduled_user_pickup_at).getTime();
    const end = scheduled + Number(tripForm.estimated_duration_minutes) * 60_000;
    const overlapping = activeTrips.filter((item) =>
      item.id !== driverTrip?.id
      && new Date(item.driver_ready_at).getTime() < end
      && new Date(item.estimated_end_at).getTime() > start,
    );
    return {
      drivers: new Set(overlapping.map((item) => item.driver_id)),
      guides: new Set(overlapping.map((item) => item.tour_guide_id).filter(Boolean) as number[]),
      sakoci: new Set(overlapping.map((item) => item.sakoci_id)),
    };
  }, [activeTrips, driverTrip?.id, tripForm.driver_ready_at, tripForm.scheduled_user_pickup_at, tripForm.estimated_duration_minutes]);

  const routeRequired = useMemo(() => {
    if (!booking || booking.booking_type === 'rental') return false;
    if (booking.booking_type === 'private') return (booking.private_destination_ids ?? []).length >= 2;
    return (booking.tour_package?.routes ?? []).length >= 2;
  }, [booking]);
  const routeFinal = !routeRequired || routeSnapshot?.routeStatus === 'final';
  const bookingSchedule = bookingDateTime(booking?.visit_date, booking?.pickup_time);

  const saveStatus = async (status: string) => {
    setSaving('status');
    try {
      setBooking(await api.bookings.updateStatus(bookingId, status));
    } catch (err: any) {
      alert(err.message ?? 'Gagal menyimpan status');
    } finally {
      setSaving(null);
    }
  };

  const saveTripAssignment = async () => {
    const scheduledUserPickupAt = bookingSchedule || tripForm.scheduled_user_pickup_at;
    const missing: string[] = [];
    if (!tripForm.driver_id) missing.push('Driver');
    if (!tripForm.sakoci_id) missing.push('Sakoci');
    if (!scheduledUserPickupAt) missing.push('Jadwal wisatawan dari booking');
    if (!tripForm.driver_ready_at) missing.push('Waktu Driver siap');
    if (missing.length) {
      return alert(`${missing.join(', ')} wajib tersedia`);
    }
    setSaving('trip-assignment');
    try {
      const body: TripAssignmentBody = {
        driver_id: Number(tripForm.driver_id),
        tour_guide_id: Number(tripForm.tour_guide_id) || null,
        sakoci_id: Number(tripForm.sakoci_id),
        scheduled_user_pickup_at: new Date(scheduledUserPickupAt).toISOString(),
        driver_ready_at: new Date(tripForm.driver_ready_at).toISOString(),
        estimated_duration_minutes: Number(tripForm.estimated_duration_minutes),
        destination_ids: destinations.map((site) => site.id),
        endpoint: tripForm.endpoint_name.trim() ? {
          name: tripForm.endpoint_name.trim(),
          address: tripForm.endpoint_address.trim() || undefined,
          latitude: tripForm.endpoint_latitude ? Number(tripForm.endpoint_latitude) : undefined,
          longitude: tripForm.endpoint_longitude ? Number(tripForm.endpoint_longitude) : undefined,
        } : null,
      };
      const updated = driverTrip
        ? await api.tripAssignments.update(bookingId, body)
        : await api.tripAssignments.create(bookingId, body);
      setDriverTrip(updated);
      setTripFormDirty(false);
      tripFormDirtyRef.current = false;
      await load(true, true);
      alert(driverTrip ? 'Assignment berhasil diperbarui' : 'Trip berhasil ditugaskan ke Driver');
    } catch (err: any) {
      alert(err.message ?? 'Gagal menyimpan assignment trip');
    } finally {
      setSaving(null);
    }
  };

  const finalizeRoute = async () => {
    setSaving('route-finalize');
    try {
      setRouteSnapshot(await api.bookings.finalizeRoute(bookingId, {
        endpoint: tripForm.endpoint_name.trim() ? {
          name: tripForm.endpoint_name.trim(),
          address: tripForm.endpoint_address.trim() || undefined,
          latitude: tripForm.endpoint_latitude ? Number(tripForm.endpoint_latitude) : undefined,
          longitude: tripForm.endpoint_longitude ? Number(tripForm.endpoint_longitude) : undefined,
        } : null,
        vehicleProfile: 'SAKOCI_DEFAULT',
      }));
      await load(true);
    } catch (err: any) {
      alert(err.message ?? 'Gagal finalisasi rute');
    } finally {
      setSaving(null);
    }
  };

  const reoptimizeRoute = async () => {
    const reason = window.prompt('Alasan optimasi ulang rute:')?.trim();
    if (!reason) return;
    setSaving('route-reoptimize');
    try {
      setRouteSnapshot(await api.bookings.reoptimizeRoute(bookingId, reason));
      await load(true);
    } catch (err: any) {
      alert(err.message ?? 'Gagal optimasi ulang rute');
    } finally {
      setSaving(null);
    }
  };

  const cancelTripAssignment = async () => {
    const reason = window.prompt('Alasan pembatalan assignment:');
    if (!reason) return;
    if (!window.confirm('Batalkan assignment Driver ini? Tracking akan dihentikan.')) return;
    setSaving('trip-cancel');
    try {
      setDriverTrip(await api.tripAssignments.cancel(bookingId, reason));
      setTripFormDirty(false);
      tripFormDirtyRef.current = false;
      await load(true, true);
    } catch (err: any) {
      alert(err.message ?? 'Gagal membatalkan assignment');
    } finally {
      setSaving(null);
    }
  };

  const savePayment = async () => {
    setSaving('payment');
    try {
      setBooking(await api.bookings.updatePayment(bookingId, {
        ...payment,
        paid_amount: payment.paid_amount === undefined || payment.paid_amount === null ? null : Number(payment.paid_amount),
      }));
    } catch (err: any) {
      alert(err.message ?? 'Gagal menyimpan pembayaran');
    } finally {
      setSaving(null);
    }
  };

  const uploadPayment = async (file?: File) => {
    if (!file) return;
    setSaving('upload');
    try {
      const result = await api.bookings.uploadPaymentProof(bookingId, file);
      setBooking(result.booking);
      setPayment((p) => ({ ...p, admin_payment_proof_url: result.url }));
    } catch (err: any) {
      alert(err.message ?? 'Gagal upload bukti pembayaran');
    } finally {
      setSaving(null);
    }
  };

  const saveLocation = async () => {
    setSaving('location');
    try {
      setBooking(await api.bookings.updateLocation(bookingId, {
        latitude: Number(locationForm.latitude),
        longitude: Number(locationForm.longitude),
      }));
    } catch (err: any) {
      alert(err.message ?? 'Gagal menyimpan lokasi kendaraan');
    } finally {
      setSaving(null);
    }
  };

  const fmtMoney = (n?: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(n ?? 0));
  const fmtDate = (value?: string) => value ? new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-';
  const currentLat = booking?.vehicle_latitude ?? booking?.sakoci?.latitude;
  const currentLng = booking?.vehicle_longitude ?? booking?.sakoci?.longitude;
  const mapsUrl = currentLat && currentLng
    ? `https://www.google.com/maps?q=${currentLat},${currentLng}`
    : '';

  if (loading) {
    return <div className="text-sm text-gray-500">Memuat detail booking...</div>;
  }

  if (error || !booking) {
    return (
      <div>
        <a href="/admin/booking" className="text-sm text-gray-500 hover:text-[#1a3a2e] mb-3 block">← Manajemen Booking</a>
        <div className="bg-white rounded-xl shadow p-8 text-center text-gray-500">{error || 'Booking tidak ditemukan'}</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <a href="/admin/booking" className="text-sm text-gray-500 hover:text-[#1a3a2e] mb-1 block">← Manajemen Booking</a>
          <h1 className="text-2xl font-bold text-[#1a3a2e]">Detail Booking #{booking.id}</h1>
          <p className="text-sm text-gray-500">{booking.group_name} • dibuat {fmtDate(booking.created_at)}</p>
        </div>
        <select
          value={booking.status}
          onChange={(e) => saveStatus(e.target.value)}
          disabled={saving === 'status'}
          className="border rounded-lg px-3 py-2 text-sm bg-white"
        >
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>{STATUS_LABEL[status]}</option>
          ))}
        </select>
      </div>

      <div className="grid xl:grid-cols-3 gap-6">
        <section className="xl:col-span-2 space-y-6">
          <Panel title="Informasi Perjalanan">
            <div className="grid md:grid-cols-2 gap-4">
              <Info label="Status perjalanan" value={STATUS_LABEL[booking.status] ?? booking.status} />
              <Info label="Jenis layanan" value={booking.booking_type ?? 'package'} />
              <Info label="Nama rombongan" value={booking.group_name} />
              <Info label="Jumlah peserta" value={`${booking.participants} orang`} />
              <Info label="Email" value={booking.contact_email ?? '-'} />
              <Info label="No. HP / WhatsApp" value={booking.contact_phone ?? '-'} />
              <Info label="Tanggal kunjungan" value={booking.visit_date ? new Date(booking.visit_date).toLocaleDateString('id-ID', { dateStyle: 'medium' }) : '-'} />
              <Info label="Jam jemput" value={booking.pickup_time ?? '-'} />
              <Info label="Lokasi jemput" value={booking.pickup_location ?? '-'} />
              <Info label="Total tagihan" value={fmtMoney(booking.total_price)} strong />
            </div>
            {booking.pickup_maps_url && (
              <a href={booking.pickup_maps_url} target="_blank" rel="noreferrer" className="inline-block text-sm text-blue-600 hover:underline mt-4">
                Buka titik jemput di Google Maps
              </a>
            )}
            {booking.notes && <p className="text-sm text-gray-600 mt-4 border-t pt-4">{booking.notes}</p>}
          </Panel>

          <Panel title="Destinasi">
            {booking.booking_type === 'rental' ? (
              <div className="text-sm text-gray-600">
                <p className="font-semibold text-gray-800">{booking.rental_option?.name ?? 'Sewa kendaraan'}</p>
                <p className="mt-1">{booking.rental_option?.description ?? 'Destinasi mengikuti kebutuhan rombongan.'}</p>
              </div>
            ) : destinations.length === 0 ? (
              <p className="text-sm text-gray-400">Belum ada destinasi yang tercatat.</p>
            ) : (
              <div className="divide-y">
                {destinations.map((site, index) => (
                  <div key={`${site.id}-${index}`} className="py-3 flex gap-3">
                    <span className="w-8 h-8 rounded-full bg-[#1a3a2e] text-white flex items-center justify-center text-sm font-bold shrink-0">{index + 1}</span>
                    <div>
                      <p className="font-semibold text-gray-800">{site.name}</p>
                      <p className="text-sm text-gray-500">{site.address ?? site.kecamatan ?? '-'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Finalisasi Rute">
            <div className="grid md:grid-cols-3 gap-4">
              <Info label="Status route" value={routeRequired ? (routeSnapshot?.routeStatus ?? 'belum difinalisasi') : 'tidak wajib'} />
              <Info label="Total jarak" value={routeSnapshot?.totalDistanceKm ? `${Number(routeSnapshot.totalDistanceKm).toFixed(2)} km` : '-'} />
              <Info label="Estimasi durasi" value={routeSnapshot?.totalDurationMinutes ? `${Math.round(Number(routeSnapshot.totalDurationMinutes))} menit` : '-'} />
            </div>
            {routeSnapshot?.errorMessage && (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{routeSnapshot.errorMessage}</p>
            )}
            {routeSnapshot?.staleReason && (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{routeSnapshot.staleReason}</p>
            )}
            {routeSnapshot?.orderedDestinationIds?.length ? (
              <div className="mt-4 rounded-lg bg-gray-50 p-3">
                <p className="text-xs font-bold uppercase text-gray-500">Urutan final</p>
                {routeSnapshot.orderedDestinationIds.map((id, index) => {
                  const site = destinations.find((item) => item.id === id);
                  return <p key={id} className="mt-1 text-sm text-gray-700">{index + 1}. {site?.name ?? `Destinasi #${id}`}</p>;
                })}
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <button onClick={finalizeRoute} disabled={saving === 'route-finalize' || booking.payment_status !== 'paid' || !routeRequired}
                className="rounded-lg bg-[#1a3a2e] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {saving === 'route-finalize' ? 'Memfinalisasi...' : 'Finalisasi Rute'}
              </button>
              <button onClick={reoptimizeRoute} disabled={saving === 'route-reoptimize' || !routeRequired || routeSnapshot?.routeStatus !== 'final'}
                className="rounded-lg border px-4 py-2 text-sm font-semibold text-[#1a3a2e] disabled:opacity-50">
                Optimasi Ulang
              </button>
            </div>
          </Panel>

          <Panel title="Live Monitoring Kendaraan Sakoci">
            <div className="grid md:grid-cols-3 gap-4">
              <Info label="Kendaraan" value={booking.vehicle_name ?? '-'} />
              <Info label="Nomor polisi" value={booking.vehicle_plate_number ?? '-'} />
              <Info label="Sakoci" value={booking.sakoci?.name ?? '-'} />
              <Info label="Tracking" value={booking.sakoci ? `${booking.sakoci.tracking_enabled ? 'Aktif' : 'Mati'} / ${booking.sakoci.tracking_visibility}` : '-'} />
              <Info label="Update terakhir" value={fmtDate(booking.vehicle_location_updated_at ?? booking.sakoci?.location_updated_at ?? undefined)} />
            </div>
            <p className={`text-xs mt-3 ${socketConnected ? 'text-green-700' : 'text-gray-400'}`}>
              WebSocket {socketConnected ? 'terhubung' : 'belum terhubung'} untuk update lokasi dari HP driver.
            </p>
            <div className="mt-4 bg-gray-50 border rounded-lg p-4">
              {mapsUrl ? (
                <div>
                  <p className="text-sm text-gray-600 mb-2">
                    Koordinat terakhir: {currentLat}, {currentLng}
                  </p>
                  <a href={mapsUrl} target="_blank" rel="noreferrer" className="inline-block bg-[#1a3a2e] text-white px-4 py-2 rounded-lg text-sm font-semibold">
                    Buka posisi kendaraan
                  </a>
                </div>
              ) : (
                <p className="text-sm text-gray-400">Belum ada lokasi kendaraan. Data ini disiapkan untuk update dari HP driver.</p>
              )}
            </div>
            {driverTrip?.route_snapshot?.geojson && (
              <div className="mt-4 overflow-hidden rounded-2xl border border-emerald-100">
                <DriverTripMap
                  trip={driverTrip}
                  currentPosition={currentLat && currentLng ? { latitude: Number(currentLat), longitude: Number(currentLng) } : null}
                  heightClass="h-[360px]"
                />
              </div>
            )}
            <div className="grid md:grid-cols-3 gap-3 mt-4">
              <input value={locationForm.latitude} onChange={(e) => setLocationForm((f) => ({ ...f, latitude: e.target.value }))}
                placeholder="Latitude" className="border rounded-lg px-3 py-2 text-sm" />
              <input value={locationForm.longitude} onChange={(e) => setLocationForm((f) => ({ ...f, longitude: e.target.value }))}
                placeholder="Longitude" className="border rounded-lg px-3 py-2 text-sm" />
              <button onClick={saveLocation} disabled={saving === 'location'} className="bg-[#1a3a2e] text-white rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50">
                Simpan Lokasi
              </button>
            </div>
          </Panel>
        </section>

        <aside className="space-y-6">
          <Panel title="Assignment Trip Driver">
            {booking.status !== 'confirmed' && !driverTrip && (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                Konfirmasi booking terlebih dahulu sebelum membuat assignment.
              </div>
            )}
            {!routeFinal && (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                Finalisasi rute diperlukan sebelum assignment.
              </div>
            )}
            {driverTrip && (
              <div className="mb-4 rounded-xl bg-emerald-50 p-4">
                <p className="text-xs font-bold uppercase text-emerald-700">Status Perjalanan</p>
                <p className="mt-1 font-bold text-emerald-950">{TRIP_STATUS_LABEL[driverTrip.trip_status] ?? driverTrip.trip_status}</p>
                <p className="mt-2 text-xs text-emerald-800">
                  Tracking {driverTrip.tracking_active ? 'aktif' : 'tidak aktif'} • {driverTrip.booking_reference}
                </p>
              </div>
            )}

            <label className="block text-sm font-medium text-gray-700 mb-1">Driver</label>
            <select value={tripForm.driver_id} onChange={(e) => updateTripForm((form) => ({ ...form, driver_id: e.target.value }))}
              disabled={Boolean(driverTrip && !['ASSIGNED', 'ACCEPTED', 'CANCELLED'].includes(driverTrip.trip_status))}
              className="w-full border rounded-lg px-3 py-2 text-sm mb-3 disabled:bg-gray-100">
              <option value="">Pilih Driver</option>
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id} disabled={assignmentConflicts.drivers.has(driver.id)}>
                  {driver.name}{assignmentConflicts.drivers.has(driver.id) ? ' — tidak tersedia pada jadwal ini' : ' — tersedia'}
                </option>
              ))}
            </select>

            <label className="block text-sm font-medium text-gray-700 mb-1">Tour Guide</label>
            <select value={tripForm.tour_guide_id} onChange={(e) => updateTripForm((form) => ({ ...form, tour_guide_id: e.target.value }))}
              disabled={Boolean(driverTrip && !['ASSIGNED', 'ACCEPTED', 'CANCELLED'].includes(driverTrip.trip_status))}
              className="w-full border rounded-lg px-3 py-2 text-sm mb-3 disabled:bg-gray-100">
              <option value="">Tanpa Tour Guide</option>
              {guides.map((guide) => (
                <option key={guide.id} value={guide.id} disabled={assignmentConflicts.guides.has(guide.id)}>
                  {guide.name}{assignmentConflicts.guides.has(guide.id) ? ' — tidak tersedia pada jadwal ini' : ' — tersedia'}
                </option>
              ))}
            </select>

            <label className="block text-sm font-medium text-gray-700 mb-1">Sakoci</label>
            <select value={tripForm.sakoci_id} onChange={(e) => updateTripForm((form) => ({ ...form, sakoci_id: e.target.value }))}
              disabled={Boolean(driverTrip && !['ASSIGNED', 'ACCEPTED', 'CANCELLED'].includes(driverTrip.trip_status))}
              className="w-full border rounded-lg px-3 py-2 text-sm mb-3 disabled:bg-gray-100">
              <option value="">Pilih Sakoci</option>
              {sakociList.map((sakoci) => (
                <option key={sakoci.id} value={sakoci.id} disabled={sakoci.status === 'maintenance' || sakoci.status === 'inactive' || assignmentConflicts.sakoci.has(sakoci.id)}>
                  {sakoci.code || sakoci.name} • {sakoci.plate_number || '-'} ({assignmentConflicts.sakoci.has(sakoci.id) ? 'jadwal bertabrakan' : sakoci.status})
                </option>
              ))}
            </select>

            <div className="mb-3 rounded-lg border bg-gray-50 px-3 py-2">
              <Info label="Jadwal Wisatawan" value={bookingSchedule ? fmtDate(bookingSchedule) : '-'} />
              <p className="mt-1 text-xs text-gray-500">Mengikuti tanggal dan jam keberangkatan dari data pemesanan.</p>
            </div>

            <label className="block text-sm font-medium text-gray-700 mb-1">Driver Wajib Siap</label>
            <input type="datetime-local" value={tripForm.driver_ready_at}
              onChange={(e) => updateTripForm((form) => ({ ...form, driver_ready_at: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm mb-1" />
            {tripForm.scheduled_user_pickup_at && tripForm.driver_ready_at && (
              <p className="mb-3 text-xs text-gray-500">
                Waktu persiapan {Math.max(0, Math.round((new Date(tripForm.scheduled_user_pickup_at).getTime() - new Date(tripForm.driver_ready_at).getTime()) / 60_000))} menit sebelum jadwal wisatawan.
              </p>
            )}

            <label className="block text-sm font-medium text-gray-700 mb-1">Estimasi Durasi (menit)</label>
            <input type="number" min={1} value={tripForm.estimated_duration_minutes}
              onChange={(e) => updateTripForm((form) => ({ ...form, estimated_duration_minutes: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm mb-3" />

            <div className="mb-3 rounded-lg bg-gray-50 p-3">
              <p className="text-xs font-bold uppercase text-gray-500">Snapshot Urutan Destinasi</p>
              {destinations.map((site, index) => <p key={site.id} className="mt-1 text-sm text-gray-700">{index + 1}. {site.name}</p>)}
              {!destinations.length && <p className="mt-1 text-sm text-gray-400">Belum ada destinasi.</p>}
            </div>

            <details className="mb-4 rounded-lg border p-3">
              <summary className="cursor-pointer text-sm font-semibold text-gray-700">Titik akhir / pool (opsional)</summary>
              <div className="mt-3 space-y-2">
                <input value={tripForm.endpoint_name} onChange={(e) => updateTripForm((form) => ({ ...form, endpoint_name: e.target.value }))} placeholder="Nama titik akhir" className="w-full border rounded-lg px-3 py-2 text-sm" />
                <input value={tripForm.endpoint_address} onChange={(e) => updateTripForm((form) => ({ ...form, endpoint_address: e.target.value }))} placeholder="Alamat" className="w-full border rounded-lg px-3 py-2 text-sm" />
                <div className="grid grid-cols-2 gap-2">
                  <input type="number" value={tripForm.endpoint_latitude} onChange={(e) => updateTripForm((form) => ({ ...form, endpoint_latitude: e.target.value }))} placeholder="Latitude" className="w-full border rounded-lg px-3 py-2 text-sm" />
                  <input type="number" value={tripForm.endpoint_longitude} onChange={(e) => updateTripForm((form) => ({ ...form, endpoint_longitude: e.target.value }))} placeholder="Longitude" className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
            </details>

            <button onClick={saveTripAssignment}
              disabled={saving === 'trip-assignment' || booking.status !== 'confirmed' || !routeFinal || Boolean(driverTrip && !['ASSIGNED', 'ACCEPTED', 'CANCELLED'].includes(driverTrip.trip_status))}
              className="w-full bg-[#1a3a2e] text-white rounded-lg px-4 py-2.5 text-sm font-semibold disabled:opacity-50">
              {saving === 'trip-assignment' ? 'Menyimpan...' : driverTrip ? 'Perbarui Assignment' : 'Simpan Assignment'}
            </button>
            {driverTrip && !['COMPLETED', 'CANCELLED'].includes(driverTrip.trip_status) && (
              <button onClick={cancelTripAssignment} disabled={saving === 'trip-cancel'} className="mt-2 w-full rounded-lg border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 disabled:opacity-50">
                Batalkan Assignment
              </button>
            )}

            {driverTrip?.tour_guide && (
              <div className="mt-5 rounded-lg bg-sky-50 p-3 text-xs text-sky-800">
                <strong>Tour Guide:</strong> {driverTrip.tour_guide.name}
                <br />Status sesi: {currentGuideSessionLabel(driverTrip)}
              </div>
            )}

            {driverTrip?.incidents?.length ? (
              <div className="mt-5 border-t pt-4">
                <p className="text-sm font-bold text-gray-800">Laporan Kendala Driver / Guide</p>
                {driverTrip.incidents.map((incident) => (
                  <div key={incident.id} className="mt-2 rounded-lg bg-amber-50 p-3 text-xs">
                    <div className="flex justify-between gap-2"><strong>{incident.issue_type}</strong><span>{incident.status}</span></div>
                    <p className="mt-1 text-gray-600">{incident.description}</p>
                  </div>
                ))}
              </div>
            ) : null}
          </Panel>

          <Panel title="Pembayaran">
            <label className="block text-sm font-medium text-gray-700 mb-1">Status pembayaran</label>
            <select value={payment.payment_status ?? 'unpaid'} onChange={(e) => setPayment((p) => ({ ...p, payment_status: e.target.value as BookingPaymentBody['payment_status'] }))}
              className="w-full border rounded-lg px-3 py-2 text-sm mb-3">
              {PAYMENT_OPTIONS.map((status) => <option key={status} value={status}>{PAYMENT_LABEL[status]}</option>)}
            </select>

            <label className="block text-sm font-medium text-gray-700 mb-1">Metode</label>
            <input value={payment.payment_method ?? ''} onChange={(e) => setPayment((p) => ({ ...p, payment_method: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm mb-3" placeholder="Transfer bank / tunai" />

            <label className="block text-sm font-medium text-gray-700 mb-1">Nominal dibayar</label>
            <input type="number" value={payment.paid_amount ?? ''} onChange={(e) => setPayment((p) => ({ ...p, paid_amount: Number(e.target.value) }))}
              className="w-full border rounded-lg px-3 py-2 text-sm mb-3" />

            <label className="block text-sm font-medium text-gray-700 mb-1">Link bukti dari user</label>
            <input value={payment.payment_proof_url ?? ''} onChange={(e) => setPayment((p) => ({ ...p, payment_proof_url: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm mb-3" placeholder="https://..." />

            <label className="block text-sm font-medium text-gray-700 mb-1">Upload bukti oleh admin</label>
            <input type="file" accept="image/*,.pdf" onChange={(e) => uploadPayment(e.target.files?.[0])}
              className="w-full border rounded-lg px-3 py-2 text-sm mb-3 bg-white" />

            {(booking.payment_proof_url || booking.admin_payment_proof_url) && (
              <div className="text-sm space-y-1 mb-3">
                {booking.payment_proof_url && <button type="button" onClick={() => api.bookings.openPaymentProof(bookingId, 'customer').catch((err) => setError(err.message))} className="block text-blue-600 hover:underline">Lihat bukti dari user</button>}
                {booking.admin_payment_proof_url && <button type="button" onClick={() => api.bookings.openPaymentProof(bookingId, 'admin').catch((err) => setError(err.message))} className="block text-blue-600 hover:underline">Lihat bukti dari admin</button>}
              </div>
            )}

            <label className="block text-sm font-medium text-gray-700 mb-1">Keterangan</label>
            <textarea rows={3} value={payment.payment_notes ?? ''} onChange={(e) => setPayment((p) => ({ ...p, payment_notes: e.target.value }))}
              className="w-full border rounded-lg px-3 py-2 text-sm mb-4" placeholder="Catatan verifikasi pembayaran" />

            <button onClick={savePayment} disabled={saving === 'payment'} className="w-full bg-[#1a3a2e] text-white rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50">
              Simpan Pembayaran
            </button>
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function currentGuideSessionLabel(trip: DriverTrip) {
  const current = trip.itinerary_items?.find((item) => item.id === trip.current_itinerary_item_id);
  const session = current ? trip.guide_sessions?.find((item) => item.itinerary_item_id === current.id) : null;
  const labels: Record<string, string> = {
    PENDING: 'Menunggu Sakoci tiba',
    READY: 'Siap dimulai',
    IN_PROGRESS: 'Sesi penjelasan berlangsung',
    COMPLETED: 'Selesai',
    SKIPPED: 'Dilewati',
  };
  return session ? labels[session.session_status] ?? session.session_status : '-';
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl shadow p-5">
      <h2 className="font-bold text-[#1a3a2e] mb-4">{title}</h2>
      {children}
    </section>
  );
}

function Info({ label, value, strong }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return (
    <div>
      <p className="text-xs uppercase text-gray-400 mb-1">{label}</p>
      <p className={`text-sm ${strong ? 'font-bold text-[#1a3a2e]' : 'text-gray-700'}`}>{value}</p>
    </div>
  );
}

function bookingDateTime(date?: string, time?: string) {
  if (!date || !time) return '';
  const datePart = new Date(date).toISOString().slice(0, 10);
  const timePart = time.match(/^\d{2}:\d{2}/)?.[0];
  return timePart ? `${datePart}T${timePart}:00+07:00` : '';
}

function toLocalInput(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
}
