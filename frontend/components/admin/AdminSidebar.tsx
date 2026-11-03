'use client';

import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { can, Permission } from '@/lib/rbac';

const menu = [
  {
    label: 'Dashboard',
    href: '/admin',
    icon: '📊',
    permission: 'dashboard.view',
  },
  {
    label: 'Heritage Sites',
    href: '/admin/heritage',
    icon: '🏛',
    permission: 'heritage.manage',
  },
  {
    label: 'Paket Wisata',
    href: '/admin/paket',
    icon: '📦',
    permission: 'packages.manage',
  },
  {
    label: 'Graph & Routing',
    href: '/admin/graph',
    icon: '🧭',
    permission: 'graph.manage',
  },
  {
    label: 'Atur Sewa',
    href: '/admin/sewa',
    icon: '🚐',
    permission: 'rentals.manage',
  },
  {
    label: 'Booking',
    href: '/admin/booking',
    icon: '📋',
    permissions: ['bookings.manage', 'bookings.assigned'],
  },
  {
    label: 'Monitoring',
    href: '/admin/monitoring',
    icon: '🛰',
    permission: 'monitoring.view',
  },
  {
    label: 'Pembayaran',
    href: '/admin/payments',
    icon: '💳',
    permission: 'payments.manage',
  },
  {
    label: 'Laporan',
    href: '/admin/reports',
    icon: '📈',
    permission: 'reports.view',
  },
  {
    label: 'Notifikasi',
    href: '/admin/notifications',
    icon: '🔔',
    permission: 'notifications.manage',
  },
  {
    label: 'User Control',
    href: '/admin/users',
    icon: '👤',
    permission: 'users.manage',
  },
  {
    label: 'Audit Log',
    href: '/admin/audit',
    icon: '🧾',
    permission: 'audit.view',
  },
  {
    label: 'Pengaturan',
    href: '/admin/settings',
    icon: '⚙',
    permissions: ['settings.view', 'settings.manage'],
  },
  {
    label: 'RBAC',
    href: '/admin/rbac',
    icon: '🔐',
    permission: 'rbac.manage',
  },
  {
    label: 'Bantuan',
    href: '/admin/help',
    icon: '❔',
    permission: 'help.view',
  },
] satisfies Array<{
  label: string;
  href: string;
  icon: string;
  permission?: Permission;
  permissions?: Permission[];
}>;

export default function AdminSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const role = session?.user?.role;
  const visibleMenu = menu.filter((item) => {
    const permissions = item.permissions ?? (item.permission ? [item.permission] : []);
    return permissions.some((permission) => can(role, permission));
  });

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-[60] flex h-16 items-center justify-between bg-[#1a3a2e] px-4 text-white shadow-lg lg:hidden">
        <Link href="/admin" className="font-bold">
          ⚙ CimHeritage
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="grid h-10 w-10 place-items-center rounded-lg border border-white/20 text-xl hover:bg-white/10"
          aria-label="Buka menu admin"
          aria-expanded={open}
        >
          ☰
        </button>
      </header>

      {open && (
        <button
          type="button"
          className="fixed inset-0 z-[70] bg-black/50 lg:hidden"
          onClick={() => setOpen(false)}
          aria-label="Tutup menu admin"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-[80] flex w-[min(18rem,86vw)] flex-col bg-[#1a3a2e] text-white shadow-xl transition-transform duration-300 lg:sticky lg:top-0 lg:z-20 lg:h-screen lg:w-72 lg:shrink-0 lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-start justify-between border-b border-white/10 p-5 lg:p-6">
          <div>
            <Link href="/admin">
              <h1 className="text-xl font-bold cursor-pointer lg:text-2xl">
                ⚙ CimHeritage
              </h1>
            </Link>

            <p className="mt-1 text-sm text-green-200">
              Admin Dashboard
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="grid h-9 w-9 place-items-center rounded-lg hover:bg-white/10 lg:hidden"
            aria-label="Tutup menu admin"
          >
            ✕
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto overscroll-contain p-3 lg:space-y-2 lg:p-4">
          {visibleMenu.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-4 py-2.5 transition lg:py-3 ${
                  active
                    ? 'bg-white text-[#1a3a2e] font-semibold'
                    : 'hover:bg-white/10'
                }`}
              >
                <span className="text-lg" aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-4">
          <Link
            href="/"
            className="block rounded-xl bg-amber-500 py-3 text-center font-semibold transition hover:bg-amber-600"
          >
            ← Kembali ke Website
          </Link>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="mt-3 w-full rounded-xl border border-red-200/40 bg-white/10 py-3 text-center font-semibold text-red-100 transition hover:bg-red-500 hover:text-white"
          >
            Logout
          </button>
        </div>
      </aside>
    </>
  );
}
