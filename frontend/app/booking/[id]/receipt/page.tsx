'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, BookingReceipt } from '@/lib/api';

export default function ReceiptPage({ params }: { params: { id: string } }) {
  const bookingId = Number(params.id);
  const [receipt, setReceipt] = useState<BookingReceipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!Number.isInteger(bookingId) || bookingId < 1) {
      setError('Nomor booking tidak valid');
      setLoading(false);
      return;
    }
    api.operations.receipt(bookingId)
      .then(setReceipt)
      .catch((err) => setError(err.message ?? 'Gagal memuat receipt'))
      .finally(() => setLoading(false));
  }, [bookingId]);

  if (loading) return <div className="mx-auto max-w-4xl px-4 py-12 text-gray-500">Memuat receipt...</div>;
  if (error || !receipt) return <div className="mx-auto max-w-2xl px-4 py-16 text-center text-red-700">{error || 'Receipt tidak tersedia.'}</div>;

  const paid = receipt.booking.paymentStatus === 'paid';

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-5 flex items-center justify-between print:hidden">
        <Link href={`/booking/${receipt.booking.id}`} className="text-sm text-gray-500 hover:text-[#1a3a2e]">Kembali ke booking</Link>
        <button onClick={() => window.print()} className="rounded-lg bg-[#1a3a2e] px-5 py-2 text-sm font-semibold text-white">Cetak Receipt</button>
      </div>

      <section className="receipt-area rounded-xl bg-white p-8 shadow print:shadow-none">
        <header className="flex flex-col gap-4 border-b pb-5 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-500">{receipt.issuer.appName}</p>
            <h1 className="mt-1 text-2xl font-bold text-[#1a3a2e]">{receipt.issuer.agencyName}</h1>
            <p className="mt-2 text-sm text-gray-500">{receipt.issuer.support} • {receipt.issuer.hotline}</p>
            <p className="text-sm text-gray-500">{receipt.issuer.hours}</p>
          </div>
          <div className="text-left md:text-right">
            <p className="text-sm text-gray-500">Receipt</p>
            <h2 className="text-xl font-bold text-gray-900">{receipt.booking.code}</h2>
            <span className={`mt-2 inline-block rounded-full px-3 py-1 text-sm font-semibold ${paid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
              {paid ? 'Pembayaran Terverifikasi' : paymentLabel(receipt.booking.paymentStatus)}
            </span>
          </div>
        </header>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <Block title="Pemesan">
            <Row label="Nama" value={receipt.booking.customer} />
            <Row label="Peserta" value={`${receipt.booking.participants} orang`} />
            <Row label="Dibuat" value={formatDate(receipt.booking.createdAt)} />
          </Block>
          <Block title="Layanan">
            <Row label="Jenis" value={receipt.booking.bookingType} />
            <Row label="Layanan" value={receipt.booking.serviceName} />
            <Row label="Jadwal" value={`${formatDate(receipt.booking.visitDate)} ${receipt.booking.pickupTime ?? ''}`} />
            <Row label="Titik jemput" value={receipt.booking.pickupLocation ?? '-'} />
          </Block>
        </div>

        <Block title="Pembayaran" className="mt-5">
          <Row label="Status booking" value={receipt.booking.status} />
          <Row label="Status pembayaran" value={paymentLabel(receipt.booking.paymentStatus)} />
          <Row label="Nominal" value={currency(receipt.booking.amount)} strong />
          <Row label="Terbayar" value={paid ? currency(receipt.booking.paidAmount ?? receipt.booking.amount) : 'Belum lunas/terverifikasi'} strong={paid} />
        </Block>

        {receipt.assignment && (
          <Block title="Assignment" className="mt-5">
            <Row label="Sakoci" value={receipt.assignment.sakoci ? `${receipt.assignment.sakoci.code ?? receipt.assignment.sakoci.name} • ${receipt.assignment.sakoci.plateNumber ?? '-'}` : '-'} />
            <Row label="Driver" value={receipt.assignment.driver?.name ?? '-'} />
            <Row label="Guide" value={receipt.assignment.guide?.name ?? '-'} />
          </Block>
        )}

        <Block title="Ringkasan Rute" className="mt-5">
          {receipt.route ? (
            <>
              <Row label="Total jarak" value={`${Number(receipt.route.totalDistanceKm).toFixed(2)} km`} />
              <Row label="Estimasi durasi" value={receipt.route.totalDurationMinutes ? `${Math.round(Number(receipt.route.totalDurationMinutes))} menit` : '-'} />
            </>
          ) : (
            <p className="text-sm text-gray-600">Urutan perjalanan dan rute optimal akan ditentukan setelah pesanan diverifikasi.</p>
          )}
        </Block>

        <p className="mt-8 border-t pt-4 text-xs text-gray-500">Receipt ini diterbitkan dari data backend Cimitage. Status lunas hanya ditampilkan bila pembayaran sudah diverifikasi admin.</p>
      </section>
    </main>
  );
}

function Block({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return <section className={`rounded-lg border p-4 ${className}`}><h3 className="mb-3 font-bold text-[#1a3a2e]">{title}</h3>{children}</section>;
}

function Row({ label, value, strong = false }: { label: string; value: React.ReactNode; strong?: boolean }) {
  return <div className="flex justify-between gap-4 py-1.5 text-sm"><span className="text-gray-500">{label}</span><span className={`text-right ${strong ? 'font-bold text-[#1a3a2e]' : 'font-medium text-gray-800'}`}>{value}</span></div>;
}

function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

function currency(value?: number | null) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value ?? 0));
}

function paymentLabel(status: string) {
  const labels: Record<string, string> = {
    unpaid: 'Belum dibayar',
    waiting_verification: 'Menunggu verifikasi',
    paid: 'Lunas',
    rejected: 'Ditolak',
    expired: 'Kedaluwarsa',
    refunded: 'Refunded',
  };
  return labels[status] ?? status;
}
