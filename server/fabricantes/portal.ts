// Las cuentas del portal del fabricante (/fabricante): quién puede entrar,
// cómo se arman sus métricas y cuánto cuesta su pauta. Puro, sin base de
// datos, para probarlo; las rutas están en route.ts.

import { usdCentsToCopCents, USD_COP_RATE } from '../catalog';
import { normalizar, type FabricanteFila } from './match';

/** El plan con que queda el pago en `payments`. */
export const PLAN_PAUTA = 'pauta_fabricante';
export const PLAN_PAUTA_LABEL = 'Pauta de fabricante en Easycomex';

/** Por cuántos meses se puede pagar de una vez. */
export const MESES_PAUTA = [1, 3, 6, 12] as const;

/**
 * Si quien entra es el fabricante: su correo, confirmado, es el de acceso
 * (o el de contacto, si no se puso uno de acceso). Sin confirmar no vale:
 * cualquiera podría registrarse con el correo de otro.
 */
export function esSuyo(
  f: Pick<FabricanteFila, 'contacto_email'> & { acceso_email?: string | null },
  user: { email?: string | null; email_confirmed_at?: string | null } | null | undefined
): boolean {
  if (!user?.email || !user.email_confirmed_at) return false;
  const correo = (f.acceso_email || f.contacto_email || '').trim().toLowerCase();
  return correo !== '' && correo === user.email.trim().toLowerCase();
}

/** La fecha de hoy en Colombia: la pauta vence al final del día de allá. */
export const hoyColombia = (ahora = new Date()) => ahora.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

/** El día (AAAA-MM-DD) de una fecha en Colombia. */
export const diaColombia = (fecha: Date | string) =>
  new Date(fecha).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

export interface Evento {
  tipo: string;
  lugar?: string | null;
  contexto?: string | null;
  created_at: string;
}

/** Vistas y contactos por día, los últimos `dias` días hasta `hoy` incluido. */
export function serieDiaria(eventos: Evento[], hoy: string, dias = 30): Array<{ dia: string; vistas: number; contactos: number }> {
  const [y, m, d] = hoy.split('-').map(Number);
  const serie: Array<{ dia: string; vistas: number; contactos: number }> = [];
  const indice = new Map<string, number>();
  for (let i = dias - 1; i >= 0; i--) {
    const dia = new Date(Date.UTC(y, m - 1, d - i)).toISOString().slice(0, 10);
    indice.set(dia, serie.length);
    serie.push({ dia, vistas: 0, contactos: 0 });
  }
  for (const e of eventos) {
    const i = indice.get(diaColombia(e.created_at));
    if (i === undefined) continue;
    if (e.tipo === 'impresion') serie[i].vistas++;
    else if (e.tipo === 'contacto') serie[i].contactos++;
  }
  return serie;
}

/** Lo que más buscaba la gente cuando lo vio, agrupando mayúsculas y tildes. */
export function topBusquedas(eventos: Evento[], n = 8): Array<{ texto: string; veces: number }> {
  const cuenta = new Map<string, { texto: string; veces: number }>();
  for (const e of eventos) {
    const texto = (e.contexto ?? '').trim();
    if (!texto) continue;
    const clave = normalizar(texto);
    if (!clave) continue;
    const c = cuenta.get(clave);
    if (c) c.veces++;
    else cuenta.set(clave, { texto: texto.slice(0, 80), veces: 1 });
  }
  return Array.from(cuenta.values())
    .sort((a, b) => b.veces - a.veces || a.texto.localeCompare(b.texto))
    .slice(0, n);
}

/** Dónde lo vieron: en el asistente, en la calculadora, en el directorio. */
export function porLugar(eventos: Evento[]): Record<'chat' | 'roi' | 'directorio' | 'etiqueta', number> {
  const r = { chat: 0, roi: 0, directorio: 0, etiqueta: 0 };
  for (const e of eventos) {
    if (e.tipo !== 'impresion') continue;
    const l = e.lugar as keyof typeof r;
    if (l in r) r[l]++;
  }
  return r;
}

/**
 * Cuánto se cobra por `meses` de pauta: el precio mensual que le fijó el
 * equipo, en dólares, convertido a pesos como el resto del catálogo
 * (Wompi liquida en pesos). Null si no tiene precio: no se cobra en línea.
 */
export function precioPauta(usdMensual: number | null, meses: number, rate = USD_COP_RATE()) {
  if (!usdMensual || usdMensual <= 0 || !MESES_PAUTA.includes(meses as (typeof MESES_PAUTA)[number])) return null;
  const usdCents = Math.round(usdMensual * 100) * meses;
  const amountInCents = usdCentsToCopCents(usdCents, rate);
  if (amountInCents <= 0) return null;
  return { usdCents, amountInCents, currency: 'COP' as const };
}
