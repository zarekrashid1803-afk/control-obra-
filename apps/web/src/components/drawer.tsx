'use client';
import { useEffect } from 'react';
import { cn } from '@/lib/utils';

export function Drawer({
  open, onClose, title, subtitle, children, footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Lock body scroll
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80]">
      <button
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 bg-black/40 animate-in fade-in"
      />
      <div
        className={cn(
          'absolute right-0 top-0 bottom-0 bg-white shadow-2xl flex flex-col',
          'w-full md:w-[520px] lg:w-[640px]',
          'animate-in slide-in-from-right',
        )}
      >
        <header className="px-5 py-4 border-b border-gray-200 flex items-start justify-between gap-3 sticky top-0 bg-white z-10">
          <div className="min-w-0 flex-1">
            <h2 className="text-[16px] font-semibold text-navy-900 leading-tight">{title}</h2>
            {subtitle && <p className="text-[12px] text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 grid place-items-center rounded hover:bg-gray-100 text-2xl text-gray-400 flex-shrink-0"
            aria-label="Cerrar"
          >×</button>
        </header>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && (
          <footer className="px-5 py-3 border-t border-gray-200 bg-gray-50 flex gap-2 justify-end sticky bottom-0">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
