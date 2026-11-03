'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, OperationalReport } from '@/lib/api';

export default function ReportsPage() {
  const [preset, setPreset] = useState('7d');
  const [status, setStatus] = useState('');
  const [bookingType, setBookingType] = useState('');
  const [report, setReport] = useState<OperationalReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const params = () => {
    const value: Record<string, string> = { preset };
    if (status) value.status = status;
    if (bookingType) value.booking_type = bookingType;
    return value;
  };

  const load = async () => {
    setLoading(true);
    try {
      setReport(await api.operations.report(params()));
      setError('');
    } catch (err: any) {
      setError(err.message ?? 'Gagal memuat laporan');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const exportCsv = async () => {
    try {
      await api.operations.exportReportCsv(params());
    } catch (err: any) {
      setError(err.message ?? 'Gagal export CSV');
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <Link href="/admin" className="text-sm text-gray-500 hover:text-[#1a3a2e]">Kembali ke Dashboard</Link>
          <h1 className="mt-2 text-2xl font-bold text-[#1a3a2e]">Laporan Operasional</h1>
          <p className="mt-1 text-gray-500">Data booking, trip, Sakoci, driver/guide, layanan populer, dan incident dari backend.</p>
        </div>
        <button onClick={exportCsv} className="rounded-lg border border-[#1a3a2e] px-4 py-2 text-sm font-semibold text-[#1a3a2e]">Export CSV</button>
      </div>

      <div className="mb-5 grid gap-3 rounded-lg bg-white p-4 shadow md:grid-cols-4">
        <select value={preset} onChange={(event) => setPreset(event.target.value)} className="rounded-lg border px-3 py-2 text-sm">
          <option value="7d">7 hari</option>
          <option value="30d">30 hari</option>
          <option value="month">Bulan berjalan</option>
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-lg border px-3 py-2 text-sm">
          <option value="">Semua status</option>
          {['pending', 'confirmed', 'assigned', 'in_progress', 'completed', 'cancelled'].map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={bookingType} onChange={(event) => setBookingType(event.target.value)} className="rounded-lg border px-3 py-2 text-sm">
          <option value="">Semua layanan</option>
          {['package', 'private', 'rental'].map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <button onClick={load} className="rounded-lg bg-[#1a3a2e] px-4 py-2 text-sm font-semibold text-white">Terapkan</button>
      </div>

      {error && <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <Metric label="Total booking" value={report?.summary.bookingTotal ?? 0} loading={loading} />
        <Metric label="Selesai" value={report?.summary.completed ?? 0} loading={loading} />
        <Metric label="Batal" value={report?.summary.cancelled ?? 0} loading={loading} />
        <Metric label="Incident" value={report?.summary.incidentTotal ?? 0} loading={loading} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <List title="Status Booking" rows={objectRows(report?.summary.bookingStatus)} />
        <List title="Status Pembayaran" rows={objectRows(report?.summary.paymentStatus)} />
        <List title="Layanan Populer" rows={(report?.popularServices ?? []).map((row) => ({ label: row.name, value: row.count }))} />
        <List title="Incident" rows={objectRows(report?.incidentsByType)} />
        <List title="Performa Driver" rows={(report?.driverPerformance ?? []).map((row) => ({ label: row.name, value: row.completed }))} />
        <List title="Performa Guide" rows={(report?.guidePerformance ?? []).map((row) => ({ label: row.name, value: row.completed }))} />
      </div>
    </div>
  );
}

function Metric({ label, value, loading }: { label: string; value: number; loading: boolean }) {
  return (
    <div className="rounded-lg bg-white p-5 shadow">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-[#1a3a2e]">{loading ? '-' : value}</p>
    </div>
  );
}

function List({ title, rows }: { title: string; rows: Array<{ label: string; value: number }> }) {
  return (
    <section className="rounded-lg bg-white p-5 shadow">
      <h2 className="font-semibold text-gray-800">{title}</h2>
      <div className="mt-4 space-y-3">
        {rows.length ? rows.map((row) => (
          <div key={row.label} className="flex justify-between text-sm">
            <span className="text-gray-600">{row.label}</span>
            <strong>{row.value}</strong>
          </div>
        )) : <p className="text-sm text-gray-400">Belum ada data.</p>}
      </div>
    </section>
  );
}

function objectRows(record?: Record<string, number>) {
  return Object.entries(record ?? {}).map(([label, value]) => ({ label, value }));
}
