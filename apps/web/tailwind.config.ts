import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          900: '#0d2540',
          800: '#14304f',
          700: '#1a3a5c',
          600: '#234a73',
          500: '#2f5d8a',
          100: '#e8eef5',
          50: '#f4f7fb',
        },
        gold: {
          700: '#8b6914',
          600: '#b08526',
          500: '#c9a64a',
          400: '#dab771',
          100: '#fdf8ec',
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
