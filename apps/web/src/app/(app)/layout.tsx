'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';
import { AppBar } from '@/components/app-bar';
import { EmailVerifyBanner } from '@/components/email-verify-banner';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    const token = typeof window !== 'undefined' && localStorage.getItem('control_obra_token');
    if (!token) {
      router.replace('/login');
      return;
    }
    // Si el usuario debe cambiar contraseña, redirigir antes de mostrar el dashboard
    if (user?.passwordChangeRequired) router.replace('/change-password');
  }, [router, user?.passwordChangeRequired]);

  if (!user) {
    return (
      <div className="min-h-screen grid place-items-center bg-gray-50 text-gray-500">
        Cargando…
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* AppBar es responsivo: sidebar fijo en lg+, top bar en < lg */}
      <AppBar />

      {/* Contenido principal: en lg+ tiene padding-left igual al ancho del sidebar */}
      <main className="flex-1 lg:ml-60 min-w-0">
        <EmailVerifyBanner />
        {children}
      </main>
    </div>
  );
}
