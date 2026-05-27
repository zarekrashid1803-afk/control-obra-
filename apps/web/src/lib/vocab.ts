'use client';
import { useQuery } from '@tanstack/react-query';
import { tenant } from './api';

/**
 * Vocabulario adaptable por sector. La app deja de asumir "construcción
 * civil": un cliente eléctrico ve "Subestación" donde uno civil ve
 * "Frente de obra", etc.
 *
 * Las claves son los conceptos genéricos; los valores, cómo se nombran
 * en cada sector. Si un sector no override una clave, usa el default.
 */
export type VocabKey =
  | 'frente'        // singular corto
  | 'frentes'       // plural corto
  | 'frenteDeObra'  // "Frente de obra" completo
  | 'puntoDeObra'   // "Punto de obra"
  | 'obra';         // "obra" como sustantivo

const DEFAULT: Record<VocabKey, string> = {
  frente: 'Frente',
  frentes: 'Frentes',
  frenteDeObra: 'Frente de obra',
  puntoDeObra: 'Punto de obra',
  obra: 'Obra',
};

const OVERRIDES: Record<string, Partial<Record<VocabKey, string>>> = {
  civil: {}, // usa los defaults
  mecanica: {
    frenteDeObra: 'Frente de trabajo',
    puntoDeObra: 'Punto de trabajo',
    obra: 'Trabajo',
  },
  metalurgia: {
    frente: 'Área',
    frentes: 'Áreas',
    frenteDeObra: 'Área de planta',
    puntoDeObra: 'Área de planta',
    obra: 'Planta',
  },
  electrica: {
    frenteDeObra: 'Frente eléctrico',
    puntoDeObra: 'Punto eléctrico',
    obra: 'Obra eléctrica',
  },
  electromecanica: {
    frenteDeObra: 'Frente electromecánico',
    puntoDeObra: 'Punto electromecánico',
  },
  instrumentacion: {
    frente: 'Área',
    frentes: 'Áreas',
    frenteDeObra: 'Área de instrumentación',
    puntoDeObra: 'Punto de instrumentación',
    obra: 'Instalación',
  },
  otro: {},
};

export function getVocab(sectorId: string | null | undefined): Record<VocabKey, string> {
  return { ...DEFAULT, ...(sectorId ? OVERRIDES[sectorId] || {} : {}) };
}

/**
 * Hook que devuelve el vocabulario del sector del tenant actual.
 * Cachea tenant.me() para no repetir la llamada por toda la app.
 */
export function useVocab(): Record<VocabKey, string> {
  const { data } = useQuery({
    queryKey: ['tenant-me'],
    queryFn: () => tenant.me(),
    staleTime: 1000 * 60 * 30, // 30 min
  });
  return getVocab(data?.sectorId);
}
