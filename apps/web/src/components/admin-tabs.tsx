'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const tabs = [
  { href: '/admin',              label: 'Resumen',     icon: '📊' },
  { href: '/admin/frentes',      label: 'Frentes',     icon: '🏗️' },
  { href: '/admin/proveedores',  label: 'Proveedores', icon: '🏢' },
  { href: '/admin/materiales',   label: 'Materiales',  icon: '📦' },
  { href: '/admin/usuarios',     label: 'Usuarios',    icon: '👤' },
];

export function AdminTabs() {
  const path = usePathname();
  return (
    <nav className="bg-white border-b border-gray-200 sticky top-14 lg:top-0 z-30">
      <div className="max-w-[1440px] mx-auto px-4 md:px-8 flex overflow-x-auto no-scrollbar gap-1">
        {tabs.map((t) => {
          const active = path === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={cn(
                'flex items-center gap-1.5 px-3 md:px-4 py-3 text-[13px] font-medium border-b-2 whitespace-nowrap transition',
                active
                  ? 'text-navy-900 border-gold-500'
                  : 'text-gray-500 border-transparent hover:text-navy-700',
              )}
            >
              <span>{t.icon}</span> {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
