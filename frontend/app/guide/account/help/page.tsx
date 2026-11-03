import Link from 'next/link';

export default function GuideHelpPage() {
  return (
    <main className="px-4 py-5">
      <Link href="/guide/account" className="text-sm font-bold text-slate-500">← Kembali</Link>
      <h1 className="mt-4 text-2xl font-bold text-[#1a3a2e]">Bantuan Guide</h1>
      <section className="mt-5 rounded-3xl bg-white p-5 text-sm leading-6 text-slate-600 shadow-sm">
        <p className="font-bold text-slate-900">Hubungi Admin Operasional melalui kanal resmi CimHeritage yang tersedia di lapangan.</p>
        <p className="mt-3">Untuk kendala pada trip aktif, buka detail tugas lalu gunakan tombol Bantuan agar laporan tercatat ke sistem dan dapat dilihat Admin.</p>
      </section>
    </main>
  );
}
