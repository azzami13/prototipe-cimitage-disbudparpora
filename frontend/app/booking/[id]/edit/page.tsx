'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { api, Booking, HeritageSite } from '@/lib/api';
import PickupMapPicker from '@/components/maps/PickupMapPicker';

export default function EditBookingTravelPage({ params }: { params: { id: string } }) {
  const bookingId = Number(params.id);
  const router = useRouter();
  const { data: session, status } = useSession();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [sites, setSites] = useState<HeritageSite[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [siteSearch, setSiteSearch] = useState('');
  const [form, setForm] = useState({
    group_name: '',
    participants: 1,
    visit_date: '',
    pickup_time: '',
    pickup_location: '',
    pickup_maps_url: '',
    pickup_latitude: undefined as number | undefined,
    pickup_longitude: undefined as number | undefined,
    private_destination_ids: [] as number[],
    contact_phone: '',
    notes: '',
  });
  const todayKey = useMemo(() => jakartaTodayKey(), []);

  useEffect(() => {
    if (status === 'unauthenticated') router.push(`/login?callbackUrl=/booking/${bookingId}/edit`);
  }, [bookingId, router, status]);

  useEffect(() => {
    if (!session?.accessToken || !Number.isInteger(bookingId) || bookingId < 1) return;
    setLoading(true);
    Promise.all([
      api.bookings.one(bookingId),
      api.heritage.list({ limit: '200' }).catch(() => ({ data: [] as HeritageSite[] })),
    ])
      .then(([bookingData, heritageData]) => {
        setBooking(bookingData);
        setSites(heritageData.data ?? []);
        setForm({
          group_name: bookingData.group_name ?? '',
          participants: Number(bookingData.participants ?? 1),
          visit_date: (bookingData.visit_date ?? '').slice(0, 10),
          pickup_time: bookingData.pickup_time ?? '',
          pickup_location: bookingData.pickup_location ?? '',
          pickup_maps_url: bookingData.pickup_maps_url ?? '',
          pickup_latitude: bookingData.pickup_latitude,
          pickup_longitude: bookingData.pickup_longitude,
          private_destination_ids: bookingData.private_destination_ids ?? [],
          contact_phone: bookingData.contact_phone ?? '',
          notes: bookingData.notes ?? '',
        });
      })
      .catch((err) => setError(err.message ?? 'Gagal memuat booking'))
      .finally(() => setLoading(false));
  }, [bookingId, session?.accessToken]);

  const canEdit = booking && booking.payment_status !== 'paid' && !['assigned', 'in_progress', 'completed', 'cancelled'].includes(booking.status);
  const filteredSites = useMemo(() => {
    const q = siteSearch.trim().toLowerCase();
    return q ? sites.filter((site) => site.name.toLowerCase().includes(q)) : sites;
  }, [siteSearch, sites]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setError('');
  };

  const toggleDestination = (id: number) => {
    setForm((current) => ({
      ...current,
      private_destination_ids: current.private_destination_ids.includes(id)
        ? current.private_destination_ids.filter((item) => item !== id)
        : [...current.private_destination_ids, id],
    }));
  };

  const save = async () => {
    if (!booking || !canEdit) return;
    if (!form.group_name.trim()) return setError('Nama rombongan wajib diisi');
    if (!form.visit_date) return setError('Tanggal keberangkatan wajib diisi');
    if (form.visit_date < todayKey) return setError('Tanggal perjalanan tidak boleh tanggal lampau');
    if (!form.pickup_time) return setError('Jam keberangkatan wajib diisi');
    if (booking.booking_type !== 'package' && !form.pickup_location.trim()) return setError('Tempat jemput wajib diisi');
    if (booking.booking_type === 'private' && form.private_destination_ids.length < 1) return setError('Pilih minimal 1 destinasi');

    setSaving(true);
    try {
      const updated = await api.bookings.updateMyTravel(booking.id, {
        ...form,
        group_name: form.group_name.trim(),
        pickup_location: form.pickup_location.trim(),
        pickup_maps_url: form.pickup_maps_url.trim(),
        contact_phone: form.contact_phone.trim(),
        notes: form.notes.trim(),
      });
      router.push(`/booking/${updated.id}`);
    } catch (err: any) {
      setError(err.message ?? 'Gagal menyimpan detail perjalanan');
    } finally {
      setSaving(false);
    }
  };

  if (status === 'loading' || loading) {
    return <div className="mx-auto max-w-3xl px-4 py-12 text-sm text-gray-500">Memuat form edit...</div>;
  }

  if (!booking) {
    return <div className="mx-auto max-w-3xl px-4 py-12 text-sm text-red-600">{error || 'Booking tidak ditemukan'}</div>;
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <a href="/my-orders" className="mb-4 inline-block text-sm font-semibold text-gray-500 hover:text-[#1a3a2e]">← Pesanan Saya</a>
      <div className="mb-6">
        <p className="text-sm text-gray-500">Booking #{booking.id}</p>
        <h1 className="text-3xl font-bold text-[#1a3a2e]">Edit Detail Perjalanan</h1>
        <p className="mt-1 text-sm text-gray-500">Bisa diedit sampai pembayaran dikonfirmasi admin.</p>
      </div>

      {!canEdit && (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Booking ini tidak bisa diedit lagi karena pembayaran sudah dikonfirmasi atau perjalanan sudah masuk proses operasional.
        </div>
      )}
      {error && <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <section className="rounded-xl bg-white p-6 shadow">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Nama Rombongan">
            <input value={form.group_name} disabled={!canEdit} onChange={(event) => set('group_name', event.target.value)} className={inputClass} />
          </Field>
          <Field label="Jumlah Peserta">
            <input type="number" min={1} value={form.participants} disabled={!canEdit} onChange={(event) => set('participants', Number(event.target.value))} className={inputClass} />
          </Field>
          <Field label="Tanggal Keberangkatan">
            <input type="date" min={todayKey} value={form.visit_date} disabled={!canEdit} onChange={(event) => set('visit_date', event.target.value)} className={inputClass} />
          </Field>
          <Field label="Jam Keberangkatan">
            <input type="time" value={form.pickup_time} disabled={!canEdit} onChange={(event) => set('pickup_time', event.target.value)} className={inputClass} />
          </Field>
          <Field label="No. HP / WhatsApp">
            <input value={form.contact_phone} disabled={!canEdit} onChange={(event) => set('contact_phone', event.target.value)} className={inputClass} />
          </Field>
          <Field label="Tempat Jemput">
            <input value={form.pickup_location} disabled={!canEdit} onChange={(event) => set('pickup_location', event.target.value)} className={inputClass} />
          </Field>
        </div>

        <div className="mt-4">
          <Field label="Titik Jemput di Peta">
            <PickupMapPicker
              value={{ lat: form.pickup_latitude, lng: form.pickup_longitude }}
              onChange={(point) => setForm((current) => ({
                ...current,
                pickup_latitude: point.lat,
                pickup_longitude: point.lng,
                pickup_maps_url: point.mapsUrl,
              }))}
            />
          </Field>
        </div>

        {booking.booking_type === 'private' && (
          <div className="mt-4">
            <Field label="Destinasi Private">
              <input value={siteSearch} disabled={!canEdit} onChange={(event) => setSiteSearch(event.target.value)} placeholder="Cari destinasi..." className={`${inputClass} mb-2`} />
              <div className="max-h-72 overflow-y-auto rounded-lg border">
                {filteredSites.slice(0, 100).map((site) => {
                  const checked = form.private_destination_ids.includes(site.id);
                  return (
                    <button key={site.id} type="button" disabled={!canEdit} onClick={() => toggleDestination(site.id)}
                      className={`flex w-full items-center gap-3 border-b px-3 py-2 text-left text-sm last:border-b-0 ${checked ? 'bg-emerald-50' : 'hover:bg-gray-50'}`}>
                      <span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold ${checked ? 'bg-[#1a3a2e] text-white' : 'border text-gray-400'}`}>
                        {checked ? form.private_destination_ids.indexOf(site.id) + 1 : '+'}
                      </span>
                      <span>{site.name}</span>
                    </button>
                  );
                })}
              </div>
            </Field>
          </div>
        )}

        <div className="mt-4">
          <Field label="Catatan">
            <textarea rows={4} value={form.notes} disabled={!canEdit} onChange={(event) => set('notes', event.target.value)} className={inputClass} />
          </Field>
        </div>

        <div className="mt-6 flex justify-end">
          <button onClick={save} disabled={!canEdit || saving} className="rounded-lg bg-[#1a3a2e] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
            {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      </section>
    </main>
  );
}

const inputClass = 'w-full rounded-lg border px-3 py-2 text-sm disabled:bg-gray-100';

function jakartaTodayKey() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-gray-700">{label}</span>
      {children}
    </label>
  );
}
