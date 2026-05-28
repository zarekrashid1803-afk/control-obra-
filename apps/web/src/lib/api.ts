/**
 * Cliente HTTP del API. Maneja JWT, refresh y errores estructurados.
 */

// URL relativa: aprovecha el rewrite de Next.js (/api/v1/* → backend localhost:3001)
// Así el frontend funciona idéntico desde laptop o desde un celular conectado al WiFi.
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '';
const API_PREFIX = '/api/v1';

export class ApiError extends Error {
  constructor(public status: number, public body: any) {
    super(typeof body === 'string' ? body : body?.message || `HTTP ${status}`);
  }
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('control_obra_token');
}

export function setToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) localStorage.setItem('control_obra_token', token);
  else localStorage.removeItem('control_obra_token');
}

export function setRefreshToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) localStorage.setItem('control_obra_refresh', token);
  else localStorage.removeItem('control_obra_refresh');
}

export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('control_obra_refresh');
}

export async function api<T = any>(
  path: string,
  init: RequestInit & { skipAuth?: boolean } = {},
): Promise<T> {
  const { skipAuth, headers, ...rest } = init;
  const token = skipAuth ? null : getToken();
  const url = `${API_BASE}${API_PREFIX}${path}`;

  const res = await fetch(url, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(headers || {}),
    },
  });

  let body: any = null;
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    body = await res.json();
  } else {
    body = await res.text();
  }

  if (!res.ok) {
    // Try refresh on 401
    if (res.status === 401 && !skipAuth && getRefreshToken()) {
      const ok = await tryRefresh();
      if (ok) return api(path, init);
    }
    // Trial vencido → redirect global a /trial-expired
    if (res.status === 402 && body?.error === 'TRIAL_EXPIRED' && typeof window !== 'undefined') {
      if (window.location.pathname !== '/trial-expired') {
        window.location.href = '/trial-expired';
      }
    }
    throw new ApiError(res.status, body);
  }

  return body as T;
}

async function tryRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_BASE}${API_PREFIX}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    setToken(data.accessToken);
    // El backend rota el refresh token en cada uso: persistir el nuevo, o el
    // siguiente refresh fallaría (el anterior queda revocado).
    if (data.refreshToken) setRefreshToken(data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

// ============================================================
// Endpoints tipados
// ============================================================

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    nombres: string;
    apellidos: string;
    iniciales: string;
    roles: string[];
    passwordChangeRequired?: boolean;
  };
}

export const auth = {
  login: (email: string, password: string, mfaCode?: string) =>
    api<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, ...(mfaCode ? { mfaCode } : {}) }),
      skipAuth: true,
    }),
  logout: () => api('/auth/logout', { method: 'POST' }),
  mfaStatus: () => api<{ mfaEnabled: boolean }>('/auth/mfa/status'),
  mfaSetup: () => api<{ secret: string; otpauthUrl: string; qrDataUrl: string }>('/auth/mfa/setup', { method: 'POST' }),
  mfaEnable: (code: string) => api<{ ok: boolean; mfaEnabled: boolean }>('/auth/mfa/enable', { method: 'POST', body: JSON.stringify({ code }) }),
  mfaDisable: (code: string) => api<{ ok: boolean; mfaEnabled: boolean }>('/auth/mfa/disable', { method: 'POST', body: JSON.stringify({ code }) }),
};

export interface SignupPayload {
  codigo: string;
  email: string;
  password: string;
  nombres: string;
  apellidos: string;
  nombreConstructora: string;
  sectorId?: string;
}

export interface Sector {
  id: string;
  nombre: string;
  descripcion?: string;
  iconEmoji: string;
}

export interface TenantInfo {
  id: number;
  nombre: string;
  nit?: string | null;
  sectorId: string | null;
  sector?: { id: string; nombre: string; iconEmoji: string } | null;
  trialEndsAt: string | null;
}

export const tenant = {
  me: () => api<TenantInfo>('/tenant/me'),
  update: (body: { nombre?: string; sectorId?: string | null }) =>
    api<TenantInfo>('/tenant/me', { method: 'PATCH', body: JSON.stringify(body) }),
};

export const promoCodes = {
  signup: (body: SignupPayload) =>
    api<AuthResponse & { tenant: { id: number; nombre: string; trialEndsAt: string; sectorId: string | null } }>(
      '/promo-codes/signup',
      { method: 'POST', body: JSON.stringify(body), skipAuth: true },
    ),
  sectores: () => api<Sector[]>('/promo-codes/sectores', { skipAuth: true }),
  status: () =>
    api<{ trialActive: boolean; trialEndsAt: string | null; horasRestantes: number; tenantNombre: string | null }>(
      '/promo-codes/status',
    ),
  list: () => api<any[]>('/promo-codes'),
  generar: (cantidad: number, notes?: string, sectorId?: string) =>
    api<{ generados: string[]; total: number }>('/promo-codes/generar', {
      method: 'POST',
      body: JSON.stringify({ cantidad, notes, sectorId }),
    }),
  extenderTrial: (tenantId: number, horasAdicionales: number) =>
    api<{ id: number; nombre: string; trialEndsAt: string }>('/promo-codes/extender-trial', {
      method: 'POST',
      body: JSON.stringify({ tenantId, horasAdicionales }),
    }),
};

export const usuarios = {
  me: () => api('/usuarios/me'),
  list: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return api<any>(`/usuarios${qs}`);
  },
  get: (id: string) => api(`/usuarios/${id}`),
  create: (body: any) => api('/usuarios', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: any) => api(`/usuarios/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  remove: (id: string) => api(`/usuarios/${id}`, { method: 'DELETE' }),
};

export const frentes = {
  list: () => api<any>('/frentes'),
  get: (id: string) => api(`/frentes/${id}`),
  create: (body: any) => api('/frentes', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: any) => api(`/frentes/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  remove: (id: string) => api(`/frentes/${id}`, { method: 'DELETE' }),
};

