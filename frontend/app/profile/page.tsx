'use client';

import { useEffect, useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { api, AuthUser, Booking, ProfileBody } from '@/lib/api';
import BackendAssetImage from '@/components/ui/BackendAssetImage';

const emptyProfile: ProfileBody = {
  name: '',
  nik: '',
  birth_place: '',
  birth_date: '',
  domicile: '',
  ktp_address: '',
};

export default function ProfilePage() {
  const router = useRouter();
  const { data: session, status, update } = useSession();
  const token = session?.accessToken;
  const [profile, setProfile] = useState<AuthUser | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [form, setForm] = useState<ProfileBody>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login?callbackUrl=/profile');
  }, [router, status]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([api.auth.me(token), api.bookings.mine(token).catch(() => [] as Booking[])])
      .then(([user, bookingData]) => {
        setProfile(user);
        setBookings(bookingData);
        setForm({
          name: user.name ?? '',
          nik: user.nik ?? '',
          birth_place: user.birth_place ?? '',
          birth_date: (user.birth_date ?? '').slice(0, 10),
          domicile: user.domicile ?? '',
          ktp_address: user.ktp_address ?? '',
          avatar_url: user.avatar_url ?? undefined,
        });
      })
      .catch((err: any) => setMessage(err.message ?? 'Gagal memuat halaman user'))
      .finally(() => setLoading(false));
  }, [token]);

  const set = <K extends keyof ProfileBody>(key: K, value: ProfileBody[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setMessage('');
  };

  const save = async () => {
    if (!token) return;
    if (!form.name.trim()) return setMessage('Nama wajib diisi');
    if (!form.nik.trim()) return setMessage('NIK wajib diisi');
    if (!form.birth_place.trim()) return setMessage('Tempat lahir wajib diisi');
    if (!form.birth_date) return setMessage('Tanggal lahir wajib diisi');
    if (!form.domicile.trim()) return setMessage('Domisili saat ini wajib diisi');
    if (!form.ktp_address.trim()) return setMessage('Alamat sesuai KTP wajib diisi');

    setSaving(true);
    try {
      const updated = await api.auth.updateProfile({
        ...form,
        name: form.name.trim(),
        nik: form.nik.trim(),
        birth_place: form.birth_place.trim(),
        domicile: form.domicile.trim(),
        ktp_address: form.ktp_address.trim(),
      }, token);
      setProfile(updated);
      await update({
        ...session,
        user: {
          ...session?.user,
          name: updated.name,
          avatar_url: updated.avatar_url,
          image: updated.avatar_url,
        },
      });
      setMessage('Profile berhasil diperbarui');
    } catch (err: any) {
      setMessage(err.message ?? 'Gagal menyimpan profile');
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (file?: File) => {
    if (!file || !token) return;
    setUploading(true);
    try {
      const updated = await api.auth.uploadAvatar(file, token);
      setProfile(updated);
      setForm((current) => ({ ...current, avatar_url: updated.avatar_url ?? undefined }));
      await update({
        ...session,
        user: {
          ...session?.user,
          avatar_url: updated.avatar_url,
          image: updated.avatar_url,
        },
      });
      setMessage('Foto profile berhasil diperbarui');
    } catch (err: any) {
      setMessage(err.message ?? 'Gagal upload foto profile');
    } finally {
      setUploading(false);
    }
  };

  if (status === 'loading' || loading) {
    return <div className="mx-auto max-w-4xl px-4 py-10 text-sm text-gray-500">Memuat profile...</div>;
  }

  if (!session) return null;

  const avatarUrl = form.avatar_url ?? profile?.avatar_url;
  const initials = (form.name || session.user?.email || 'U').slice(0, 1).toUpperCase();
  const fmtMoney = (value?: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value ?? 0));
  const fmtDate = (value?: string) => value ? new Date(value).toLocaleDateString('id-ID', { dateStyle: 'medium' }) : '-';
  const statusLabel: Record<string, string> = {
    pending: 'Menunggu konfirmasi',
    confirmed: 'Dikonfirmasi',
    completed: 'Selesai',
    cancelled: 'Dibatalkan',
  };
  const paymentLabel: Record<string, string> = {
    unpaid: 'Belum dibayar',
    waiting_verification: 'Menunggu verifikasi',
    paid: 'Lunas',
    rejected: 'Ditolak',
    refunded: 'Dikembalikan',
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#1a3a2e]">Profile</h1>
          <p className="mt-1 text-sm text-gray-500">Kelola foto profile dan data identitas akun.</p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/' })}
          className="rounded-md border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
        >
          Logout
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="h-fit rounded-lg bg-white p-6 text-center shadow">
          <div className="mx-auto h-32 w-32 overflow-hidden rounded-full bg-sky-500 text-white">
            {avatarUrl ? (
              <BackendAssetImage src={avatarUrl} fallback="/images/branding/logo-disbudparpora.png" alt={form.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-4xl font-bold">{initials}</div>
            )}
          </div>
          <h2 className="mt-4 text-lg font-bold text-[#1a3a2e]">{form.name || session.user?.email}</h2>
          <p className="text-sm text-gray-500">{session.user?.email}</p>
          <label className="mt-5 block cursor-pointer rounded-md bg-[#1a3a2e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#132a21]">
            {uploading ? 'Mengunggah...' : 'Update Foto'}
            <input
              type="file"
              accept="image/*"
              disabled={uploading}
              onChange={(event) => uploadAvatar(event.target.files?.[0])}
              className="hidden"
            />
          </label>
        </aside>

        <section className="rounded-lg bg-white p-6 shadow">
          {message && (
            <div className="mb-5 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              {message}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nama">
              <input value={form.name} onChange={(event) => set('name', event.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm" />
            </Field>
            <Field label="NIK">
              <input value={form.nik} onChange={(event) => set('nik', event.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm" />
            </Field>
            <Field label="Tempat Lahir">
              <input value={form.birth_place} onChange={(event) => set('birth_place', event.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm" />
            </Field>
            <Field label="Tanggal Lahir">
              <input type="date" value={form.birth_date} onChange={(event) => set('birth_date', event.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm" />
            </Field>
            <Field label="Domisili Saat Ini">
              <input value={form.domicile} onChange={(event) => set('domicile', event.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm" />
            </Field>
            <div className="md:col-span-2">
              <Field label="Alamat Saat Ini Sesuai KTP">
                <textarea rows={4} value={form.ktp_address} onChange={(event) => set('ktp_address', event.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm" />
              </Field>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={save}
              disabled={saving}
              className="rounded-md bg-[#1a3a2e] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#132a21] disabled:opacity-50"
            >
              {saving ? 'Menyimpan...' : 'Simpan Profile'}
            </button>
          </div>
        </section>
      </div>

      <section className="mt-8 rounded-lg bg-white p-6 shadow">
        <div className="mb-5 flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#1a3a2e]">Pesanan Saya</h2>
            <p className="text-sm text-gray-500">Detail pesanan, pembayaran, petugas, dan tracking Sakoci untuk akun ini.</p>
          </div>
          <a href="/booking" className="w-fit rounded-md bg-[#1a3a2e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#132a21]">
            Buat Pesanan
          </a>
        </div>

        {bookings.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-sm text-gray-500">
            Belum ada pesanan pada akun ini.
          </div>
        ) : (
          <div className="space-y-4">
            {bookings.map((booking) => {
              const lat = booking.vehicle_latitude ?? booking.sakoci?.latitude;
              const lng = booking.vehicle_longitude ?? booking.sakoci?.longitude;
              const mapsUrl = lat && lng ? `https://www.google.com/maps?q=${lat},${lng}` : '';
              return (
                <article key={booking.id} className="rounded-lg border p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-xs text-gray-500">Booking #{booking.id}</p>
                      <h3 className="font-bold text-gray-800">{booking.group_name}</h3>
                      <p className="text-sm text-gray-500">
                        {booking.booking_type ?? 'package'} • {fmtDate(booking.visit_date)} • {booking.participants} peserta
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge label={statusLabel[booking.status] ?? booking.status} />
                      <Badge label={paymentLabel[booking.payment_status ?? 'unpaid'] ?? booking.payment_status ?? 'Belum dibayar'} />
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-4">
                    <MiniInfo label="Layanan" value={booking.tour_package?.name ?? booking.rental_option?.name ?? 'Private tour'} />
                    <MiniInfo label="Total" value={fmtMoney(booking.total_price)} />
                    <MiniInfo label="Driver" value={booking.driver?.name ?? 'Menunggu penugasan'} />
                    <MiniInfo label="Tour guide" value={booking.tour_guide?.name ?? 'Menunggu penugasan'} />
                  </div>

                  <div className="mt-4 rounded-lg bg-gray-50 p-4">
                    <div className="grid gap-3 md:grid-cols-3">
                      <MiniInfo label="Sakoci" value={booking.sakoci?.name ?? booking.vehicle_name ?? 'Belum ditugaskan'} />
                      <MiniInfo label="Nomor Polisi" value={booking.sakoci?.plate_number ?? booking.vehicle_plate_number ?? '-'} />
                      <MiniInfo label="Update Lokasi" value={booking.vehicle_location_updated_at ? new Date(booking.vehicle_location_updated_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '-'} />
                    </div>
                    {mapsUrl ? (
                      <a href={mapsUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block rounded-md bg-[#1a3a2e] px-4 py-2 text-sm font-semibold text-white hover:bg-[#132a21]">
                        Lihat Posisi Sakoci
                      </a>
                    ) : (
                      <p className="mt-3 text-sm text-gray-500">Tracking Sakoci belum tersedia atau tidak ditampilkan untuk pesanan ini.</p>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <a href={`/booking/${booking.id}`} className="rounded-md border border-[#1a3a2e] px-4 py-2 text-sm font-semibold text-[#1a3a2e]">
                      Detail Receipt
                    </a>
                    {booking.payment_status !== 'paid' && !['assigned', 'in_progress', 'completed', 'cancelled'].includes(booking.status) && (
                      <a href={`/booking/${booking.id}/edit`} className="rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold text-white">
                        Edit Perjalanan
                      </a>
                    )}
                    {booking.pickup_maps_url && (
                      <a href={booking.pickup_maps_url} target="_blank" rel="noreferrer" className="rounded-md border px-4 py-2 text-sm font-semibold text-gray-600">
                        Titik Jemput
                      </a>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-semibold text-gray-700">{label}</label>
      {children}
    </div>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
      {label}
    </span>
  );
}

function MiniInfo({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase text-gray-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-gray-800">{value}</p>
    </div>
  );
}
