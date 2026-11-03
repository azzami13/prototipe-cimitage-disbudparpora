'use client';

import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useRef, useState } from 'react';
import { can } from '@/lib/rbac';
import { backendAssetUrl } from '@/lib/runtime-config';

const logoImage = backendAssetUrl('/uploads/logo/logo-disbudparpora.png', '/images/fallback-heritage.svg');

const navItems = [
  { href: '/', label: 'Beranda' },
  { href: '/peta', label: 'Peta' },
  { href: '/heritage', label: 'Situs Wisata' },
  { href: '/paket', label: 'Paket' },
  { href: '/booking', label: 'Pesan' },
  { href: '/my-orders', label: 'Pesanan Saya' },
  { href: '/tentang', label: 'Tentang Kami' },
];

export default function SiteHeader() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [visible, setVisible] = useState(true);
  const lastScrollY = useRef(0);
  const isHome = pathname === '/';
  const isAdmin = pathname.startsWith('/admin');
  const userName = session?.user?.name ?? session?.user?.email;
  const rawAvatarUrl = session?.user?.avatar_url ?? session?.user?.image;
  const avatarUrl = rawAvatarUrl ? backendAssetUrl(rawAvatarUrl, '') : '';
  const hasAdminDashboard = can(session?.user?.role, 'dashboard.view');
  const accountHref = hasAdminDashboard ? '/admin' : '/profile';
  const accountLabel = hasAdminDashboard ? 'Buka dashboard admin' : 'Buka profil';

  const headerClass = isHome
    ? 'fixed left-0 right-0 top-0 z-30 bg-black/35 text-white backdrop-blur-md border-b border-white/10'
    : 'sticky top-0 z-30 bg-[#1a3a2e] text-white shadow-lg';

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  useEffect(() => {
    setMenuOpen(false);
    setVisible(true);
    lastScrollY.current = window.scrollY;
  }, [pathname]);

  useEffect(() => {
    if (isAdmin) return;

    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;

      window.requestAnimationFrame(() => {
        const currentY = Math.max(window.scrollY, 0);
        const scrollingDown = currentY > lastScrollY.current;

        if (menuOpen || currentY < 80) {
          setVisible(true);
        } else if (Math.abs(currentY - lastScrollY.current) > 8) {
          setVisible(!scrollingDown);
        }

        lastScrollY.current = currentY;
        ticking = false;
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [isAdmin, menuOpen]);

  if (isAdmin) return null;

  return (
    <header
      className={`${headerClass} transition-transform duration-300 ease-out ${
        visible ? 'translate-y-0' : '-translate-y-full'
      }`}
    >
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-4 py-3 sm:px-6 md:px-8 lg:px-12 lg:py-4">
        <a href="/" className="flex min-w-0 items-center gap-3">
          <img
            src={logoImage}
            alt="Logo Disbudparpora"
            className="h-10 w-auto shrink-0 object-contain sm:h-11 md:h-12"
          />
          <span className="hidden text-sm font-semibold leading-tight text-white/90 sm:block">
            Cimahi Heritage
          </span>
        </a>

        <nav className="hidden items-center gap-4 text-sm font-medium md:flex xl:gap-6">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`border-b-2 pb-2 transition ${
                isActive(item.href)
                  ? 'border-sky-400 text-sky-400'
                  : 'border-transparent text-white/90 hover:text-sky-400'
              }`}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          {isHome && (
            <label className="flex items-center gap-3 rounded-lg border border-white/35 bg-white/10 px-4 py-2 backdrop-blur-md">
              <span className="text-sky-400">🔍</span>
              <input
                type="text"
                placeholder="Cari lokasi cagar budaya"
                className="w-44 bg-transparent text-sm outline-none placeholder:text-white/60"
              />
            </label>
          )}

          {userName ? (
            <a
              href={accountHref}
              title={accountLabel}
              aria-label={accountLabel}
              className="flex max-w-56 items-center gap-2 rounded-full border border-white/40 bg-white/10 py-1.5 pl-1.5 pr-4 text-sm font-semibold text-white backdrop-blur-md hover:bg-white/15"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt={userName} className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-500 text-xs font-bold">
                  {userName.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="truncate">{userName}</span>
            </a>
          ) : (
            <a
              href="/login"
              className="rounded-full bg-sky-500 px-5 py-2 text-sm font-bold text-white shadow hover:bg-sky-400"
            >
              Login
            </a>
          )}
        </div>

        <div className="flex items-center gap-2 md:hidden">
          {userName ? (
            <a
              href={accountHref}
              title={accountLabel}
              aria-label={accountLabel}
              className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-sky-500 text-sm font-bold text-white"
            >
              {avatarUrl ? <img src={avatarUrl} alt={userName} className="h-full w-full object-cover" /> : userName.slice(0, 1).toUpperCase()}
            </a>
          ) : (
            <a href="/login" className="rounded-full bg-sky-500 px-4 py-2 text-sm font-bold text-white">
              Login
            </a>
          )}
          <button
            type="button"
            onClick={() => setMenuOpen((current) => !current)}
            className="grid h-10 w-10 place-items-center rounded-lg border border-white/40 text-xl hover:bg-white/10"
            aria-label={menuOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
            aria-expanded={menuOpen}
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      <div
        className={`overflow-hidden border-white/10 bg-[#1a3a2e]/95 backdrop-blur-md transition-[max-height,opacity] duration-300 md:hidden ${
          menuOpen ? 'max-h-[420px] border-t opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <nav className="space-y-1 px-4 py-3">
          {navItems.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`block rounded-lg px-4 py-3 text-sm font-semibold transition ${
                isActive(item.href)
                  ? 'bg-sky-500 text-white'
                  : 'text-white/90 hover:bg-white/10'
              }`}
            >
              {item.label}
            </a>
          ))}
          {isHome && (
            <label className="mt-2 flex items-center gap-3 rounded-lg border border-white/20 bg-white/10 px-4 py-3">
              <span aria-hidden="true">🔍</span>
              <input
                type="text"
                placeholder="Cari lokasi cagar budaya"
                className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/60"
              />
            </label>
          )}
        </nav>
      </div>
    </header>
  );
}
