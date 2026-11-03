'use client';
import { useEffect, useState } from 'react';
import { api, TourPackage } from '@/lib/api';

export default function PaketPage() {
  const [packages, setPackages] = useState<TourPackage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.packages
      .listActive()
      .then((res: any) => {
        if (Array.isArray(res)) {
          setPackages(res);
        } else if (Array.isArray(res?.data)) {
          setPackages(res.data);
        } else {
          setPackages([]);
        }
      })
      .catch((err) => {
        console.error('Failed to load packages:', err);
        setPackages([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const fmt = (n: number) =>
    new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(n);

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold text-[#1a3a2e] mb-3">
          📦 Paket Wisata Heritage
        </h1>
        <p className="text-gray-500 max-w-xl mx-auto">
          Jelajahi situs cagar budaya Kota Cimahi dengan paket wisata
          terstruktur. Rute sudah dioptimalkan menggunakan algoritma Dijkstra.
        </p>
      </div>

      {loading ? (
        <div className="grid md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-gray-100 rounded-2xl h-80 animate-pulse"
            />
          ))}
        </div>
      ) : packages.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-3">📦</div>
          <p>Belum ada paket wisata tersedia</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              className="bg-white rounded-2xl shadow-md overflow-hidden hover:shadow-xl transition group"
            >
              <div className="bg-gradient-to-br from-[#1a3a2e] to-[#2d6a4f] p-6 text-white">
                <span className="text-xs bg-amber-400 text-amber-900 px-2 py-0.5 rounded-full font-bold">
                  {pkg.code}
                </span>

                <h2 className="text-xl font-bold mt-3 group-hover:text-green-200 transition">
                  {pkg.name}
                </h2>

                <p className="text-green-200 text-sm mt-2 line-clamp-2">
                  {pkg.description}
                </p>
              </div>

              <div className="p-5">
                <div className="flex justify-between text-sm text-gray-600 mb-4">
                  <div className="flex items-center gap-1">
                    <span>📍</span>
                    <span>{pkg.routes?.length ?? 0} destinasi</span>
                  </div>

                  {pkg.duration_hours && (
                    <div className="flex items-center gap-1">
                      <span>⏱</span>
                      <span>{pkg.duration_hours} jam</span>
                    </div>
                  )}

                  <div className="font-bold text-[#1a3a2e]">
                    {fmt(pkg.price_per_person)}/orang
                  </div>
                </div>

                {pkg.routes?.length > 0 && (
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-gray-400 uppercase mb-2">
                      Rute Kunjungan
                    </p>

                    <div className="space-y-1">
                      {pkg.routes
                        .slice()
                        .sort((a, b) => a.sequence - b.sequence)
                        .slice(0, 4)
                        .map((r) => (
                          <div
                            key={r.id}
                            className="flex items-center gap-2 text-xs text-gray-700"
                          >
                            <span className="w-5 h-5 bg-[#1a3a2e] text-white rounded-full flex items-center justify-center font-bold flex-shrink-0">
                              {r.sequence}
                            </span>

                            <span className="truncate">
                              {r.heritage_site?.name}
                            </span>
                          </div>
                        ))}

                      {pkg.routes.length > 4 && (
                        <p className="text-xs text-gray-400 ml-7">
                          +{pkg.routes.length - 4} situs lainnya
                        </p>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <a
                    href={`/paket/${pkg.id}`}
                    className="flex-1 text-center border border-[#1a3a2e] text-[#1a3a2e] py-2 rounded-lg text-sm font-semibold hover:bg-[#1a3a2e] hover:text-white transition"
                  >
                    Detail
                  </a>

                  <a
                    href={`/booking?package=${pkg.id}`}
                    className="flex-1 text-center bg-amber-500 text-white py-2 rounded-lg text-sm font-semibold hover:bg-amber-600 transition"
                  >
                    Pesan Sekarang
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
