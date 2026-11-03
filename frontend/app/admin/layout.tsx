import { ReactNode } from 'react';
import AdminSidebar from '@/components/admin/AdminSidebar';

export default function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="admin-shell flex min-h-screen bg-gray-100">
      <AdminSidebar />

      <main className="min-w-0 flex-1 overflow-x-hidden pt-16 lg:pt-0">
        {children}
      </main>
    </div>
  );
}
