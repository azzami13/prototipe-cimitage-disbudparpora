'use client';

import { useEffect } from 'react';

export default function PwaInstallGuideModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[2100] grid place-items-end bg-slate-950/50 p-4 sm:place-items-center" onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="pwa-install-guide-title"
        className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl sm:p-8"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-600">iPhone &amp; iPad</p>
            <h2 id="pwa-install-guide-title" className="mt-1 text-xl font-bold text-slate-900">Tambahkan Cimitage ke Layar Utama</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup panduan install" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-slate-100 text-lg text-slate-600 hover:bg-slate-200">×</button>
        </div>

        <ol className="mt-6 space-y-4 text-sm leading-6 text-slate-600">
          <li className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sky-100 font-bold text-sky-700">1</span><span>Tekan tombol <strong className="text-slate-800">Share</strong> di toolbar Safari.</span></li>
          <li className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sky-100 font-bold text-sky-700">2</span><span>Pilih <strong className="text-slate-800">Add to Home Screen</strong>.</span></li>
          <li className="flex gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sky-100 font-bold text-sky-700">3</span><span>Konfirmasi dengan menekan <strong className="text-slate-800">Add</strong>.</span></li>
        </ol>

        <button type="button" onClick={onClose} className="mt-7 w-full rounded-xl bg-[#1a3a2e] px-5 py-3 font-semibold text-white hover:bg-[#254f40]">Mengerti</button>
      </section>
    </div>
  );
}
