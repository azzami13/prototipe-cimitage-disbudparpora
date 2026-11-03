import Link from 'next/link';

export default function DriverHelpPage() {
  return (
    <main className="p-4 pt-6">
      <Link href="/driver/account" className="inline-flex min-h-11 items-center text-sm font-bold text-slate-500">← Kembali</Link>
      <h1 className="mt-3 text-2xl font-bold text-slate-900">Bantuan Driver</h1>
      <p className="mt-2 text-sm leading-6 text-slate-500">Untuk kendala pada trip aktif, gunakan tombol Bantuan di detail tugas agar laporan langsung terhubung ke booking.</p>
      <div className="mt-6 space-y-3">
        {['Hubungi Admin Operasional', 'Panduan Menggunakan Aplikasi', 'GPS / Tracking Bermasalah', 'Kendala Akun Driver'].map((item) => (
          <div key={item} className="flex min-h-14 items-center rounded-2xl bg-white px-5 font-semibold text-slate-700 shadow-sm">{item}</div>
        ))}
      </div>
    </main>
  );
}
