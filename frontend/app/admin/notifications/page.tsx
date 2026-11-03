'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, OperationalAlert } from '@/lib/api';

const priorityClass: Record<string, string> = {
  high: 'border-red-200 bg-red-50 text-red-800',
  medium: 'border-amber-200 bg-amber-50 text-amber-800',
  low: 'border-blue-200 bg-blue-50 text-blue-800',
};

function relativeDate(value?: string) {
  if (!value) return '';
  return new Date(value).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function NotificationsPage() {
  const [items, setItems] = useState<OperationalAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const result = await api.operations.notifications(60);
      setItems(result.data);
      setError('');
    } catch (err: any) {
      setError(err.message ?? 'Gagal memuat notifikasi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <Link href="/admin" className="text-sm text-gray-500 hover:text-[#1a3a2e]">Kembali ke Dashboard</Link>
          <h1 className="mt-2 text-2xl font-bold text-[#1a3a2e]">Notifikasi Operasional</h1>
          <p className="mt-1 text-gray-500">Alert aktif dari kondisi booking, payment, trip, GPS, incident, dan route snapshot.</p>
        </div>
        <button onClick={load} className="rounded-lg border px-4 py-2 text-sm font-medium hover:border-[#1a3a2e]">Muat ulang</button>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card label="Total Alert" value={items.length} />
        <Card label="Prioritas Tinggi" value={items.filter((item) => item.priority === 'high').length} />
        <Card label="Route/GPS" value={items.filter((item) => ['route_snapshot_stale', 'gps_stale'].includes(item.type)).length} />
      </div>

      {error && <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <section className="overflow-hidden rounded-lg bg-white shadow">
        <div className="border-b px-5 py-4">
          <h2 className="font-semibold text-gray-800">Inbox Admin</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {loading ? (
            <div className="p-8 text-center text-gray-400">Memuat notifikasi...</div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-gray-400">Tidak ada alert aktif.</div>
          ) : items.map((item) => (
            <Link key={item.id} href={item.href} className="flex flex-col gap-2 px-5 py-4 hover:bg-gray-50 md:flex-row md:items-center md:justify-between">
              <div>
                <div className={`mb-2 inline-flex rounded-full border px-2 py-1 text-xs font-semibold ${priorityClass[item.priority] ?? priorityClass.low}`}>
                  {alertTypeLabel(item.type)}
                </div>
                <h3 className="font-semibold text-gray-800">{item.summary}</h3>
                <p className="text-xs text-gray-500">{item.type}</p>
              </div>
              <span className="text-xs text-gray-400">{relativeDate(item.timestamp)}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function Card({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-white p-5 shadow">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-[#1a3a2e]">{value}</p>
    </div>
  );
}

function alertTypeLabel(type: string) {
  const labels: Record<string, string> = {
    payment_waiting_verification: 'Pembayaran',
    paid_route_not_final: 'Route',
    assignment_incomplete: 'Assignment',
    driver_not_started: 'Driver',
    gps_stale: 'GPS',
    incident_open: 'Incident',
    route_snapshot_stale: 'Route Stale',
  };
  return labels[type] ?? 'Alert';
}
