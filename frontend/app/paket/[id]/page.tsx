'use client';
import { useEffect, useState } from 'react';
import { api, TourPackage } from '@/lib/api';

export default function PaketDetailPage({ params }: { params: { id: string } }) {
  const [pkg, setPkg] = useState<TourPackage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.packages.one(Number(params.id)).then(setPkg).finally(() => setLoading(false));
  }, [params.id]);

  const fmt = (n: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-400 text-lg animate-pulse">⏳ Memuat paket...</div>
    </div>
  );

  if (!pkg) return (
    <div className="text-center py-24">
      <div className="text-5xl mb-4">📦</div>
      <h2 className="text-xl font-bold text-gray-700">Paket tidak ditemukan</h2>
      <a href="/paket" className="text-blue-600 hover:underline mt-2 block">← Kembali</a>
    </div>
  );

  const sortedRoutes = [...(pkg.routes ?? [])].sort((a, b) => a.sequence - b.sequence);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <a href="/paket" className="text-sm text-gray-500 hover:text-[#1a3a2e] flex items-center gap-1 mb-6">
        ← Semua Paket Wisata
      </a>

      {/* Hero */}
      <div className="bg-gradient-to-br from-[#1a3a2e] to-[#2d6a4f] text-white rounded-2xl p-8 mb-6">
        <span className="text-xs bg-amber-400 text-amber-900 px-3 py-1 rounded-full font-bold inline-block mb-3">
          {pkg.code}
        </span>
        <h1 className="text-3xl font-bold mb-2">{pkg.name}</h1>
        <p className="text-green-200 text-base leading-relaxed">{pkg.description}</p>
        <div className="flex gap-6 mt-5 flex-wrap">
          <div className="text-center">
            <p className="text-2xl font-bold">{sortedRoutes.length}</p>
            <p className="text-green-300 text-sm">Destinasi</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{pkg.duration_hours ?? '?'}j</p>
            <p className="text-green-300 text-sm">Durasi</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{fmt(pkg.price_per_person)}</p>
            <p className="text-green-300 text-sm">Per Orang</p>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Route timeline */}
        <div className="md:col-span-2">
          <h2 className="text-xl font-bold text-[#1a3a2e] mb-4">🗺 Rute Kunjungan</h2>
          <p className="text-sm text-gray-500 mb-4">
            Urutan telah dioptimalkan menggunakan algoritma Dijkstra untuk meminimalkan jarak tempuh.
          </p>

          <div className="space-y-3">
            {sortedRoutes.map((route, idx) => (
              <div key={route.id} className="flex gap-3">
                {/* Timeline */}
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 bg-[#1a3a2e] text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                    {route.sequence}
                  </div>
                  {idx < sortedRoutes.length - 1 && (
                    <div className="w-0.5 h-full bg-gray-200 my-1 min-h-4" />
                  )}
                </div>

                {/* Card */}
                <div className="flex-1 bg-white border rounded-xl p-4 mb-2 hover:shadow-md transition">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h3 className="font-bold text-[#1a3a2e]">{route.heritage_site?.name}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {route.heritage_site?.category} · {route.heritage_site?.kecamatan}
                      </p>
                      {route.heritage_site?.address && (
                        <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                          <span>📍</span> {route.heritage_site.address}
                        </p>
                      )}
                      {route.notes && (
                        <p className="text-xs bg-amber-50 text-amber-700 px-2 py-1 rounded mt-2">
                          💡 {route.notes}
                        </p>
                      )}
                    </div>
                    <a href={`/heritage/${route.heritage_site?.id}`}
                      className="text-xs text-blue-600 hover:underline flex-shrink-0">
                      Detail →
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Booking sidebar */}
        <div>
          <div className="bg-white rounded-2xl shadow-lg p-5 sticky top-20">
            <h3 className="font-bold text-[#1a3a2e] text-lg mb-4">Pesan Sekarang</h3>

            <div className="space-y-3 mb-5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Harga per orang</span>
                <span className="font-bold">{fmt(pkg.price_per_person)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Jumlah destinasi</span>
                <span>{sortedRoutes.length} situs</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Durasi perkiraan</span>
                <span>{pkg.duration_hours ?? '?'} jam</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Metode rute</span>
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">Dijkstra Optimal</span>
              </div>
            </div>

            <a href={`/booking?package=${pkg.id}`}
              className="block w-full text-center bg-amber-500 text-white font-bold py-3 rounded-xl hover:bg-amber-600 transition mb-2">
              📋 Pesan Paket Ini
            </a>
            <a href={`/peta`}
              className="block w-full text-center border border-[#1a3a2e] text-[#1a3a2e] font-semibold py-2.5 rounded-xl hover:bg-[#1a3a2e] hover:text-white transition text-sm">
              🗺 Lihat di Peta
            </a>

            <p className="text-xs text-gray-400 text-center mt-3">
              Konfirmasi oleh admin dalam 1×24 jam
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
