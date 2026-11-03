'use client';

import { signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import BackendAssetImage from '@/components/ui/BackendAssetImage';

export default function DriverAccountPage() {
  const { data: session } = useSession();
  const user = session?.user;
  const logout = async () => {
    localStorage.removeItem('token');
    await signOut({ callbackUrl: '/login' });
  };
  return (
    <main>
      <header className="rounded-b-[2rem] bg-[#1a3a2e] px-5 pb-10 pt-7 text-white">
        <h1 className="text-2xl font-bold">Akun Driver</h1>
        <div className="mt-6 flex items-center gap-4">
          {user?.avatar_url ? <BackendAssetImage src={user.avatar_url} fallback="/images/branding/logo-disbudparpora.png" alt="" className="h-20 w-20 rounded-full border-4 border-white/20 object-cover" /> :
            <div className="grid h-20 w-20 place-items-center rounded-full bg-white/15 text-3xl font-bold">{user?.name?.charAt(0) ?? 'D'}</div>}
          <div>
            <h2 className="text-xl font-bold">{user?.name ?? 'Driver CimHeritage'}</h2>
            <p className="mt-1 text-sm text-emerald-100">{user?.email}</p>
            <span className="mt-2 inline-flex rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-bold text-emerald-100">Akun Aktif</span>
          </div>
        </div>
      </header>
      <div className="-mt-3 space-y-4 px-4">
        <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
          <Menu href="/profile" icon="◉" label="Profil Saya" />
          <Menu href="/driver/tasks" icon="🚐" label="Tugas dan Sakoci" />
          <Menu href="/driver/account/help" icon="?" label="Bantuan dan Laporan Kendala" />
          <Menu href="/tentang" icon="i" label="Tentang Aplikasi" />
        </section>
        <button onClick={logout} className="min-h-12 w-full rounded-2xl border border-red-200 bg-white font-bold text-red-600">Keluar</button>
        <p className="text-center text-xs text-slate-400">CimHeritage Driver • Aplikasi Operasional Sakoci</p>
      </div>
    </main>
  );
}

function Menu({ href, icon, label }: { href: string; icon: string; label: string }) {
  return <Link href={href} className="flex min-h-14 items-center gap-4 border-b border-slate-100 px-5 last:border-0"><span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 font-bold text-emerald-800">{icon}</span><span className="flex-1 text-sm font-semibold text-slate-700">{label}</span><span className="text-slate-300">›</span></Link>;
}
