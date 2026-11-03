'use client';
import dynamic from 'next/dynamic';

// Leaflet cannot run on server side - must be dynamic import
const PetaClient = dynamic(() => import('./PetaClient'), {
  ssr: false,
  loading: () => (
    <div className="flex h-[calc(100dvh-64px)] min-h-[560px] items-center justify-center bg-slate-100 lg:h-[calc(100dvh-80px)]">
      <div className="text-center">
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-[#1a3a2e] text-3xl text-white shadow-xl animate-pulse">🗺</div>
        <p className="font-semibold text-[#1a3a2e]">Memuat peta interaktif...</p>
      </div>
    </div>
  ),
});

export default function PetaPage() {
  return <PetaClient />;
}
