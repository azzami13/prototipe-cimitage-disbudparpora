'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { api, Booking } from '@/lib/api';

const paymentLabels: Record<string, { label: string; className: string }> = {
  unpaid: { label: 'Belum bayar', className: 'bg-gray-100 text-gray-700' },
  waiting_verification: { label: 'Menunggu verifikasi', className: 'bg-amber-100 text-amber-800' },
  paid: { label: 'Lunas', className: 'bg-green-100 text-green-800' },
  rejected: { label: 'Ditolak', className: 'bg-red-100 text-red-800' },
  refunded: { label: 'Refund', className: 'bg-blue-100 text-blue-800' },
};

const filters = ['', 'waiting_verification', 'unpaid', 'paid', 'rejected', 'refunded'];

function formatCurrency(value?: number | string | null) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

function formatDate(value?: string) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export default function PaymentsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [updating, setUpdating] = useState<number | null>(null);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    api.bookings
      .list({ limit: '100' })
      .then(({ data }) => setBookings(data))
      .catch((err) => setError(err.message ?? 'Gagal memuat pembayaran'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const visibleBookings = useMemo(() => {
    return bookings.filter((booking) => {
      const status = booking.payment_status ?? 'unpaid';
      return filter ? status === filter : true;
    });
  }, [bookings, filter]);

  const totals = useMemo(() => {
    return bookings.reduce(
      (acc, booking) => {
        const status = booking.payment_status ?? 'unpaid';
        acc.countByStatus[status] = (acc.countByStatus[status] ?? 0) + 1;
        acc.expected += Number(booking.total_price ?? 0);
        if (status === 'paid') acc.paid += Number(booking.paid_amount ?? booking.total_price ?? 0);
        return acc;
      },
      { expected: 0, paid: 0, countByStatus: {} as Record<string, number> },
    );
  }, [bookings]);

  const updatePayment = async (booking: Booking, payment_status: Booking['payment_status']) => {
    setUpdating(booking.id);
    try {
      let updated: Booking;
      if (payment_status === 'paid') {
        updated = await api.bookings.verifyPayment(booking.id, {
          paid_amount: Number(booking.paid_amount ?? booking.total_price ?? 0),
          payment_method: booking.payment_method ?? 'manual_transfer',
        });
      } else if (payment_status === 'rejected') {
        const reason = window.prompt('Alasan penolakan pembayaran (5-500 karakter):')?.trim();
        if (!reason) return;
        updated = await api.bookings.rejectPayment(booking.id, reason);
      } else {
        updated = await api.bookings.updatePayment(booking.id, {
          payment_status,
          payment_method: booking.payment_method ?? null,
          paid_amount: booking.paid_amount ?? null,
          payment_notes: booking.payment_notes ?? null,
        });
      }
      setBookings((items) => items.map((item) => (item.id === updated.id ? updated : item)));
    } catch (err: any) {
      alert(err.message ?? 'Gagal memperbarui pembayaran');
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/admin" className="text-sm text-gray-500 hover:text-[#1a3a2e]">
          Kembali ke Dashboard
        </Link>
        <div className="mt-2 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#1a3a2e]">Pembayaran & Verifikasi</h1>
            <p className="text-gray-500 mt-1">Pantau pembayaran booking, bukti transfer, dan status verifikasi.</p>
          </div>
          <button onClick={load} className="rounded-lg border px-4 py-2 text-sm font-medium hover:border-[#1a3a2e]">
            Muat ulang
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <div className="bg-white rounded-lg shadow p-5">
          <p className="text-sm text-gray-500">Estimasi tagihan</p>
          <p className="text-xl font-bold text-[#1a3a2e] mt-1">{formatCurrency(totals.expected)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-5">
          <p className="text-sm text-gray-500">Terverifikasi lunas</p>
          <p className="text-xl font-bold text-green-700 mt-1">{formatCurrency(totals.paid)}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-5">
          <p className="text-sm text-gray-500">Menunggu verifikasi</p>
          <p className="text-xl font-bold text-amber-700 mt-1">{totals.countByStatus.waiting_verification ?? 0}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-5">
          <p className="text-sm text-gray-500">Belum bayar</p>
          <p className="text-xl font-bold text-gray-700 mt-1">{totals.countByStatus.unpaid ?? 0}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        {filters.map((item) => (
          <button
            key={item || 'all'}
            onClick={() => setFilter(item)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              filter === item ? 'bg-[#1a3a2e] text-white' : 'bg-white border text-gray-600 hover:border-[#1a3a2e]'
            }`}
          >
            {item ? paymentLabels[item]?.label ?? item : 'Semua'}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b text-gray-600">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Booking</th>
                <th className="text-left px-4 py-3 font-semibold">Kunjungan</th>
                <th className="text-left px-4 py-3 font-semibold">Tagihan</th>
                <th className="text-left px-4 py-3 font-semibold">Dibayar</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="text-left px-4 py-3 font-semibold">Bukti</th>
                <th className="text-left px-4 py-3 font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={index}>
                    <td colSpan={7} className="px-4 py-4">
                      <div className="h-4 rounded bg-gray-100 animate-pulse" />
                    </td>
                  </tr>
                ))
              ) : error ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-red-600">{error}</td></tr>
              ) : visibleBookings.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-400">Tidak ada pembayaran pada filter ini</td></tr>
              ) : (
                visibleBookings.map((booking) => {
                  const status = booking.payment_status ?? 'unpaid';
                  return (
                    <tr key={booking.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-800">#{booking.id} {booking.group_name}</div>
                        <div className="text-xs text-gray-500">{booking.contact_email ?? '-'}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{formatDate(booking.visit_date)}</td>
                      <td className="px-4 py-3 font-semibold">{formatCurrency(booking.total_price)}</td>
                      <td className="px-4 py-3">{formatCurrency(booking.paid_amount)}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${paymentLabels[status]?.className ?? 'bg-gray-100'}`}>
                          {paymentLabels[status]?.label ?? status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {booking.payment_proof_url || booking.admin_payment_proof_url ? (
                          <button
                            type="button"
                            onClick={() => api.bookings.openPaymentProof(
                              booking.id,
                              booking.payment_proof_url ? 'customer' : 'admin',
                            ).catch((err) => setError(err.message))}
                            className="text-[#1a3a2e] underline"
                          >
                            Lihat bukti
                          </button>
                        ) : (
                          <span className="text-gray-400">Belum ada</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Link href={`/admin/booking/${booking.id}`} className="rounded border px-2 py-1 text-xs hover:border-[#1a3a2e]">
                            Detail
                          </Link>
                          {status === 'waiting_verification' && (
                            <>
                              <button
                                disabled={updating === booking.id}
                                onClick={() => updatePayment(booking, 'paid')}
                                className="rounded bg-green-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                              >
                                Terima
                              </button>
                              <button
                                disabled={updating === booking.id}
                                onClick={() => updatePayment(booking, 'rejected')}
                                className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
                              >
                                Tolak
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
