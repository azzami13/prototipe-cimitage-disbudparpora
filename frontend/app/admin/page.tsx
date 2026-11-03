'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api, AdminDashboardSummary, OperationalAlert } from '@/lib/api';

const periodOptions = [
  { value: '7d', label: '7 Hari' },
  { value: '30d', label: '30 Hari' },
  { value: 'month', label: 'Bulan Ini' },
] as const;

export default function AdminDashboardPage() {
  const [period, setPeriod] = useState<'7d' | '30d' | 'month'>('7d');
  const [summary, setSummary] = useState<AdminDashboardSummary | null>(null);
  const [alerts, setAlerts] = useState<OperationalAlert[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([api.adminDashboard.summary(period), api.operations.notifications(8)])
      .then(([data, alertData]) => {
        if (alive) {
          setSummary(data);
          setAlerts(alertData.data);
          setError('');
        }
      })
      .catch((err) => alive && setError(err.message ?? 'Gagal memuat dashboard'))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [period]);

  const cards = useMemo(() => {
    const data = summary?.cards;
    return [
      { label: 'Booking Hari Ini', value: data?.bookingsToday ?? 0, href: '/admin/booking' },
      { label: 'Bukti Menunggu Verifikasi', value: data?.pendingPayments ?? 0, href: '/admin/payments' },
      { label: 'Lunas Belum Ditugaskan', value: data?.readyAssignment ?? 0, href: '/admin/booking?status=confirmed' },
      { label: 'Trip Aktif', value: data?.activeTrips ?? 0, href: '/admin/monitoring' },
      { label: 'Trip Selesai Hari Ini', value: data?.completedToday ?? 0, href: '/admin/reports' },
      { label: 'Incident Aktif', value: data?.openIncidents ?? 0, href: '/admin/monitoring' },
    ];
  }, [summary]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1a3a2e] sm:text-3xl">Dashboard Admin</h1>
          <p className="mt-2 text-sm text-gray-500">Ringkasan operasional berdasarkan data backend.</p>
        </div>
        <div className="flex rounded-lg border border-gray-200 bg-white p-1">
          {periodOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setPeriod(option.value)}
              className={`rounded-md px-3 py-2 text-sm font-semibold ${period === option.value ? 'bg-[#1a3a2e] text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {error ? <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <Link key={card.label} href={card.href} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:border-[#1a3a2e]/40">
            <p className="text-sm font-medium text-gray-500">{card.label}</p>
            <p className="mt-2 text-3xl font-bold text-[#1a3a2e]">{loading ? '-' : card.value}</p>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <AlertQueue title="Alert Operasional" items={alerts} />
        <Queue title="Pembayaran Perlu Verifikasi" items={summary?.queues.pendingPayments ?? []} empty="Tidak ada pembayaran pending." />
        <Queue title="Siap Assignment" items={summary?.queues.readyAssignment ?? []} empty="Tidak ada booking siap assignment." />
        <Queue title="Keberangkatan Terdekat" items={summary?.queues.upcomingDepartures ?? []} empty="Tidak ada keberangkatan dekat." />
        <Queue title="Incident Aktif" items={summary?.queues.activeIncidents ?? []} empty="Tidak ada incident aktif." />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <ChartList title="Tren Booking" rows={summary?.charts.bookingTrend.map((row) => ({ label: row.date, value: row.count })) ?? []} />
        <ChartList title="Distribusi Status" rows={summary?.charts.statusDistribution.map((row) => ({ label: row.status, value: row.count })) ?? []} />
        <ChartList title="Paket Populer" rows={summary?.charts.popularPackages.map((row) => ({ label: row.name, value: row.count })) ?? []} />
      </div>
    </div>
  );
}

function AlertQueue({ title, items }: { title: string; items: OperationalAlert[] }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-[#1a3a2e]">{title}</h2>
      <div className="mt-3 divide-y divide-gray-100">
        {items.length ? items.map((item) => (
          <Link key={item.id} href={item.href} className="block py-3 text-sm hover:text-[#1a3a2e]">
            <span className="font-semibold">{item.summary}</span>
            <span className="ml-2 text-gray-500">{item.priority}</span>
          </Link>
        )) : <p className="py-3 text-sm text-gray-500">Tidak ada alert aktif.</p>}
      </div>
    </section>
  );
}

function Queue({ title, items, empty }: { title: string; items: AdminDashboardSummary['queues']['pendingPayments']; empty: string }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-[#1a3a2e]">{title}</h2>
      <div className="mt-3 divide-y divide-gray-100">
        {items.length ? items.map((item) => (
          <Link key={`${title}-${item.id}`} href={item.href} className="block py-3 text-sm hover:text-[#1a3a2e]">
            <span className="font-semibold">{item.code ?? item.issue_type ?? `#${item.id}`}</span>
            <span className="ml-2 text-gray-500">{item.group_name ?? item.status ?? ''}</span>
          </Link>
        )) : <p className="py-3 text-sm text-gray-500">{empty}</p>}
      </div>
    </section>
  );
}

function ChartList({ title, rows }: { title: string; rows: Array<{ label: string; value: number }> }) {
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-[#1a3a2e]">{title}</h2>
      <div className="mt-3 space-y-3">
        {rows.length ? rows.map((row) => (
          <div key={row.label}>
            <div className="mb-1 flex justify-between text-xs text-gray-500">
              <span>{row.label}</span>
              <span>{row.value}</span>
            </div>
            <div className="h-2 rounded bg-gray-100">
              <div className="h-2 rounded bg-[#1a3a2e]" style={{ width: `${Math.max(6, (row.value / max) * 100)}%` }} />
            </div>
          </div>
        )) : <p className="text-sm text-gray-500">Belum ada data.</p>}
      </div>
    </section>
  );
}
