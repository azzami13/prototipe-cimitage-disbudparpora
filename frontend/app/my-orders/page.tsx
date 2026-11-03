'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { api, Booking } from '@/lib/api';

const statusLabel: Record<string, string> = {
  pending: 'Menunggu konfirmasi',
  confirmed: 'Dikonfirmasi',
  assigned: 'Ditugaskan',
  in_progress: 'Berjalan',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
};

const paymentLabel: Record<string, string> = {
  unpaid: 'Belum dibayar',
  waiting_verification: 'Menunggu verifikasi',
  paid: 'Lunas',
  rejected: 'Ditolak',
  expired: 'Kedaluwarsa',
  refunded: 'Dikembalikan',
};

export default function MyOrdersPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login?callbackUrl=/my-orders');
  }, [router, status]);

  useEffect(() => {
    if (!session?.accessToken) return;
    setLoading(true);
    api.bookings.mine(session.accessToken)
      .then(setBookings)
      .catch((err) => setError(err.message ?? 'Gagal memuat pesanan'))
      .finally(() => setLoading(false));
  }, [session?.accessToken]);

  if (status === 'loading' || loading) {
    return <div className="mx-auto max-w-5xl px-4 py-12 text-sm text-gray-500">Memuat pesanan...</div>;
  }

  if (!session) return null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-sky-600">Akun Customer</p>
          <h1 className="text-3xl font-bold text-[#1a3a2e]">Pesanan Saya</h1>
          <p className="mt-1 text-sm text-gray-500">Pantau status, buka receipt, dan edit detail perjalanan sebelum pembayaran dikonfirmasi admin.</p>
        </div>
        <a href="/booking" className="w-fit rounded-lg bg-[#1a3a2e] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#132a21]">
          Buat Pesanan Baru
        </a>
      </div>

      {error && <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {bookings.length === 0 ? (
        <section className="rounded-xl border border-dashed bg-white p-10 text-center shadow-sm">
          <h2 className="font-bold text-gray-800">Belum ada pesanan</h2>
          <p className="mt-1 text-sm text-gray-500">Pesanan yang dibuat dengan akun ini akan muncul di sini.</p>
        </section>
      ) : (
        <section className="grid gap-4">
          {bookings.map((booking) => {
            const canEdit = booking.payment_status !== 'paid' && !['assigned', 'in_progress', 'completed', 'cancelled'].includes(booking.status);
            return (
              <article key={booking.id} className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Booking #{booking.id}</p>
                    <h2 className="mt-1 text-xl font-bold text-gray-900">{booking.group_name}</h2>
                    <p className="mt-1 text-sm text-gray-500">
                      {booking.tour_package?.name ?? booking.rental_option?.name ?? 'Private tour'} · {formatDate(booking.visit_date)} · {booking.pickup_time ?? '-'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge>{statusLabel[booking.status] ?? booking.status}</Badge>
                    <Badge>{paymentLabel[booking.payment_status ?? 'unpaid'] ?? booking.payment_status}</Badge>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-4">
                  <Info label="Peserta" value={`${booking.participants} orang`} />
                  <Info label="Total" value={formatMoney(booking.total_price)} />
                  <Info label="Driver" value={booking.driver?.name ?? 'Belum ditugaskan'} />
                  <Info label="Sakoci" value={booking.sakoci?.name ?? booking.vehicle_name ?? 'Belum ditugaskan'} />
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <a href={`/booking/${booking.id}`} className="rounded-lg border border-[#1a3a2e] px-4 py-2 text-sm font-semibold text-[#1a3a2e] hover:bg-emerald-50">
                    Detail
                  </a>
                  <a href={`/booking/${booking.id}/receipt`} className="rounded-lg border px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                    Receipt
                  </a>
                  {canEdit && (
                    <a href={`/booking/${booking.id}/edit`} className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-600">
                      Edit Perjalanan
                    </a>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">{children}</span>;
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase text-gray-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-gray-800">{value}</p>
    </div>
  );
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleDateString('id-ID', { dateStyle: 'medium' }) : '-';
}

function formatMoney(value?: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value ?? 0));
}
