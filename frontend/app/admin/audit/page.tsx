'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, AuditLogItem } from '@/lib/api';

function formatDate(value?: string) {
  if (!value) return '-';
  return new Date(value).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function AuditPage() {
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [bookingCode, setBookingCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: '30' };
      if (action) params.action = action;
      if (entityType) params.entity_type = entityType;
      if (bookingCode) params.booking_code = bookingCode;
      const result = await api.operations.audit(params);
      setItems(result.data);
      setTotal(result.total);
      setError('');
    } catch (err: any) {
      setError(err.message ?? 'Gagal memuat audit log');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [page]);

  const applyFilter = () => {
    setPage(1);
    load();
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6">
        <Link href="/admin" className="text-sm text-gray-500 hover:text-[#1a3a2e]">Kembali ke Dashboard</Link>
        <h1 className="mt-2 text-2xl font-bold text-[#1a3a2e]">Audit Log</h1>
        <p className="mt-1 text-gray-500">Jejak aktivitas backend dengan metadata yang sudah disaring dari data sensitif.</p>
      </div>

      <div className="mb-5 grid gap-3 rounded-lg bg-white p-4 shadow md:grid-cols-4">
        <input value={action} onChange={(event) => setAction(event.target.value)} placeholder="Action" className="rounded-lg border px-3 py-2 text-sm" />
        <input value={entityType} onChange={(event) => setEntityType(event.target.value)} placeholder="Entity type" className="rounded-lg border px-3 py-2 text-sm" />
        <input value={bookingCode} onChange={(event) => setBookingCode(event.target.value)} placeholder="Booking code" className="rounded-lg border px-3 py-2 text-sm" />
        <button onClick={applyFilter} className="rounded-lg bg-[#1a3a2e] px-4 py-2 text-sm font-semibold text-white">Terapkan Filter</button>
      </div>

      {error && <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <section className="overflow-hidden rounded-lg bg-white shadow">
        <div className="border-b px-5 py-4">
          <h2 className="font-semibold text-gray-800">Total aktivitas: {total}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-5 py-3 text-left font-semibold">Waktu</th>
                <th className="px-5 py-3 text-left font-semibold">Aktor</th>
                <th className="px-5 py-3 text-left font-semibold">Action</th>
                <th className="px-5 py-3 text-left font-semibold">Entity</th>
                <th className="px-5 py-3 text-left font-semibold">Booking</th>
                <th className="px-5 py-3 text-left font-semibold">Metadata</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400">Memuat audit log...</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-gray-400">Belum ada audit log pada filter ini.</td></tr>
              ) : items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3 text-gray-500">{formatDate(item.created_at)}</td>
                  <td className="px-5 py-3">{item.actor_role ?? '-'} #{item.actor_user_id ?? '-'}</td>
                  <td className="px-5 py-3 font-medium text-gray-800">{item.action}</td>
                  <td className="px-5 py-3">{item.entity_type} {item.entity_id ? `#${item.entity_id}` : ''}</td>
                  <td className="px-5 py-3">{item.booking_code ?? '-'}</td>
                  <td className="max-w-xs truncate px-5 py-3 text-gray-600">{item.metadata ? JSON.stringify(item.metadata) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-4 flex justify-end gap-2">
        <button onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">Sebelumnya</button>
        <span className="rounded-lg border px-3 py-2 text-sm">Halaman {page}</span>
        <button onClick={() => setPage((value) => value + 1)} disabled={items.length < 30} className="rounded-lg border px-3 py-2 text-sm disabled:opacity-50">Berikutnya</button>
      </div>
    </div>
  );
}
