'use client';

import type { ImgHTMLAttributes, SyntheticEvent } from 'react';
import { backendAssetUrl } from '@/lib/runtime-config';

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  src?: string | null;
  fallback?: string;
};

export default function BackendAssetImage({ src, fallback = '/images/fallback-heritage.svg', onError, ...props }: Props) {
  const handleError = (event: SyntheticEvent<HTMLImageElement>) => {
    if (event.currentTarget.src.endsWith(fallback)) return;
    event.currentTarget.src = fallback;
    onError?.(event);
  };
  return <img {...props} src={backendAssetUrl(src, fallback)} onError={handleError} />;
}
