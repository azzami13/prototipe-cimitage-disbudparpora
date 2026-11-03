'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { markBackendReady, resetBackendReadyGate } from '@/lib/backend-readiness';
import { API_BASE_URL } from '@/lib/runtime-config';

export type BackendStatus = 'checking' | 'waking' | 'ready' | 'device-offline' | 'unavailable';
type BackendReadinessContextValue = { status: BackendStatus; retry: () => void };
const BackendReadinessContext = createContext<BackendReadinessContextValue | null>(null);
const MAX_ATTEMPTS = 15;
const RETRY_DELAY_MS = 4500;
const REQUEST_TIMEOUT_MS = 6000;

export function BackendReadinessProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<BackendStatus>('checking');
  const runId = useRef(0);

  const checkUntilReady = useCallback(async () => {
    const currentRun = ++runId.current;
    resetBackendReadyGate();

    if (!navigator.onLine) {
      setStatus('device-offline');
      return;
    }

    setStatus('checking');

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        if (!API_BASE_URL) throw new Error('API URL is not configured');
        const response = await fetch(`${API_BASE_URL}/health`, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('Service is not ready');
        if (currentRun !== runId.current) return;
        markBackendReady();
        setStatus('ready');
        return;
      } catch {
        if (currentRun !== runId.current) return;
        if (!navigator.onLine) {
          setStatus('device-offline');
          return;
        }
        setStatus('waking');
      } finally {
        window.clearTimeout(timeout);
      }
      if (attempt < MAX_ATTEMPTS - 1) {
        await new Promise((resolve) => window.setTimeout(resolve, RETRY_DELAY_MS));
      }
    }
    if (currentRun === runId.current) setStatus(navigator.onLine ? 'unavailable' : 'device-offline');
  }, []);

  useEffect(() => {
    checkUntilReady();
    return () => { runId.current += 1; };
  }, [checkUntilReady]);

  useEffect(() => {
    const recheckWhenVisible = () => {
      if (document.visibilityState === 'visible' && (status === 'unavailable' || status === 'waking')) checkUntilReady();
    };
    document.addEventListener('visibilitychange', recheckWhenVisible);
    return () => document.removeEventListener('visibilitychange', recheckWhenVisible);
  }, [checkUntilReady, status]);

  useEffect(() => {
    const handleOffline = () => {
      runId.current += 1;
      resetBackendReadyGate();
      setStatus('device-offline');
    };
    const handleOnline = () => checkUntilReady();
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [checkUntilReady]);

  return (
    <BackendReadinessContext.Provider value={{ status, retry: checkUntilReady }}>
      {children}
      {status !== 'ready' && <BackendStatusNotice status={status} retry={checkUntilReady} />}
    </BackendReadinessContext.Provider>
  );
}

export function useBackendReadiness() {
  const context = useContext(BackendReadinessContext);
  if (!context) throw new Error('useBackendReadiness must be used inside BackendReadinessProvider');
  return context;
}

function BackendStatusNotice({ status, retry }: { status: BackendStatus; retry: () => void }) {
  const pathname = usePathname();
  const isDeviceOffline = status === 'device-offline';
  const isUnavailable = status === 'unavailable';
  const hasError = isDeviceOffline || isUnavailable;
  const title = isDeviceOffline
    ? 'Koneksi internet sedang tidak tersedia'
    : isUnavailable
      ? 'Layanan Cimitage tidak dapat dihubungi'
      : 'Menyiapkan layanan Cimitage…';
  const description = isDeviceOffline
    ? 'Beberapa informasi tersimpan dapat tetap dibuka, tetapi data perjalanan dan pemesanan memerlukan koneksi.'
    : isUnavailable
      ? 'Perangkat terhubung ke internet, tetapi backend belum merespons. Silakan coba kembali beberapa saat lagi.'
      : 'Server Render sedang diaktifkan. Halaman publik tetap dapat digunakan selama proses ini.';

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[2000] flex justify-center p-4" role={hasError ? 'alert' : 'status'} aria-live="polite">
      <div className="pointer-events-auto w-full max-w-lg rounded-2xl border border-white/70 bg-white/95 p-4 shadow-2xl backdrop-blur-xl sm:p-5">
        <div className="flex items-center gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#1a3a2e] text-xl text-white shadow-lg">
            {hasError ? '⌁' : <span className="backend-spinner" aria-hidden="true" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Cimahi Heritage</p>
            <h2 className="mt-1 font-bold text-slate-900">{title}</h2>
            <p className="mt-1 text-xs leading-5 text-slate-600 sm:text-sm">{description}</p>
          </div>
        </div>
        {hasError && (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={retry} className="flex-1 rounded-xl bg-[#1a3a2e] px-4 py-3 text-sm font-bold text-white hover:bg-[#254f40]">Coba Lagi</button>
            {pathname !== '/' && <Link href="/" className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-center text-sm font-bold text-slate-700 hover:bg-slate-50">Kembali ke Beranda</Link>}
          </div>
        )}
      </div>
    </div>
  );
}
