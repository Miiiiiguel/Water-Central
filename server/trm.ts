import { USD_COP_RATE } from './catalog';

// La TRM del día: la tasa representativa del mercado que certifica la
// Superintendencia Financiera, tal como la publica el portal de datos
// abiertos del gobierno (datos.gov.co, conjunto 32sa-8pi3). Sin llave.
//
// La usa la calculadora de fletes para mostrar una cotización en la otra
// moneda (pesos ↔ dólares). Se guarda 6 horas; si el portal no responde,
// se usa la tasa configurada (USD_COP_RATE) y la pantalla lo dice: nunca
// un número inventado como si fuera la TRM.

const URL_TRM = 'https://www.datos.gov.co/resource/32sa-8pi3.json?$order=vigenciadesde%20DESC&$limit=1';
const GUARDAR_MS = 6 * 60 * 60 * 1000;
const ESPERA_MS = 8_000;

export interface Trm {
  /** Pesos por dólar. */
  valor: number;
  /** Día en que rige (AAAA-MM-DD); null si es la tasa configurada. */
  fecha: string | null;
  /** true: la TRM oficial; false: la tasa configurada, porque la oficial no respondió. */
  oficial: boolean;
}

/** Lee la respuesta del portal: [{ valor: "3269.88", vigenciadesde: "2026-11-10T00:00:00.000", … }]. */
export function leerTrm(cuerpo: unknown): Trm | null {
  const fila = Array.isArray(cuerpo) ? (cuerpo[0] as { valor?: unknown; vigenciadesde?: unknown } | undefined) : undefined;
  const valor = Number(fila?.valor);
  // Un dólar entre 1.000 y 20.000 pesos: fuera de eso, la respuesta está mal.
  if (!Number.isFinite(valor) || valor < 1000 || valor > 20000) return null;
  const fecha = typeof fila?.vigenciadesde === 'string' ? fila.vigenciadesde.slice(0, 10) : null;
  return { valor, fecha, oficial: true };
}

let guardada: { trm: Trm; vence: number } | null = null;

/** Sólo para las pruebas. */
export function olvidarTrm(): void {
  guardada = null;
}

export async function trmVigente(hacer: typeof fetch = fetch, ahora = Date.now()): Promise<Trm> {
  if (guardada && guardada.vence > ahora) return guardada.trm;
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), ESPERA_MS);
  try {
    const res = await hacer(URL_TRM, { headers: { accept: 'application/json' }, signal: control.signal });
    const trm = res.ok ? leerTrm(await res.json().catch(() => null)) : null;
    if (trm) {
      guardada = { trm, vence: ahora + GUARDAR_MS };
      return trm;
    }
  } catch {
    // Sin respuesta: abajo, la configurada.
  } finally {
    clearTimeout(reloj);
  }
  // La configurada no se guarda: en el próximo pedido se vuelve a intentar la oficial.
  return { valor: USD_COP_RATE(), fecha: null, oficial: false };
}
