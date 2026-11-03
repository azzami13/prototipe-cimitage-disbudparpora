'use client';

export default function OfflinePage() {
  return (
    <main className="grid min-h-[70vh] place-items-center bg-[#f5f7f4] px-4 py-16">
      <section className="w-full max-w-xl rounded-3xl border border-slate-100 bg-white p-7 text-center shadow-xl sm:p-10">
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#1a3a2e] text-white">
          <svg aria-hidden="true" className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M5.5 8.5a10 10 0 0 1 13 0" />
            <path d="M8.5 12a5.5 5.5 0 0 1 7 0" />
            <path d="M12 16h.01" />
            <path d="m3 3 18 18" />
          </svg>
        </div>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Mode Offline</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Koneksi internet sedang tidak tersedia.</h1>
        <p className="mt-4 text-sm leading-7 text-slate-600">
          Beberapa informasi tersimpan dapat tetap dibuka, tetapi data perjalanan dan pemesanan memerlukan koneksi.
        </p>
        <button type="button" onClick={() => window.location.reload()} className="mt-7 rounded-xl bg-sky-500 px-6 py-3 font-semibold text-white hover:bg-sky-600">
          Coba Lagi
        </button>
      </section>
    </main>
  );
}
