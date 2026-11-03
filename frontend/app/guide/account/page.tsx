'use client';

import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import BackendAssetImage from '@/components/ui/BackendAssetImage';

export default function GuideAccountPage() {
  const { data: session } = useSession();
  const user = session?.user;
  return (
    <main className="px-4 py-5">
      <h1 className="text-2xl font-bold text-[#1a3a2e]">Akun</h1>
      <section className="mt-5 rounded-3xl bg-white p-5 shadow-sm">
        <div className="flex items-center gap-4">
          {user?.image ? <BackendAssetImage src={user.image} fallback="/images/branding/logo-disbudparpora.png" alt={user.name ?? 'Tour Guide'} className="h-16 w-16 rounded-full object-cover" /> : <div className="grid h-16 w-16 place-items-center rounded-full bg-emerald-50 text-xl font-black text-[#1a3a2e]">{user?.name?.[0] ?? 'G'}</div>}
          <div>
            <h2 className="font-bold text-slate-900">{user?.name ?? 'Tour Guide'}</h2>
            <p className="text-sm text-slate-500">{user?.email ?? '-'}</p>
            <p className="mt-1 text-xs font-bold uppercase text-emerald-700">Akun aktif</p>
          </div>
        </div>
      </section>
      <section className="mt-5 overflow-hidden rounded-3xl bg-white shadow-sm">
        <Link href="/guide/account/help" className="block border-b border-slate-100 p-4 font-bold text-slate-700">Bantuan</Link>
        <div className="border-b border-slate-100 p-4 font-bold text-slate-700">Tentang Aplikasi</div>
        <button onClick={() => signOut({ callbackUrl: '/login' })} className="block w-full p-4 text-left font-bold text-red-600">Keluar</button>
      </section>
    </main>
  );
}
