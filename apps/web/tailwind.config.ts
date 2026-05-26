import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta principal — Black + Dove Grey (token `navy` por compatibilidad)
        navy: {
          900: '#000000', // Black
          800: '#1a1a1a',
          700: '#2d2d2d',
          600: '#4a4d4e',
          500: '#686B6C', // Dove Grey
          100: '#e8eaeb',
          50:  '#f5f6f7',
        },
        // Acento — Casper (token `gold` por compatibilidad)
        gold: {
          700: '#6b7d8a',
          600: '#8a9da9',
          500: '#AEBFCA', // Casper
          400: '#c5d2db',
          100: '#e8eef2',
        },
        // Estados de requisición (los 7)
        st: {
          borrador: '#6b7280',
          pendiente: '#d97706',
          avalada: '#2563eb',
          aprobada: '#059669',
          compras: '#7c3aed',
          recibida: '#047857',
          rechazada: '#dc2626',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};
export default config;
