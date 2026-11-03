import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Cimitage Tourism',
    short_name: 'Cimitage',
    description: 'WebGIS Cagar Budaya dan Operasional Kendaraan Wisata Sakoci Kota Cimahi',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#f5f7f4',
    theme_color: '#1a3a2e',
    lang: 'id-ID',
    icons: [
      {
        src: '/icons/cimitage-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/cimitage-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/cimitage-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/cimitage-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
