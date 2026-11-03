'use client';
import { useEffect, useState } from 'react';
import { api, Booking } from '@/lib/api';

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800' },
  confirmed: { label: 'Confirmed', color: 'bg-green-100 text-green-800' },
  completed: { label: 'Completed', color: 'bg-blue-100 text-blue-800' },
  cancelled: { label: 'Dibatalkan', color: 'bg-red-100 text-red-800' },
};

export default function AdminBookingPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('');
  const [updating, setUpdating] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    const params: Record<string, string> = { limit: '30' };
    if (filterStatus) params.status = filterStatus;
    api.bookings.list(params).then(({ data, total }) => {
      setBookings(data); setTotal(total);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filterStatus]);

  const updateStatus = async (id: number, status: string) => {
    setUpdating(id);
    try {
      const updated = await api.bookings.updateStatus(id, status);
      setBookings(bs => bs.map(b => b.id === id ? updated : b));
    } catch (err: any) { alert(err.message ?? 'Gagal update status'); }
    finally { setUpdating(null); }
  };

  const fmt = (n: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <a href="/admin" className="text-sm text-gray-500 hover:text-[#1a3a2e] mb-1 block">← Admin Dashboard</a>
          <h1 className="text-2xl font-bold text-[#1a3a2e]">📋 Manajemen Booking</h1>
        </div>
        <span className="text-sm text-gray-500">{total} total pesanan</span>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {['', 'pending', 'confirmed', 'completed', 'cancelled'].map(s => (
          <button key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${filterStatus === s ? 'bg-[#1a3a2e] text-white' : 'bg-white border text-gray-600 hover:border-[#1a3a2e]'}`}>
            {s === '' ? 'Semua' : STATUS_LABEL[s]?.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow overflow-x-auto">
        <table className="w-full min-w-[940px] text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">ID</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Rombongan</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Paket</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Tgl Kunjungan</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Peserta</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Total</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-600">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              Array(5).fill(0).map((_, i) => (
                <tr key={i}><td colSpan={8} className="px-4 py-4"><div className="h-4 bg-gray-100 animate-pulse rounded" /></td></tr>
              ))
            ) : bookings.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">Tidak ada data booking</td></tr>
            ) : (
              bookings.map(b => (
                <tr key={b.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3 text-gray-400 font-mono">#{b.id}</td>
                  <td className="px-4 py-3 font-medium">{b.group_name}</td>
                  <td className="px-4 py-3 text-gray-600">{b.tour_package?.name ?? '-'}</td>
                  <td className="px-4 py-3">{new Date(b.visit_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  <td className="px-4 py-3">{b.participants} orang</td>
                  <td className="px-4 py-3 font-semibold text-[#1a3a2e]">{fmt(Number(b.total_price))}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_LABEL[b.status]?.color ?? 'bg-gray-100'}`}>
                      {STATUS_LABEL[b.status]?.label ?? b.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 flex-wrap">
                      <a href={`/admin/booking/${b.id}`}
                        className="text-xs border border-[#1a3a2e] text-[#1a3a2e] px-2 py-1 rounded hover:bg-green-50">
                        Detail
                      </a>
                      {b.status === 'pending' && (
                        <>
                          <button onClick={() => updateStatus(b.id, 'confirmed')}
                            disabled={updating === b.id}
                            className="text-xs bg-green-500 text-white px-2 py-1 rounded hover:bg-green-600 disabled:opacity-40">
                            ✓ Konfirmasi
                          </button>
                          <button onClick={() => updateStatus(b.id, 'cancelled')}
                            disabled={updating === b.id}
                            className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 disabled:opacity-40">
                            ✕
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
