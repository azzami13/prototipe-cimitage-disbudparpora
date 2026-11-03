import type { Metadata, Viewport } from 'next';
import 'leaflet/dist/leaflet.css';
import './globals.css';

import AuthProvider from '../components/providers/AuthProvider';
import SiteHeader from '@/components/layout/SiteHeader';
import SiteFooter from '@/components/layout/SiteFooter';
import { BackendReadinessProvider } from '@/components/providers/BackendReadinessProvider';
import PwaServiceWorker from '@/components/pwa/PwaServiceWorker';

export const metadata: Metadata = {
  title: {
    default: 'Cimitage Tourism',
    template: '%s | Cimitage Tourism',
  },
  description: 'WebGIS Cagar Budaya dan Operasional Kendaraan Wisata Sakoci Kota Cimahi',
  applicationName: 'Cimitage Tourism',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Cimitage',
  },
  icons: {
    icon: [
      { url: '/icons/cimitage-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/cimitage-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/icons/cimitage-192.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#1a3a2e',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body className="min-h-screen bg-slate-50 font-sans flex flex-col">
        
        <AuthProvider>
          <BackendReadinessProvider>
            <PwaServiceWorker />
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <SiteFooter />
          </BackendReadinessProvider>
          
        </AuthProvider>
        
      </body>
    </html>
  );
}
