'use client';

import { usePathname } from 'next/navigation';

const footerLinks = [
  { href: '/peta', label: 'Peta Heritage' },
  { href: '/heritage', label: 'Situs Wisata' },
  { href: '/paket', label: 'Paket Wisata' },
  { href: '/booking', label: 'Pemesanan' },
  { href: '/tentang', label: 'Tentang Kami' },
];

export default function SiteFooter() {
  const pathname = usePathname();

  if (pathname.startsWith('/admin')) return null;

  return (
    <footer className="bg-[#1a3a2e] text-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 md:grid-cols-[1.4fr_1fr] md:px-8 lg:px-12">
        <div>
          <p className="text-lg font-bold">Cimahi Heritage</p>
          <p className="mt-2 max-w-xl text-sm leading-6 text-green-100/80">
            Sistem WebGIS informasi cagar budaya dan layanan wisata heritage Kota Cimahi.
          </p>
        </div>

        <nav className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:flex sm:flex-wrap md:justify-end">
          {footerLinks.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-green-100/80 transition hover:text-sky-300"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </div>

      <div className="border-t border-white/10 px-4 py-4 text-center text-xs leading-5 text-green-100/70 sm:text-sm">
        © 2026 Sistem WebGIS Cagar Budaya Kota Cimahi — Dinas Kebudayaan &amp; Pariwisata
      </div>
    </footer>
  );
}
