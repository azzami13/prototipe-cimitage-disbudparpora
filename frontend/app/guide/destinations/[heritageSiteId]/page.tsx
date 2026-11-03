'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, HeritageMediaItem, HeritageSite } from '@/lib/api';
import { GuideError, GuideLoading } from '@/components/guide/GuidePageState';
import BackendAssetImage from '@/components/ui/BackendAssetImage';
import { backendAssetUrl } from '@/lib/runtime-config';

const categoryLabels: Record<string, string> = {
  BG: 'Bangunan Gedung',
  SI: 'Situs',
  BD: 'Benda Cagar Budaya',
  KA: 'Kawasan Adat',
};

export default function GuideDestinationDetailPage() {
  const params = useParams();
  const heritageSiteId = Number(params.heritageSiteId);
  const [site, setSite] = useState<HeritageSite | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!Number.isInteger(heritageSiteId) || heritageSiteId < 1) {
      setError('Nomor destinasi tidak valid');
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setSite(await api.guide.destination(heritageSiteId));
      setError('');
    } catch (err: any) {
      setError(err.message ?? 'Gagal memuat data situs');
      setSite(null);
    } finally {
      setLoading(false);
    }
  }, [heritageSiteId]);

  useEffect(() => { load(); }, [load]);

  if (loading && !site) return <GuideLoading text="Memuat materi situs..." />;
  if (error && !site) return <GuideError message={error} retry={load} />;
  if (!site) return null;

  const images = visibleMedia(site.images);
  const videos = visibleMedia(site.youtube_links);
  const pdfs = visibleMedia(site.pdf_files);
  const heroImage = site.image_url || images[0]?.url;
  const mapsUrl = site.latitude && site.longitude
    ? `https://www.google.com/maps?q=${site.latitude},${site.longitude}`
    : '';

  return (
    <main className="pb-8">
      <header className="bg-[#1a3a2e] px-4 pb-6 pt-4 text-white">
        <Link href="/guide/destinations" className="flex min-h-11 items-center text-sm font-semibold text-emerald-100">← Kembali</Link>
        <p className="mt-3 text-xs font-bold uppercase tracking-[0.15em] text-emerald-200">
          {categoryLabels[site.category] ?? site.category}
        </p>
        <h1 className="mt-2 text-2xl font-bold leading-tight">{site.name}</h1>
        {site.address && <p className="mt-2 text-sm text-emerald-100">{site.address}</p>}
      </header>

      <div className="space-y-4 px-4 py-5">
        {heroImage && <BackendAssetImage src={heroImage} alt={site.name} className="h-56 w-full rounded-3xl object-cover shadow-sm" />}

        {site.description && (
          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Ringkasan untuk Penjelasan</p>
            <p className="mt-3 text-sm leading-6 text-slate-700">{site.description}</p>
          </section>
        )}

        <section className="rounded-3xl bg-white p-5 shadow-sm">
          <h2 className="font-bold text-slate-900">Informasi Situs</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Info label="Kategori" value={categoryLabels[site.category] ?? site.category} />
            <Info label="Status" value={site.status} />
            <Info label="Kelurahan" value={site.kelurahan} />
            <Info label="Kecamatan" value={site.kecamatan} />
            <Info label="Tahun Register" value={site.tahun_register} />
            <Info label="No. Register" value={site.no_register} />
          </div>
          {site.sk_penetapan && (
            <div className="mt-4 rounded-2xl bg-amber-50 p-3">
              <p className="text-xs font-bold uppercase text-amber-700">SK Penetapan</p>
              <p className="mt-1 whitespace-pre-line text-sm text-slate-700">{site.sk_penetapan}</p>
            </div>
          )}
        </section>

        {site.latitude && site.longitude && (
          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <h2 className="font-bold text-slate-900">Lokasi</h2>
            <p className="mt-2 text-sm text-slate-500">{Number(site.latitude).toFixed(6)}, {Number(site.longitude).toFixed(6)}</p>
            <iframe
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${Number(site.longitude) - 0.005},${Number(site.latitude) - 0.004},${Number(site.longitude) + 0.005},${Number(site.latitude) + 0.004}&layer=mapnik&marker=${site.latitude},${site.longitude}`}
              className="mt-4 h-56 w-full rounded-2xl border border-slate-200"
            />
            {mapsUrl && <a href={mapsUrl} target="_blank" rel="noreferrer" className="mt-4 flex min-h-12 items-center justify-center rounded-2xl bg-[#1a3a2e] font-bold text-white">Buka Navigasi</a>}
          </section>
        )}

        {images.length > 0 && (
          <section className="rounded-3xl bg-white p-5 shadow-sm">
            <h2 className="font-bold text-slate-900">Galeri Foto</h2>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {images.map((image, index) => (
                <a key={`${image.url}-${index}`} href={backendAssetUrl(image.url, '')} target="_blank" rel="noreferrer">
                  <BackendAssetImage src={image.url} alt={image.title || site.name} className="h-32 w-full rounded-2xl object-cover" />
                </a>
              ))}
            </div>
          </section>
        )}

        <MediaLinks title="Video" items={videos} fallback="Video" color="bg-emerald-50 text-[#1a3a2e]" />
        <MediaLinks title="Dokumen PDF" items={pdfs} fallback="Dokumen" color="bg-slate-50 text-slate-700" />
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return <div><p className="text-[10px] font-bold uppercase leading-4 text-slate-400">{label}</p><p className="mt-1 text-sm font-bold text-slate-800">{value}</p></div>;
}

function MediaLinks({ title, items, fallback, color }: { title: string; items: HeritageMediaItem[]; fallback: string; color: string }) {
  if (!items.length) return null;
  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm">
      <h2 className="font-bold text-slate-900">{title}</h2>
      <div className="mt-3 space-y-2">
        {items.map((item, index) => (
          <a key={`${item.url}-${index}`} href={item.url} target="_blank" rel="noreferrer" className={`block rounded-2xl p-3 text-sm font-bold ${color}`}>
            {item.title || `${fallback} ${index + 1}`}
          </a>
        ))}
      </div>
    </section>
  );
}

function visibleMedia(items?: HeritageMediaItem[]) {
  return (items ?? []).filter((item) => item.url && item.is_visible !== false);
}
