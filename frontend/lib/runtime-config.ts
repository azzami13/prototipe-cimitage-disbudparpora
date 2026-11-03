export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === 'true';

const developmentApiUrl = process.env.NODE_ENV === 'development'
  ? 'http://localhost:3001/api'
  : '';

export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || (DEMO_MODE ? '/api/demo' : developmentApiUrl))
  .replace(/\/$/, '');

export const API_ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

export function backendAssetUrl(value?: string | null, fallback = '/images/fallback-heritage.svg') {
  if (!value) return fallback;
  // Mode demo: semua aset ada di folder /public/uploads pada aplikasi yang sama.
  if (DEMO_MODE) {
    if (/^https?:\/\//i.test(value)) {
      try {
        const url = new URL(value);
        if (url.pathname.startsWith('/uploads/') && ['localhost', '127.0.0.1'].includes(url.hostname)) return url.pathname;
      } catch { return fallback; }
      return value;
    }
    if (value.startsWith('data:') || value.startsWith('blob:')) return value;
    return value.startsWith('/') ? value : `/${value}`;
  }
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      if (API_ORIGIN && (['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname.startsWith('/uploads/'))) {
        return `${API_ORIGIN}${url.pathname}${url.search}${url.hash}`;
      }
    } catch {
      return fallback;
    }
    return value;
  }
  if (value.startsWith('data:') || value.startsWith('blob:')) return value;
  const path = value.startsWith('/') ? value : `/${value}`;
  return API_ORIGIN ? `${API_ORIGIN}${path}` : fallback;
}
