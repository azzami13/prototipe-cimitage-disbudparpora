import Link from 'next/link';

const guides = [
  {
    title: 'Alur booking',
    steps: ['Pantau booking masuk di menu Booking.', 'Konfirmasi jadwal jika data pengunjung sudah lengkap.', 'Tetapkan tour guide, driver, dan Sakoci dari halaman detail booking.'],
  },
  {
    title: 'Verifikasi pembayaran',
    steps: ['Buka menu Pembayaran.', 'Cek bukti transfer pada baris booking.', 'Gunakan Terima atau Tolak agar status tercatat konsisten.'],
  },
  {
    title: 'Monitoring Sakoci',
    steps: ['Daftarkan unit di menu Monitoring.', 'Aktifkan tracking untuk unit yang boleh dipantau.', 'Driver dapat memperbarui posisi dari halaman booking yang ditugaskan.'],
  },
  {
    title: 'Pengelolaan konten',
    steps: ['Lengkapi situs cagar budaya di menu Heritage Sites.', 'Susun paket dan urutan rute di menu Paket Wisata dan Rute.', 'Gunakan laporan untuk melihat paket yang paling sering dipesan.'],
  },
];

export default function HelpPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/admin" className="text-sm text-gray-500 hover:text-[#1a3a2e]">
          Kembali ke Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-[#1a3a2e]">Bantuan & Dokumentasi</h1>
        <p className="text-gray-500 mt-1">Panduan kerja singkat untuk admin, tour guide, dan driver.</p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {guides.map((guide) => (
          <section key={guide.title} className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-800">{guide.title}</h2>
            <ol className="mt-4 space-y-3">
              {guide.steps.map((step, index) => (
                <li key={step} className="flex gap-3 text-sm text-gray-600">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1a3a2e] text-xs font-semibold text-white">{index + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>

      <section className="mt-6 bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-800">Kontak eskalasi</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-sm font-medium text-gray-800">Operasional wisata</p>
            <p className="mt-1 text-sm text-gray-500">Konfirmasi jadwal, rombongan, dan rute.</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-sm font-medium text-gray-800">Pembayaran</p>
            <p className="mt-1 text-sm text-gray-500">Validasi bukti transfer dan status refund.</p>
          </div>
          <div className="rounded-lg bg-gray-50 p-4">
            <p className="text-sm font-medium text-gray-800">Teknis sistem</p>
            <p className="mt-1 text-sm text-gray-500">Akses akun, data tidak sinkron, dan kendala tracking.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
