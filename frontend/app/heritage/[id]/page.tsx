'use client';
import { useEffect, useState } from 'react';
import { api, HeritageSite } from '@/lib/api';
import BackendAssetImage from '@/components/ui/BackendAssetImage';
import { backendAssetUrl } from '@/lib/runtime-config';

const CAT_LABEL: Record<string, string> = {
  BG: 'Bangunan Gedung', SI: 'Situs', BD: 'Benda Cagar Budaya', KA: 'Kawasan Adat',
};

export default function HeritageDetailPage({ params }: { params: { id: string } }) {
  const [site, setSite] = useState<HeritageSite | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.heritage.one(Number(params.id))
      .then(setSite)
      .catch(() => setSite(null))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-gray-400 text-lg">⏳ Memuat data...</div>
    </div>
  );

  if (!site) return (
    <div className="text-center py-24">
      <div className="text-5xl mb-4">🏛</div>
      <h2 className="text-xl font-bold text-gray-700">Situs tidak ditemukan</h2>
      <a href="/heritage" className="text-blue-600 hover:underline mt-2 block">← Kembali ke daftar</a>
    </div>
  );

  const visibleImages = (site.images ?? []).filter(item => item.is_visible !== false && item.url);
  const visibleVideos = (site.youtube_links ?? []).filter(item => item.is_visible !== false && item.url);
  const visiblePdfs = (site.pdf_files ?? []).filter(item => item.is_visible !== false && item.url);
  const googleMapsUrl = site.latitude && site.longitude
    ? `https://www.google.com/maps?q=${site.latitude},${site.longitude}`
    : '';

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <a href="/heritage" className="text-sm text-gray-500 hover:text-[#1a3a2e] flex items-center gap-1 mb-6">
        ← Kembali ke daftar situs
      </a>

      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-[#1a3a2e] to-[#2d6a4f] text-white p-8">
          <span className="text-xs px-3 py-1 bg-white/20 rounded-full mb-3 inline-block">
            {CAT_LABEL[site.category] ?? site.category}
          </span>
          <h1 className="text-2xl md:text-3xl font-bold mt-2">{site.name}</h1>
          <p className="text-green-200 mt-2 flex items-center gap-2">
            <span>📍</span> {site.address ?? '-'}
          </p>
        </div>

        {visibleImages.length > 0 && (
          <div className="grid md:grid-cols-3 gap-2 p-2 bg-gray-100">
            {visibleImages.map((image, index) => (
              <a key={`${image.url}-${index}`} href={backendAssetUrl(image.url, '')} target="_blank" rel="noreferrer"
                className={index === 0 ? 'md:col-span-2 md:row-span-2' : ''}>
                <BackendAssetImage
                  src={image.url}
                  alt={image.title || site.name}
                  className={`w-full object-cover bg-white ${index === 0 ? 'h-72 md:h-full' : 'h-40'}`}
                />
              </a>
            ))}
          </div>
        )}

        {/* Content */}
        <div className="p-6 grid md:grid-cols-2 gap-6">
          {/* Info grid */}
          <div className="space-y-4">
            <InfoRow label="Kategori" value={CAT_LABEL[site.category] ?? site.category} />
            <InfoRow label="Kelurahan" value={site.kelurahan} />
            <InfoRow label="Kecamatan" value={site.kecamatan} />
            <InfoRow label="Status" value={site.status} />
            {site.no_register && <InfoRow label="No. Register" value={site.no_register} />}
            {site.latitude && (
              <InfoRow
                label="Koordinat"
                value={`${Number(site.latitude).toFixed(6)}, ${Number(site.longitude).toFixed(6)}`}
              />
            )}
          </div>

          {/* Mini map */}
          {site.latitude && site.longitude && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Lokasi di Peta</p>
              <iframe
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${Number(site.longitude) - 0.005},${Number(site.latitude) - 0.004},${Number(site.longitude) + 0.005},${Number(site.latitude) + 0.004}&layer=mapnik&marker=${site.latitude},${site.longitude}`}
                className="w-full h-48 rounded-lg border"
              />
              <a
                href={`https://www.openstreetmap.org/?mlat=${site.latitude}&mlon=${site.longitude}#map=16/${site.latitude}/${site.longitude}`}
                target="_blank" rel="noreferrer"
                className="text-xs text-blue-600 hover:underline mt-1 block"
              >
                Buka di OpenStreetMap ↗
              </a>
              <a
                href={googleMapsUrl}
                target="_blank" rel="noreferrer"
                className="text-xs text-blue-600 hover:underline mt-1 block"
              >
                Buka di Google Maps ↗
              </a>
            </div>
          )}
        </div>

        {/* SK Penetapan */}
        {site.sk_penetapan && site.sk_penetapan !== '-' && (
          <div className="mx-6 mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-xs font-semibold text-amber-800 uppercase mb-1">SK Penetapan</p>
            <p className="text-sm text-gray-700 whitespace-pre-line">{site.sk_penetapan}</p>
          </div>
        )}

        {/* Description */}
        {site.description && (
          <div className="mx-6 mb-6">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Deskripsi</p>
            <p className="text-gray-700 leading-relaxed">{site.description}</p>
          </div>
        )}

        {visibleVideos.length > 0 && (
          <div className="mx-6 mb-6">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Video</p>
            <div className="grid md:grid-cols-2 gap-4">
              {visibleVideos.map((video, index) => {
                const id = getYoutubeId(video.url);
                return (
                  <div key={`${video.url}-${index}`} className="border rounded-lg overflow-hidden bg-gray-50">
                    {id ? (
                      <iframe
                        src={`https://www.youtube.com/embed/${id}`}
                        title={video.title || `Video ${index + 1}`}
                        className="w-full aspect-video"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                      <a href={video.url} target="_blank" rel="noreferrer"
                        className="block px-4 py-8 text-sm text-blue-600 hover:underline">
                        Buka video YouTube ↗
                      </a>
                    )}
                    {video.title && <p className="px-3 py-2 text-sm font-medium text-gray-700">{video.title}</p>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {visiblePdfs.length > 0 && (
          <div className="mx-6 mb-6">
            <p className="text-xs font-semibold text-gray-500 uppercase mb-3">Dokumen PDF</p>
            <div className="grid md:grid-cols-2 gap-3">
              {visiblePdfs.map((pdf, index) => (
                <a key={`${pdf.url}-${index}`} href={pdf.url} target="_blank" rel="noreferrer"
                  className="border rounded-lg px-4 py-3 flex items-center justify-between gap-3 hover:bg-gray-50">
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-gray-800 truncate">
                      {pdf.title || `Dokumen ${index + 1}`}
                    </span>
                    <span className="text-xs text-gray-400">PDF</span>
                  </span>
                  <span className="text-sm text-blue-600">Buka ↗</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="px-6 pb-6 flex flex-wrap gap-3">
          <a href={`/peta?highlight=${site.id}`}
            className="bg-[#1a3a2e] text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-[#2d6a4f] transition">
            🗺 Lihat di Peta
          </a>
          {googleMapsUrl && (
            <a href={googleMapsUrl} target="_blank" rel="noreferrer"
              className="bg-blue-600 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 transition">
              Buka Google Maps
            </a>
          )}
          <a href="/booking"
            className="bg-amber-500 text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-amber-600 transition">
            📋 Pesan Kunjungan
          </a>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase">{label}</p>
      <p className="text-gray-800 mt-0.5">{value}</p>
    </div>
  );
}

function getYoutubeId(url?: string) {
  if (!url) return '';
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match?.[1] ?? '';
}
