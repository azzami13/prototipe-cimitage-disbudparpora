const LOCAL_ORIGINS = ['http://localhost:3000', 'http://127.0.0.1:3000'];

export function getFrontendOrigins(): string[] {
  const isProduction = process.env.NODE_ENV === 'production';
  const configured = (process.env.FRONTEND_URL ?? '')
    .split(',')
    .map((origin) => {
      try {
        const url = new URL(origin.trim());
        const validProtocol = isProduction
          ? url.protocol === 'https:'
          : ['http:', 'https:'].includes(url.protocol);
        const isOriginOnly = url.pathname === '/' && !url.search && !url.hash;
        if (
          !validProtocol ||
          !isOriginOnly ||
          !url.hostname ||
          url.hostname === '*'
        ) {
          return null;
        }
        return url.origin;
      } catch {
        return null;
      }
    })
    .filter((origin): origin is string => Boolean(origin));

  const origins = isProduction ? configured : [...configured, ...LOCAL_ORIGINS];

  return [...new Set(origins)];
}