export const requisiciones = {
  list: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return api<any>(`/requisiciones${qs}`);
  },
  get: (id: string) => api(`/requisiciones/${id}`),
  create: (body: any) => api('/requisiciones', { method: 'POST', body: JSON.stringify(body) }),
  transicion: (id: string, accion: string, observacion?: string, motivoRechazo?: string) =>
    api(`/requisiciones/${id}/transicion`, {
      method: 'POST',
      body: JSON.stringify({ accion, observacion, motivoRechazo }),
    }),
};

export const materiales = {
  list: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return api<any>(`/materiales${qs}`);
  },
  get: (id: string) => api(`/materiales/${id}`),
  create: (body: any) => api('/materiales', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: any) => api(`/materiales/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  remove: (id: string) => api(`/materiales/${id}`, { method: 'DELETE' }),
};

export const bodega = {
  listEntradas: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return api<any>(`/bodega/entradas${qs}`);
  },
  crearEntrada: (body: any) => api('/bodega/entradas', { method: 'POST', body: JSON.stringify(body) }),
  crearSalida: (body: any) => api('/bodega/salidas', { method: 'POST', body: JSON.stringify(body) }),
};

export const ordenesCompra = {
  list: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return api<any>(`/ordenes-compra${qs}`);
  },
  get: (id: string) => api(`/ordenes-compra/${id}`),
  generar: (body: any) => api('/ordenes-compra', { method: 'POST', body: JSON.stringify(body) }),
  enviar: (id: string) => api(`/ordenes-compra/${id}/enviar`, { method: 'POST' }),
  anular: (id: string, motivo: string) =>
    api(`/ordenes-compra/${id}/anular`, { method: 'POST', body: JSON.stringify({ motivo }) }),
};

export const caja = {
  listMovimientos: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return api<any>(`/caja/movimientos${qs}`);
  },
  crearMovimiento: (body: any) => api('/caja/movimientos', { method: 'POST', body: JSON.stringify(body) }),
  getArqueo: (fecha: string) => api<any>(`/caja/arqueo/${fecha}`),
  cerrarArqueo: (body: any) => api('/caja/arqueo', { method: 'POST', body: JSON.stringify(body) }),
};

export const inventario = {
  existencias: (frenteId?: string) =>
    api(`/inventario/existencias${frenteId ? `?frenteId=${frenteId}` : ''}`),
  alertas: () => api('/inventario/alertas'),
};

export const documentosSoporte = {
  list: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return api<any>(`/documentos-soporte${qs}`);
  },
  get: (id: string) => api(`/documentos-soporte/${id}`),
  create: (body: any) => api('/documentos-soporte', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: any) => api(`/documentos-soporte/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  emitir: (id: string) => api(`/documentos-soporte/${id}/emitir`, { method: 'POST' }),
  anular: (id: string, motivo: string) => api(`/documentos-soporte/${id}/anular`, { method: 'POST', body: JSON.stringify({ motivo }) }),
};

export const proveedores = {
  list: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return api<any>(`/proveedores${qs}`);
  },
  get: (id: string) => api(`/proveedores/${id}`),
  create: (body: any) => api('/proveedores', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: any) => api(`/proveedores/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  remove: (id: string) => api(`/proveedores/${id}`, { method: 'DELETE' }),
};

export const auditoria = {
  list: (params?: Record<string, any>) => {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return api<any>(`/auditoria${qs}`);
  },
};

export const adjuntos = {
  // Signed URL temporal (1h) del adjunto. Autenticado + verificado por tenant
  // en el backend: solo devuelve enlace si el adjunto es de tu empresa.
  signedUrl: (id: string) => api<{ url: string; nombre: string; mimeType: string }>(`/adjuntos/${id}/url`),
};

/**
 * Descarga un archivo binario (Excel, PDF) del API y dispara el download.
 */
export async function downloadFile(path: string, filename: string): Promise<void> {
  const doFetch = async () => {
    const token = (typeof window !== 'undefined' && localStorage.getItem('control_obra_token')) || '';
    return fetch(`${API_BASE}${API_PREFIX}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  };
  let res = await doFetch();
  if (res.status === 401 && getRefreshToken()) {
    const ok = await tryRefresh();
    if (ok) res = await doFetch();
  }
  if (!res.ok) {
    let body: any = null;
    try { body = await res.json(); } catch { body = await res.text(); }
    throw new ApiError(res.status, body);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Liberar URL después de un breve delay para que el navegador termine la descarga
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function uploadAdjunto(file: File): Promise<{ id: string; urlS3: string; nombre: string; mimeType: string }> {
  const form = new FormData();
  form.append('file', file);

  const doUpload = async () => {
    const token = (typeof window !== 'undefined' && localStorage.getItem('control_obra_token')) || '';
    return fetch(`${API_BASE}${API_PREFIX}/adjuntos`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
  };

  let res = await doUpload();
  // Auto-refresh en 401 y reintentar una vez (igual que api())
  if (res.status === 401 && getRefreshToken()) {
    const ok = await tryRefresh();
    if (ok) res = await doUpload();
  }
  if (!res.ok) {
    let body: any = null;
    try { body = await res.json(); } catch { body = await res.text(); }
    throw new ApiError(res.status, body);
  }
  return res.json();
}

export const health = () => api('/health', { skipAuth: true });
