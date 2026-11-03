const values = [
  {
    icon: '🧭',
    title: 'Mudah Dijelajahi',
    description: 'Informasi lokasi, kategori, dan rute wisata disajikan secara visual dan mudah digunakan.',
  },
  {
    icon: '🏛',
    title: 'Warisan Terdata',
    description: 'Data situs disusun untuk membantu masyarakat mengenal sejarah dan identitas heritage Cimahi.',
  },
  {
    icon: '🤝',
    title: 'Layanan Terhubung',
    description: 'Wisatawan dan pengelola terhubung melalui pemesanan serta layanan operasional wisata.',
  },
];

const services = [
  'Peta interaktif lokasi cagar budaya Kota Cimahi',
  'Informasi lengkap situs dan aset heritage',
  'Perencanaan rute perjalanan wisata',
  'Paket dan pemesanan kunjungan wisata',
  'Monitoring layanan wisata dan kendaraan Sakoci',
];

export default function TentangPage() {
  return (
    <main className="bg-[#f5f7f4]">
      <section className="relative overflow-hidden bg-[#16352a] px-4 py-16 text-white sm:px-6 sm:py-20 lg:px-12 lg:py-24">
        <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-sky-400/15 blur-3xl" />
        <div className="absolute -bottom-32 left-1/3 h-80 w-80 rounded-full bg-amber-400/10 blur-3xl" />

        <div className="relative mx-auto max-w-6xl">
          <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-sky-300">
            Tentang Kami
          </span>
          <h1 className="mt-6 max-w-4xl text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl">
            Menjaga cerita Cimahi tetap hidup dan mudah dijelajahi
          </h1>
          <p className="mt-6 max-w-3xl text-base leading-8 text-green-50/80 sm:text-lg">
            Cimahi Heritage adalah platform WebGIS informasi cagar budaya dan layanan wisata
            yang mendekatkan masyarakat dengan sejarah Kota Cimahi melalui data, peta, rute,
            dan pemesanan wisata dalam satu layanan.
          </p>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:py-20">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.16em] text-sky-500">Siapa Kami</p>
          <h2 className="mt-3 text-3xl font-extrabold text-[#1a3a2e]">
            Platform informasi dan layanan wisata heritage Kota Cimahi
          </h2>
          <div className="mt-5 space-y-4 leading-7 text-gray-600">
            <p>
              Platform ini dikembangkan untuk mendukung pengelolaan heritage oleh Dinas
              Kebudayaan, Pariwisata, Kepemudaan, dan Olahraga Kota Cimahi.
            </p>
            <p>
              Melalui Cimahi Heritage, wisatawan dapat mengenal berbagai situs bersejarah,
              merencanakan perjalanan, menemukan rute kunjungan, dan mengakses layanan wisata
              secara lebih informatif, nyaman, dan terarah.
            </p>
          </div>
        </div>

        <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-xl sm:p-8">
          <p className="text-sm font-bold text-[#1a3a2e]">Layanan yang kami hadirkan</p>
          <div className="mt-5 space-y-4">
            {services.map((service) => (
              <div key={service} className="flex items-start gap-3 text-sm leading-6 text-gray-600">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-green-100 text-xs text-green-700">✓</span>
                <span>{service}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:pb-20">
        <div className="grid gap-5 md:grid-cols-3">
          {values.map((item) => (
            <article key={item.title} className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-green-50 text-2xl">{item.icon}</div>
              <h2 className="mt-5 text-xl font-bold text-[#1a3a2e]">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-gray-500">{item.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="px-4 pb-16 sm:px-6 lg:pb-20">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 rounded-3xl bg-sky-500 p-7 text-white shadow-xl sm:p-10 md:flex-row md:items-center">
          <div>
            <h2 className="text-2xl font-bold">Mulai jelajahi heritage Kota Cimahi</h2>
            <p className="mt-2 text-sm text-sky-50">Temukan situs, rute, dan pengalaman wisata melalui peta interaktif.</p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <a href="/peta" className="rounded-full bg-white px-6 py-3 text-center text-sm font-bold text-sky-600 hover:bg-sky-50">
              Buka Peta
            </a>
            <a href="/heritage" className="rounded-full border border-white/50 px-6 py-3 text-center text-sm font-bold text-white hover:bg-white/10">
              Lihat Situs
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
