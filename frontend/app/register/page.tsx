'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn } from 'next-auth/react';
import { FormEvent, useState } from 'react';
import { api } from '@/lib/api';
import { useBackendReadiness } from '@/components/providers/BackendReadinessProvider';

export default function RegisterPage() {
  const { status } = useBackendReadiness();
  const backendReady = status === 'ready';
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (password !== confirmPassword) {
      setError('Konfirmasi password tidak sama.');
      return;
    }
    setLoading(true);
    try {
      await api.auth.register({ name, email, password });
      const result = await signIn('credentials', {
        redirect: false,
        email,
        password,
      });
      if (result?.error) router.push('/login');
      else router.push('/');
      router.refresh();
    } catch (err: any) {
      setError(err.message ?? 'Gagal membuat akun');
    } finally {
      setLoading(false);
    }
  };

  const googleRegister = async () => {
    setGoogleLoading(true);
    setError('');
    await signIn('google', { callbackUrl: '/' });
    setGoogleLoading(false);
  };

  return (
    <main className="flex min-h-[80vh] items-center justify-center bg-gray-50 px-4 py-10">
      <section className="w-full max-w-md rounded-xl border border-gray-100 bg-white p-8 shadow-lg">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-[#1a3a2e]">Daftar Customer</h1>
          <p className="mt-2 text-sm text-gray-500">Buat akun untuk memesan wisata dan melihat riwayat booking.</p>
        </div>

        {error && <div className="mb-5 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <button
          type="button"
          disabled={!backendReady || googleLoading || loading}
          onClick={googleRegister}
          className="mb-5 flex w-full items-center justify-center gap-3 rounded-md border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          <span className="text-base font-bold text-blue-600">G</span>
          {googleLoading ? 'Menghubungkan...' : 'Daftar dengan Google'}
        </button>

        <div className="mb-5 flex items-center gap-3 text-xs text-gray-400">
          <span className="h-px flex-1 bg-gray-200" />
          <span>atau</span>
          <span className="h-px flex-1 bg-gray-200" />
        </div>

        <form onSubmit={submit} className="space-y-4">
          <Field label="Nama">
            <input value={name} onChange={(event) => setName(event.target.value)} required className={inputClass} placeholder="Nama lengkap" />
          </Field>
          <Field label="Email">
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required className={inputClass} placeholder="nama@email.com" />
          </Field>
          <Field label="Password">
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} className={inputClass} placeholder="Minimal 6 karakter" />
          </Field>
          <Field label="Konfirmasi Password">
            <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={6} className={inputClass} placeholder="Ulangi password" />
          </Field>
          <button type="submit" disabled={!backendReady || loading || googleLoading} className="w-full rounded-md bg-[#1a3a2e] py-2.5 font-medium text-white hover:bg-[#132a21] disabled:bg-gray-400">
            {loading ? 'Mendaftarkan...' : backendReady ? 'Daftar' : 'Layanan sedang disiapkan...'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Sudah punya akun? <Link href="/login" className="font-semibold text-[#1a3a2e] hover:underline">Masuk</Link>
        </p>
      </section>
    </main>
  );
}

const inputClass = 'w-full rounded-md border border-gray-300 px-4 py-2.5 text-sm focus:border-[#1a3a2e] focus:outline-none focus:ring-1 focus:ring-[#1a3a2e]';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-gray-700">{label}</span>
      {children}
    </label>
  );
}
