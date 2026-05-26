'use client';
import { useAuthStore } from '@/lib/auth-store';
import { AdminTabs } from '@/components/admin-tabs';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.roles?.includes('admin');

  if (user && !isAdmin) {
    return (
      <div className="max-w-2xl mx-auto p-6 md:p-12 text-center">
        <div className="text-5xl mb-3">🔒</div>
        <h1 className="text-[20px] font-bold text-navy-900 mb-2">Acceso restringido</h1>
        <p className="text-[13px] text-gray-600">
          Esta sección está disponible solo para usuarios con rol <strong>Admin</strong>.
          Tu rol actual: <strong className="text-navy-900 capitalize">{user?.roles?.join(', ')}</strong>.
        </p>
      </div>
    );
  }

  return (
    <>
      <AdminTabs />
      {children}
    </>
  );
}
