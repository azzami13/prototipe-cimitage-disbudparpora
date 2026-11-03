import type { ReactNode } from 'react';
import DriverBottomNav from '@/components/driver/DriverBottomNav';

export default function DriverLayout({ children }: { children: ReactNode }) {
  return (
    <div className="driver-shell min-h-screen bg-[#f4f8f5] text-slate-900">
      <div className="mx-auto min-h-screen max-w-xl bg-[#f7faf8] pb-28 shadow-[0_0_50px_rgba(15,23,42,0.08)]">
        {children}
      </div>
      <DriverBottomNav />
    </div>
  );
}
