'use client';

import PwaInstallGuideModal from './PwaInstallGuideModal';
import { usePwaInstall } from './usePwaInstall';

export default function PwaInstallButton() {
  const { canInstall, install, showIosGuide, closeIosGuide } = usePwaInstall();

  if (!canInstall) return null;

  return (
    <>
      <button
        type="button"
        onClick={install}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-5 py-3 font-semibold text-sky-700 transition hover:bg-sky-100"
      >
        <svg aria-hidden="true" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3v12" />
          <path d="m7 10 5 5 5-5" />
          <path d="M5 20h14" />
        </svg>
        Install Aplikasi
      </button>
      <PwaInstallGuideModal open={showIosGuide} onClose={closeIosGuide} />
    </>
  );
}
