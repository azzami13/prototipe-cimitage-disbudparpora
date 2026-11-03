import type { ReactNode } from 'react';
import GuideBottomNav from '@/components/guide/GuideBottomNav';

export default function GuideLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#f4f8f5] text-slate-900">
      <div className="mx-auto min-h-screen max-w-xl bg-[#f7faf8] pb-28 shadow-[0_0_50px_rgba(15,23,42,0.08)]">
        {children}
      </div>
      <GuideBottomNav />
    </div>
  );
}
