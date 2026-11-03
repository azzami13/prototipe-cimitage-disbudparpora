'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { href: '/guide', label: 'Beranda', icon: '⌂' },
  { href: '/guide/tasks', label: 'Tugas', icon: '▣' },
  { href: '/guide/destinations', label: 'Destinasi', icon: '⌖' },
  { href: '/guide/history', label: 'Riwayat', icon: '◷' },
  { href: '/guide/account', label: 'Akun', icon: '○' },
];

export default function GuideBottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-xl border-t border-emerald-100 bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur">
      <div className="grid grid-cols-5">
        {items.map((item) => {
          const active = item.href === '/guide' ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link key={item.href} href={item.href} className={`flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-semibold transition ${active ? 'bg-emerald-50 text-[#1a3a2e]' : 'text-slate-400'}`}>
              <span className="text-xl leading-none" aria-hidden="true">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
