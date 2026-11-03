'use client';

import { useEffect } from 'react';

export default function PwaServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production') return;

    const register = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        await registration.update();
      } catch (error) {
        console.warn('Service worker Cimitage tidak dapat didaftarkan.', error);
      }
    };

    register();
  }, []);

  return null;
}
