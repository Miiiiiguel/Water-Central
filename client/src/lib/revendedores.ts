import { getSupabase } from './supabase';

// El lado del navegador del programa de revendedores: entrar con el
// número de serie, leer el portal y, para las cuentas maestras,
// administrar. Todo pasa por /api/revendedores; las tablas no se leen
// desde acá (no tienen políticas para el navegador).

export interface Movimiento {
  id: string;
  tipo: 'comision' | 'pago';
  monto_usd: number;
  cliente: string | null;
  nota: string | null;
  fecha: string;
  created_at: string;
}

export interface Billetera {
  saldo: number;
  comisiones: number;
  pagado: number;
  clientes: number;
}

export interface Portal {
  revendedor: { nombre: string; empresa: string | null; activo: boolean; desde: string };
  billetera: Billetera;
  movimientos: Movimiento[];
  tokens: number;
  referido: { codigo: string | null; clientes: number };
}

export interface RevendedorAdmin {
  id: string;
  nombre: string;
  empresa: string | null;
  contacto: string | null;
  serial_pista: string;
  activo: boolean;
  tokens_regalados: number;
  tokens: number;
  created_at: string;
  billetera: Billetera;
  movimientos: Movimiento[];
}

type Resultado<T> = { ok: true; data: T } | { ok: false; status: number; message: string };

async function pedir<T>(ruta: string, token: string | null, init: RequestInit = {}): Promise<Resultado<T>> {
  try {
    const res = await fetch(`/api/revendedores${ruta}`, {
      ...init,
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, status: res.status, message: (data as { message?: string }).message || 'No se pudo completar. Intenta de nuevo.' };
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, status: 0, message: 'Sin conexión. Intenta de nuevo.' };
  }
}

/** Valida el serial en el servidor y deja abierta la sesión en este navegador. */
export async function entrarConSerial(serial: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const r = await pedir<{ session: { access_token: string; refresh_token: string } }>('/entrar', null, {
    method: 'POST',
    body: JSON.stringify({ serial }),
  });
  if (!r.ok) return { ok: false, message: r.message };
  const { error } = await (await getSupabase()).auth.setSession(r.data.session);
  if (error) return { ok: false, message: 'No pudimos abrir tu sesión en este navegador. Intenta de nuevo.' };
  return { ok: true };
}

export const leerAcceso = (token: string | null) => pedir<{ maestra: boolean; revendedor: boolean }>('/acceso', token);
export const leerPortal = (token: string | null) => pedir<Portal>('/yo', token);

export const listarRevendedores = (token: string | null) => pedir<{ revendedores: RevendedorAdmin[] }>('/admin', token);

export const crearRevendedor = (token: string | null, datos: { nombre: string; empresa: string; contacto: string; tokens: number }) =>
  pedir<{ id: string; serial: string }>('/admin', token, { method: 'POST', body: JSON.stringify(datos) });

export const cargarMovimiento = (
  token: string | null,
  id: string,
  datos: { tipo: 'comision' | 'pago'; monto: number; cliente: string; nota: string; fecha?: string }
) => pedir<{ ok: true }>(`/admin/${id}/movimientos`, token, { method: 'POST', body: JSON.stringify(datos) });

export const borrarMovimiento = (token: string | null, id: string, mov: string) =>
  pedir<{ ok: true }>(`/admin/${id}/movimientos/${mov}`, token, { method: 'DELETE' });

export const darTokens = (token: string | null, id: string, cantidad: number) =>
  pedir<{ ok: true }>(`/admin/${id}/tokens`, token, { method: 'POST', body: JSON.stringify({ cantidad }) });

export const nuevoSerial = (token: string | null, id: string) => pedir<{ serial: string }>(`/admin/${id}/serial`, token, { method: 'POST' });

export const cambiarEstado = (token: string | null, id: string, activo: boolean) =>
  pedir<{ ok: true }>(`/admin/${id}/estado`, token, { method: 'POST', body: JSON.stringify({ activo }) });

