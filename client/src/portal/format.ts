// Formatos del portal: un solo lugar, para que todo se lea igual.

const usdFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usdEntero = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const copFmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const numFmt = new Intl.NumberFormat('es-CO');

export const usd = (n: number | string | null | undefined) => usdFmt.format(Number(n ?? 0));
/** USD sin centavos para cifras grandes de gráficas y tarjetas. */
export const usdCorto = (n: number | string | null | undefined) => usdEntero.format(Number(n ?? 0));
export const cop = (n: number | string | null | undefined) => copFmt.format(Number(n ?? 0));
export const num = (n: number | string | null | undefined) => numFmt.format(Number(n ?? 0));

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** "2026-10-30" -> "30 oct" */
export function diaCorto(iso: string): string {
  const [, m, d] = iso.slice(0, 10).split('-');
  return `${Number(d)} ${MESES[Number(m) - 1] ?? ''}`;
}
/** "2026-05" -> "may" */
export const mesCorto = (ym: string) => MESES[Number(ym.slice(5, 7)) - 1] ?? ym;

export const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
export const fechaHora = (iso: string) => new Date(iso).toLocaleString('es-CO', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

/** "hace 5 min", "hace 3 h", "ayer", "hace 4 d", o la fecha si pasó un mes. */
export function hace(iso: string, ahora = Date.now()): string {
  const s = Math.max(0, Math.floor((ahora - new Date(iso).getTime()) / 1000));
  if (s < 45) return 'justo ahora';
  const m = Math.floor(s / 60);
  if (m < 60) return `hace ${Math.max(1, m)} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'ayer';
  if (d < 30) return `hace ${d} d`;
  return fecha(iso);
}

export function iniciales(nombre: string | null | undefined, correo?: string | null): string {
  const base = (nombre || correo || '?').trim();
  const partes = base.split(/\s+/).filter(Boolean);
  return ((partes[0]?.[0] ?? '?') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase();
}

/** Transportista probable según el formato de la guía (ayuda al escribirla). */
export function transportista(guia: string): { nombre: string; color: string } | null {
  const g = guia.trim().toUpperCase().replace(/\s+/g, '');
  if (/^1Z[0-9A-Z]{16}$/.test(g)) return { nombre: 'UPS', color: '#7A4A12' };
  if (/^(94|93|92|95)\d{18,22}$/.test(g) || /^[A-Z]{2}\d{9}US$/.test(g)) return { nombre: 'USPS', color: '#1D4E9E' };
  if (/^TBA\d{9,}$/.test(g)) return { nombre: 'Amazon Logistics', color: '#C26E00' };
  if (/^(\d{12}|\d{15}|\d{20})$/.test(g)) return { nombre: 'Courier', color: '#5A2D91' };
  if (/^\d{10}$/.test(g)) return { nombre: 'DHL Express', color: '#B38600' };
  return null;
}

/** Texto de CSV -> filas (comillas, comas y saltos de línea dentro de campos entre comillas). */
export function leerCSV(texto: string): string[][] {
  const limpio = texto.replace(/^﻿/, '');
  const sep = (limpio.split('\n')[0].match(/;/g)?.length ?? 0) > (limpio.split('\n')[0].match(/,/g)?.length ?? 0) ? ';' : ',';
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = '';
  let comillas = false;
  for (let i = 0; i < limpio.length; i++) {
    const c = limpio[i];
    if (comillas) {
      if (c === '"' && limpio[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') comillas = false;
      else campo += c;
    } else if (c === '"') comillas = true;
    else if (c === sep) { fila.push(campo.trim()); campo = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && limpio[i + 1] === '\n') i++;
      fila.push(campo.trim()); campo = '';
      if (fila.some((x) => x !== '')) filas.push(fila);
      fila = [];
    } else campo += c;
  }
  fila.push(campo.trim());
  if (fila.some((x) => x !== '')) filas.push(fila);
  return filas;
}

/** Filas de CSV con encabezado -> objetos con las columnas en minúscula y sin tildes. */
export function csvAObjetos(texto: string): Record<string, string>[] {
  const [cab, ...resto] = leerCSV(texto);
  if (!cab) return [];
  const claves = cab.map((c) => c.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''));
  return resto.map((f) => Object.fromEntries(claves.map((k, i) => [k, f[i] ?? ''])));
}
