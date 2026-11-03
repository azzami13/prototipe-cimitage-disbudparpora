'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { api, Sakoci, SystemSettings } from '@/lib/api';
import { can } from '@/lib/rbac';

export default function SettingsPage() {
  const { data: session } = useSession();
  const [form, setForm] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sakoci, setSakoci] = useState<Sakoci[]>([]);
  const [uploadingSakociId, setUploadingSakociId] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const canManageSettings = can(session?.user?.role, 'settings.manage');

  const load = async () => {
    setLoading(true);
    try {
      const [settings, sakociItems] = await Promise.all([
        api.operations.settings(),
        api.sakoci.list().catch(() => [] as Sakoci[]),
      ]);
      setForm(settings);
      setSakoci(sakociItems);
      setError('');
    } catch (err: any) {
      setError(err.message ?? 'Gagal memuat pengaturan');
    } finally {
      setLoading(false);
    }
  };

  const uploadSakociImage = async (item: Sakoci, file?: File) => {
    if (!file) return;
    setUploadingSakociId(item.id);
    try {
      const result = await api.sakoci.uploadImage(item.id, file);
      setSakoci((current) => current.map((candidate) => (
        candidate.id === item.id ? result.sakoci : candidate
      )));
      setMessage(`Foto ${item.name} tersimpan.`);
      setError('');
    } catch (err: any) {
      setError(err.message ?? 'Gagal mengupload foto Sakoci');
    } finally {
      setUploadingSakociId(null);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const set = <K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) => {
    setMessage('');
    setForm((current) => current ? { ...current, [key]: value } : current);
  };

  const save = async () => {
    if (!form || !canManageSettings) return;
    setSaving(true);
    try {
      setForm(await api.operations.updateSettings(form));
      setMessage('Pengaturan tersimpan di database.');
      setError('');
    } catch (err: any) {
      setError(err.message ?? 'Gagal menyimpan pengaturan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <Link href="/admin" className="text-sm text-gray-500 hover:text-[#1a3a2e]">Kembali ke Dashboard</Link>
        <h1 className="mt-2 text-2xl font-bold text-[#1a3a2e]">Pengaturan Sistem</h1>
        <p className="mt-1 text-gray-500">Konfigurasi operasional dari database. Super admin dapat mengubah sistem, admin operasional dapat mengelola foto Sakoci.</p>
      </div>

      {error && <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {message && <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}

      <section className="rounded-lg bg-white p-6 shadow">
        {loading || !form ? (
          <p className="text-sm text-gray-500">Memuat pengaturan...</p>
        ) : (
          <>
            <div className="grid gap-5 md:grid-cols-2">
              <Field disabled={!canManageSettings} label="Nama aplikasi" value={form.appName} onChange={(value) => set('appName', value)} />
              <Field disabled={!canManageSettings} label="Nama instansi" value={form.agencyName} onChange={(value) => set('agencyName', value)} />
              <Field disabled={!canManageSettings} label="Hotline operasional" value={form.operationalHotline} onChange={(value) => set('operationalHotline', value)} />
              <Field disabled={!canManageSettings} label="Kontak customer support" value={form.customerSupportContact} onChange={(value) => set('customerSupportContact', value)} />
              <Field disabled={!canManageSettings} label="Jam operasional" value={form.operationalHours} onChange={(value) => set('operationalHours', value)} />
              <NumberField disabled={!canManageSettings} label="Batas waktu pembayaran (jam)" value={form.paymentTimeoutHours} onChange={(value) => set('paymentTimeoutHours', value)} />
              <NumberField disabled={!canManageSettings} label="Offset hadir driver (menit)" value={form.driverReadyOffsetMinutes} onChange={(value) => set('driverReadyOffsetMinutes', value)} />
              <NumberField disabled={!canManageSettings} label="Batas kapasitas default" value={form.defaultCapacityLimit} onChange={(value) => set('defaultCapacityLimit', value)} />
              <NumberField disabled={!canManageSettings} label="Batas snap pickup (meter)" value={form.pickupMaxSnapMeters} onChange={(value) => set('pickupMaxSnapMeters', value)} />
            </div>
            <div className="mt-6 grid gap-3 md:grid-cols-2">
              <Toggle disabled={!canManageSettings} label="Tracking operasional" checked={form.trackingEnabled} onChange={(value) => set('trackingEnabled', value)} />
              <Toggle disabled={!canManageSettings} label="Tracking publik Sakoci" checked={form.publicTrackingEnabled} onChange={(value) => set('publicTrackingEnabled', value)} />
              <Toggle
                label="Tampilkan rute Sakoci saat ini di Peta Publik"
                description="Jika aktif, masyarakat dapat melihat polyline rute Sakoci yang sedang bertugas."
                checked={form.showPublicCurrentRoute}
                disabled={!canManageSettings}
                onChange={(value) => set('showPublicCurrentRoute', value)}
              />
              <Toggle
                label="Tampilkan graph jalan 2 km di sekitar Sakoci"
                description="Jika aktif, peta driver, admin, dan customer menampilkan node serta edge routing Sakoci di sekitar posisi kendaraan."
                checked={form.showSakociGraphRadius}
                disabled={!canManageSettings}
                onChange={(value) => set('showSakociGraphRadius', value)}
              />
            </div>
            {canManageSettings ? (
              <button onClick={save} disabled={saving} className="mt-6 rounded-lg bg-[#1a3a2e] px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {saving ? 'Menyimpan...' : 'Simpan pengaturan'}
              </button>
            ) : (
              <p className="mt-6 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Pengaturan sistem hanya dapat diubah oleh Super Admin.
              </p>
            )}
          </>
        )}
      </section>

      <section className="mt-6 rounded-lg bg-white p-6 shadow">
        <div className="mb-4">
          <h2 className="font-bold text-[#1a3a2e]">Ikon Sakoci di Peta</h2>
          <p className="mt-1 text-sm text-gray-500">Upload foto untuk masing-masing Sakoci. Foto ini dipakai sebagai marker kendaraan di peta.</p>
        </div>
        {loading ? (
          <p className="text-sm text-gray-500">Memuat data Sakoci...</p>
        ) : sakoci.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {sakoci.map((item) => (
              <div key={item.id} className="flex items-center gap-4 rounded-lg border p-3">
                <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-lg bg-emerald-50 text-sm font-bold text-emerald-800">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
                  ) : (
                    <span>{item.code || 'S'}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-gray-800">{item.name}</p>
                  <p className="text-xs text-gray-500">{item.code || '-'} • {item.plate_number || '-'}</p>
                </div>
                <label className="shrink-0 rounded-lg border px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                  {uploadingSakociId === item.id ? 'Mengupload...' : 'Upload foto'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    disabled={uploadingSakociId === item.id}
                    onChange={(event) => uploadSakociImage(item, event.target.files?.[0])}
                  />
                </label>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">Belum ada data Sakoci.</p>
        )}
      </section>
    </div>
  );
}

function Field({ label, value, disabled, onChange }: { label: string; value: string; disabled?: boolean; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <input disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500" />
    </label>
  );
}

function NumberField({ label, value, disabled, onChange }: { label: string; value: number; disabled?: boolean; onChange: (value: number) => void }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <input disabled={disabled} type="number" value={value} onChange={(event) => onChange(Number(event.target.value))} className="mt-1 w-full rounded-lg border px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-500" />
    </label>
  );
}

function Toggle({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between rounded-lg border px-4 py-3">
      <span>
        <span className="block text-sm font-medium text-gray-800">{label}</span>
        {description && <span className="mt-1 block text-xs text-gray-500">{description}</span>}
      </span>
      <input disabled={disabled} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 disabled:opacity-50" />
    </label>
  );
}