export const usd = (n: number) => `USD ${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** El enlace de un plan con el código del revendedor, antes del #ancla. */
export function enlaceReferido(origen: string, ruta: string, codigo: string | null): string {
  const [camino, ancla] = ruta.split('#');
  if (!codigo) return `${origen}${ruta}`;
  const sep = camino.includes('?') ? '&' : '?';
  return `${origen}${camino}${sep}ref=${encodeURIComponent(codigo)}${ancla !== undefined ? `#${ancla}` : ''}`;
}

export interface ItemPortafolio {
  plan: string;
  grupo: 'servicios' | 'tokens';
  nombre: { es: string; en: string };
  descripcion: { es: string; en: string };
  /** Dónde lo compra el cliente: el enlace que comparte el revendedor. */
  ruta: string;
  /** Precio a mostrar si el catálogo no contesta. */
  respaldo: string;
}

// Lo que un revendedor ofrece. Los precios de verdad los dice el
// catálogo del servidor (/api/checkout/catalog); acá van el texto de
// venta y adónde lleva el enlace.
export const PORTAFOLIO: ItemPortafolio[] = [
  {
    plan: 'diagnostico_madurez',
    grupo: 'servicios',
    nombre: { es: 'Diagnóstico de madurez exportadora', en: 'Export maturity diagnosis' },
    descripcion: {
      es: '17 preguntas en 3 minutos, gratis. El plan de acción con qué hacer en cada brecha es pago.',
      en: '17 questions in 3 minutes, free. The action plan for every gap is paid.',
    },
    ruta: '/diagnostico',
    respaldo: 'USD 9.99',
  },
  {
    plan: 'analisis_mercado',
    grupo: 'servicios',
    nombre: { es: 'Análisis de mercado y competencia', en: 'Market & competitor analysis' },
    descripcion: {
      es: 'La oportunidad real en Amazon y TikTok Shop, mercado por mercado, con 2 horas de asesoría 1 a 1.',
      en: 'The real opportunity on Amazon and TikTok Shop, market by market, with 2 hours of 1-on-1 advisory.',
    },
    ruta: '/#planes',
    respaldo: 'USD 499',
  },
  {
    plan: 'acompanamiento',
    grupo: 'servicios',
    nombre: { es: 'Plan de crecimiento a medida', en: 'Custom growth plan' },
    descripcion: {
      es: 'Cuánto puede facturar y en qué países, logística, Prep Center y canales. Se cotiza con el equipo.',
      en: 'How much they can sell and where, logistics, Prep Center and channels. Quoted with the team.',
    },
    ruta: '/#contacto',
    respaldo: 'A medida',
  },
  {
    plan: 'reporte_detalle',
    grupo: 'servicios',
    nombre: { es: 'Desglose de costos mes a mes', en: 'Month-by-month cost breakdown' },
    descripcion: {
      es: 'De la calculadora ROI: el costo por unidad y la utilidad de cada mes del primer año.',
      en: 'From the ROI calculator: unit cost and profit for every month of year one.',
    },
    ruta: '/roi',
    respaldo: 'USD 39.90',
  },
  {
    plan: 'reporte_pronostico',
    grupo: 'servicios',
    nombre: { es: 'Pronóstico completo a 2 años', en: 'Full 2-year forecast' },
    descripcion: {
      es: 'De la calculadora ROI: los dos escenarios a dos años, inversión y retorno.',
      en: 'From the ROI calculator: both scenarios over two years, investment and return.',
    },
    ruta: '/roi',
    respaldo: 'USD 99.90',
  },
  {
    plan: 'tokens_10',
    grupo: 'tokens',
    nombre: { es: '10 tokens · Mini', en: '10 tokens · Mini' },
    descripcion: { es: 'Consultas de mercado y lecturas de etiqueta. No vencen.', en: 'Market lookups and label reads. Never expire.' },
    ruta: '/tokens',
    respaldo: 'USD 4.99',
  },
  {
    plan: 'tokens_25',
    grupo: 'tokens',
    nombre: { es: '25 tokens · Starter', en: '25 tokens · Starter' },
    descripcion: { es: 'Consultas de mercado y lecturas de etiqueta. No vencen.', en: 'Market lookups and label reads. Never expire.' },
    ruta: '/tokens',
    respaldo: 'USD 9.99',
  },
  {
    plan: 'creditos_marco_polo',
    grupo: 'tokens',
    nombre: { es: '50 tokens · Básico', en: '50 tokens · Basic' },
    descripcion: { es: 'Consultas de mercado y lecturas de etiqueta. No vencen.', en: 'Market lookups and label reads. Never expire.' },
    ruta: '/tokens',
    respaldo: 'USD 19',
  },
  {
    plan: 'tokens_200',
    grupo: 'tokens',
    nombre: { es: 'Plan de 1 mes · 200 tokens', en: '1-month plan · 200 tokens' },
    descripcion: { es: '200 tokens para usar en el mes.', en: '200 tokens to use within the month.' },
    ruta: '/tokens',
    respaldo: 'USD 49',
  },
  {
    plan: 'tokens_300',
    grupo: 'tokens',
    nombre: { es: 'Plan de 6 meses · 50 por mes', en: '6-month plan · 50 a month' },
    descripcion: { es: '300 tokens en total, 50 cada mes.', en: '300 tokens in total, 50 every month.' },
    ruta: '/tokens',
    respaldo: 'USD 69',
  },
  {
    plan: 'tokens_600',
    grupo: 'tokens',
    nombre: { es: 'Plan de 6 meses · 100 por mes', en: '6-month plan · 100 a month' },
    descripcion: { es: '600 tokens en total, 100 cada mes.', en: '600 tokens in total, 100 every month.' },
    ruta: '/tokens',
    respaldo: 'USD 119',
  },
];
