'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/auth-store';
import { auth, setToken, setRefreshToken } from '@/lib/api';
import { cn } from '@/lib/utils';
import { LogoOrion } from './logo-orion';

type NavItem = {
  href: string;
  label: string;
  icon: string;
  rolesPermitidos?: string[];
  separator?: boolean;
};

const navItems: NavItem[] = [
  { href: '/dashboard',           label: 'Inicio',                  icon: '🏠' },
  // 8 secciones operativas oficiales
  { href: '/caja',                label: 'Caja menor principal',    icon: '💵', separator: true },
  { href: '/caja/legalizacion',   label: 'Arqueo y legalización',   icon: '📑' },
  { href: '/punto-obra',          label: 'Punto de obra',           icon: '🏗️' },
  { href: '/evaluacion',          label: 'Evaluación y aprobación', icon: '✓' },
  { href: '/ordenes-compra',      label: 'Compras general',         icon: '🧾' },
  { href: '/requisiciones',       label: 'Requisición general',     icon: '📋' },
  { href: '/bodega',              label: 'Bodega → punto de obra',  icon: '📦' },
  { href: '/inventario',          label: 'Inventarios (E/S)',       icon: '📊' },
  // Secundarias
  { href: '/documentos-soporte',  label: 'Doc. soporte (DSNE)',     icon: '📄', separator: true },
  { href: '/reportes',            label: 'Reportes',                icon: '📥', rolesPermitidos: ['admin', 'director', 'auditor', 'compras', 'caja'] },
  { href: '/auditoria',           label: 'Auditoría',               icon: '🔍', rolesPermitidos: ['admin', 'director', 'auditor'] },
  { href: '/admin',               label: 'Admin',                   icon: '⚙️', rolesPermitidos: ['admin'] },
];

export function AppBar() {
  const path = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Cerrar drawer al cambiar de ruta
  useEffect(() => { setDrawerOpen(false); }, [path]);

  function logout() {
    // Limpiar estado local primero (instantáneo) y redirigir.
    // El POST /auth/logout va en background — si Render está dormido o
    // falla, no bloquea al usuario.
    setToken(null);
    setRefreshToken(null);
    clear();
    auth.logout().catch(() => {});
    router.push('/login');
  }

  const userRoles = user?.roles || [];
  // Bypass cuando NEXT_PUBLIC_ROLES_ENABLED=false (modo revisión interna). Muestra todo el menú.
  const rolesEnabled = process.env.NEXT_PUBLIC_ROLES_ENABLED !== 'false';
  const visibleItems = navItems.filter(item => {
    if (!rolesEnabled) return true;
    if (!item.rolesPermitidos) return true;
    return item.rolesPermitidos.some(r => userRoles.includes(r));
  });
  const currentItem = visibleItems.find(item => path?.startsWith(item.href));

  return (
    <>
      {/* ============================================================ */}
      {/* SIDEBAR DESKTOP (≥ lg / 1024px)                              */}
      {/* ============================================================ */}
      <aside className="hidden lg:flex lg:fixed lg:left-0 lg:top-0 lg:bottom-0 lg:w-60 lg:flex-col bg-navy-800 text-white z-40 shadow-xl">
        {/* Brand */}
        <Link href="/dashboard" className="flex items-center px-5 py-5 border-b border-white/10 hover:bg-white/5 transition">
          <LogoOrion className="h-8 w-auto text-white" />
        </Link>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2">
          {visibleItems.map((item) => {
            const active = path === item.href || (path?.startsWith(item.href + '/') && item.href !== '/dashboard');
            return (
              <div key={item.href}>
                {item.separator && <div className="my-2 mx-5 border-t border-white/10" />}
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-2.5 mx-2 px-3 py-2.5 rounded text-[13px] font-medium transition',
                    active
                      ? 'bg-navy-700 text-white border-l-2 border-l-gold-500 -ml-px pl-3.5'
                      : 'text-white/80 hover:bg-white/8 hover:text-white',
                  )}
                >
                  <span className="text-[15px] w-5 grid place-items-center flex-shrink-0">{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                </Link>
              </div>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-gold-500 text-navy-900 grid place-items-center font-semibold text-[12px] flex-shrink-0">
              {user?.iniciales || '··'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12.5px] font-medium truncate">{user?.nombres} {user?.apellidos}</div>
              <div className="text-[10.5px] text-white/60 capitalize truncate">{user?.roles?.join(' · ')}</div>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full mt-2 py-1.5 text-[11.5px] font-medium text-white/70 hover:text-white hover:bg-white/8 rounded transition"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* ============================================================ */}
      {/* TOP BAR MOBILE / TABLET (< lg)                                */}
      {/* ============================================================ */}
      <header
        className="lg:hidden bg-navy-700 text-white h-14 px-4 flex items-center justify-between sticky top-0 z-50 shadow"
        style={{ paddingTop: 'env(safe-area-inset-top, 0)', height: 'calc(56px + env(safe-area-inset-top, 0px))' }}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <button
            onClick={() => setDrawerOpen(true)}
            className="w-10 h-10 -ml-2 grid place-items-center rounded active:bg-white/10"
            aria-label="Menú"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
            </svg>
          </button>
          <Link href="/dashboard" className="flex items-center gap-2 min-w-0">
            <LogoOrion className="h-6 w-auto text-white flex-shrink-0" />
            <span className="text-[15px] font-semibold truncate">
              {currentItem?.label || ''}
            </span>
          </Link>
        </div>
        <button
          onClick={logout}
          title="Cerrar sesión"
          className="w-9 h-9 rounded-full bg-gold-500 text-navy-900 grid place-items-center font-semibold text-[12px] active:opacity-80"
        >
          {user?.iniciales || '··'}
        </button>
      </header>

      {/* ============================================================ */}
      {/* DRAWER MOBILE (< lg)                                          */}
      {/* ============================================================ */}
      {drawerOpen && (
        <div className="fixed inset-0 z-[100] lg:hidden">
          <button
            aria-label="Cerrar"
            className="absolute inset-0 bg-black/50 animate-in fade-in duration-150"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="absolute left-0 top-0 bottom-0 w-72 max-w-[85%] bg-white shadow-2xl overflow-y-auto animate-in slide-in-from-left duration-200">
            <div
              className="bg-navy-700 text-white p-4"
              style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 16px)' }}
            >
              <div className="mb-4">
                <LogoOrion className="h-8 w-auto text-white" />
              </div>
              <div className="flex items-center gap-2 pt-3 border-t border-white/10">
                <div className="w-9 h-9 rounded-full bg-gold-500 text-navy-900 grid place-items-center font-semibold text-[12px]">
                  {user?.iniciales}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] truncate">{user?.nombres} {user?.apellidos}</div>
                  <div className="text-[10.5px] text-white/70 truncate">{user?.roles?.join(' · ')}</div>
                </div>
              </div>
            </div>
            <nav className="py-2">
              {visibleItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 px-5 py-3.5 text-[14.5px] font-medium border-l-4 transition',
                    path?.startsWith(item.href)
                      ? 'bg-navy-50 text-navy-900 border-gold-500'
                      : 'text-gray-700 border-transparent active:bg-gray-50',
                    item.separator && 'border-t border-gray-100',
                  )}
                >
                  <span className="text-lg w-6 grid place-items-center">{item.icon}</span>
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="border-t border-gray-200 p-4">
              <button
                onClick={logout}
                className="w-full py-2.5 text-st-rechazada border border-red-200 rounded font-medium text-[13px] active:bg-red-50"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
