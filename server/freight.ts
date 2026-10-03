import express from 'express';
import { z } from 'zod';
import { makeLimiter, JSON_BODY_LIMIT } from './security';
import { getAnonClient, getUserFromRequest } from './supabaseAdmin';
import { logSecurityEvent } from './log';
import data from './freightData.json';

// Calculadora de fletes, con la tarifa pública del servicio express
// internacional desde y hacia Colombia (precios de lista 2026, paquetes),
// menos el descuento de cada tipo de cliente. Dos direcciones, con las
// mismas zonas y las mismas reglas de peso: exportar (Colombia → el país)
// e importar (el país → Colombia), cada una con su propia tabla.
//
// Todo el cálculo ocurre acá, en el servidor, a propósito: los descuentos
// por tipo de cliente son información comercial. El navegador recibe la
// lista de destinos (sin zona) y, por cada cotización, el resultado —
// nunca la tabla.
//
// Cómo se cobra, tal como lo publica la tarifa:
//   país → zona (1 a 7; EE. UU. son dos: Miami zona 2, resto zona 3),
//          el país de destino al exportar o el de origen al importar
//   peso de cada pieza = máx(real, L×A×H / 5000), redondeado hacia arriba
//                        al medio kilo
//   peso facturable    = suma de las piezas; hasta 30 kg va en medios
//                        kilos, de ahí en adelante en kilos enteros
//   precio de lista    = el de la tabla para ese peso; entre los pesos que
//                        la tabla no trae (10,5 kg, 31 kg, 85 kg…) se suma
//                        el cargo "por cada medio kilo / kilo adicional"
//                        del tramo, desde el último peso publicado
//   neto               = lista − descuento del tipo de cliente
//   combustible        = neto × promedio del recargo por combustible
//                        publicado en los últimos 12 meses (ponderado
//                        por días), si hay historial cargado
//   final              = neto + combustible
// Más de 3 000 kg no se acepta en la red: se cotiza aparte.

export interface ZoneRow {
  id: string;
  country_es: string;
  country_en: string;
  country_code: string;
  zone: string;
}

export interface Package {
  weight: number;
  length?: number;
  width?: number;
  height?: number;
  quantity?: number;
}

/** Cargo por cada `paso` kg adicional, para pesos en (desde, hasta]. */
export interface Tramo {
  desde: number;
  hasta: number;
  paso: number;
  precio: number;
}

export interface Tarifa {
  /** [peso kg, precio de lista USD], como la publica la tabla. */
  table: [number, number][];
  extra: Tramo[];
}

interface Bundle {
  settings: {
    volumetric_divisor: number;
    min_billable_weight: number;
    max_billable_weight: number;
    currency: string;
    currency_symbol: string;
  };
  client_types: { type: string; discount_percent: number }[];
  zones: ZoneRow[];
  rates: Record<string, Tarifa>;
  rates_import: Record<string, Tarifa>;
  fuel_surcharge?: { window_months: number; history: PeriodoCombustible[] };
}

/** Un período publicado del recargo por combustible (fechas inclusive). */
export interface PeriodoCombustible {
  from: string;
  to: string;
  export_pct: number;
}

const bundle = data as unknown as Bundle;

const SETTINGS = bundle.settings;

/** Tipo de cliente (minúsculas) → % de descuento. */
export const DISCOUNTS: Record<string, number> = Object.fromEntries(
  bundle.client_types.filter((c) => c.type && c.type.trim()).map((c) => [c.type.trim().toLowerCase(), Number(c.discount_percent) || 0])
);

export const CLIENT_TYPES = bundle.client_types.map((c) => c.type.trim());

export const ZONES: ZoneRow[] = bundle.zones;

export type Direccion = 'exportar' | 'importar';

const ordenar = (rates: Record<string, Tarifa>): Record<string, Tarifa> =>
  Object.fromEntries(
    Object.entries(rates).map(([zone, t]) => [
      zone,
      { table: [...t.table].sort((a, b) => a[0] - b[0]), extra: [...t.extra].sort((a, b) => a.desde - b.desde) },
    ])
  );

/** Tarifa de exportación por zona, con la tabla ordenada por peso. */
export const RATES: Record<string, Tarifa> = ordenar(bundle.rates);
/** Tarifa de importación por zona. */
export const RATES_IMPORT: Record<string, Tarifa> = ordenar(bundle.rates_import);

const tarifasDe = (direccion: Direccion) => (direccion === 'importar' ? RATES_IMPORT : RATES);

export const MAX_KG = SETTINGS.max_billable_weight;

export const FUEL_HISTORY: PeriodoCombustible[] = bundle.fuel_surcharge?.history ?? [];
const FUEL_WINDOW_MONTHS = bundle.fuel_surcharge?.window_months ?? 12;

export class CalculationError extends Error {}

export function isValidType(type: string): boolean {
  return Object.prototype.hasOwnProperty.call(DISCOUNTS, type.trim().toLowerCase());
}

export function discountFor(type: string): number {
  return DISCOUNTS[type.trim().toLowerCase()] ?? 0;
}

/**
 * Zona desde el id del destino, el código ISO o el nombre exacto — en ese
 * orden. El id es el único determinista: "US" existe dos veces
 * (196 = Estados Unidos excepto Miami → 3, 197 = Miami → 2).
 */
export function resolveZone(destination: string): string | null {
  const dest = String(destination).trim();
  if (!dest) return null;
  const byId = ZONES.find((r) => r.id === dest);
  if (byId) return byId.zone || null;
  const needle = dest.toLowerCase();
  const byCode = ZONES.find((r) => r.country_code.toLowerCase() === needle);
  if (byCode) return byCode.zone || null;
  const byName = ZONES.find((r) => r.country_es.toLowerCase() === needle || r.country_en.toLowerCase() === needle);
  return byName ? byName.zone || null : null;
}

export function countryLabel(destination: string, lang: 'es' | 'en' = 'es'): string {
  const row = ZONES.find((r) => r.id === String(destination).trim());
  if (!row) return destination;
  return (lang === 'en' ? row.country_en : row.country_es) || row.country_es || row.country_en;
}

/** Hacia arriba al múltiplo de `paso`, sin que 2.0000001 se vuelva 2.5. */
const haciaArriba = (kg: number, paso: number) => Math.ceil(kg / paso - 1e-9) * paso;

/** Medio kilo hasta 30 kg, kilo entero de ahí en adelante. */
export function redondearFacturable(kg: number): number {
  const w = Math.max(kg, SETTINGS.min_billable_weight);
  return w <= 30 ? haciaArriba(w, 0.5) : haciaArriba(w, 1);
}

export function aggregateWeights(packages: Package[]) {
  const divisor = Math.max(1, SETTINGS.volumetric_divisor);
  let real = 0;
  let volumetric = 0;
  let piezas = 0;
  for (const p of packages) {
    const qty = Math.max(1, Math.trunc(Number(p.quantity ?? 1)) || 1);
    const w = Number(p.weight) || 0;
    const vol = ((Number(p.length) || 0) * (Number(p.width) || 0) * (Number(p.height) || 0)) / divisor;
    real += w * qty;
    volumetric += vol * qty;
    piezas += haciaArriba(Math.max(w, vol), 0.5) * qty;
  }
  return { real, volumetric, billable: redondearFacturable(piezas) };
}

/** Precio de lista de una tarifa para un peso ya facturable. */
export function precioEnTabla(tarifa: Tarifa, kg: number): number {
  const eps = 1e-9;
  const publicado = tarifa.table.filter(([w]) => w <= kg + eps);
  let [actual, precio] = publicado.length ? publicado[publicado.length - 1] : tarifa.table[0];
  while (actual < kg - eps) {
    const tramo = tarifa.extra.find((t) => actual >= t.desde - eps && actual + t.paso <= t.hasta + eps);
    if (!tramo) throw new CalculationError('No se encontró una tarifa para el peso facturable.');
    actual += tramo.paso;
    precio += tramo.precio;
  }
  return round(precio, 2);
}

/** Precio de lista de la zona para un peso ya facturable. */
export function listPrice(zone: string, kg: number, direccion: Direccion = 'exportar'): number {
  const tarifa = tarifasDe(direccion)[zone];
  if (!tarifa) throw new CalculationError('No hay tarifas disponibles para el destino seleccionado.');
  if (kg > MAX_KG) throw new CalculationError(`Más de ${MAX_KG.toLocaleString('es-CO')} kg se cotiza aparte: escríbenos.`);
  return precioEnTabla(tarifa, kg);
}

const DIA = 86_400_000;
const fecha = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

export interface PromedioCombustible {
  pct: number;
  desde: string;
  hasta: string;
  /** Días de la ventana con un porcentaje publicado. */
  dias: number;
}

/**
 * Promedio del recargo publicado en los `meses` que terminan `hoy`,
 * ponderado por los días que rigió cada porcentaje: una semana pesa una
 * semana y un mes pesa un mes. Sin historial en la ventana, null — y la
 * cotización sale sin recargo y lo dice.
 */
export function promedioCombustible(historial: PeriodoCombustible[], hoy: Date, meses = FUEL_WINDOW_MONTHS): PromedioCombustible | null {
  const fin = Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate());
  const inicioFecha = new Date(fin);
  inicioFecha.setUTCMonth(inicioFecha.getUTCMonth() - meses);
  const inicio = inicioFecha.getTime() + DIA; // ventana (inicio, fin], inclusive en días
  let suma = 0;
  let dias = 0;
  for (const p of historial) {
    const desde = Math.max(fecha(p.from), inicio);
    const hasta = Math.min(fecha(p.to), fin);
    if (!Number.isFinite(desde) || !Number.isFinite(hasta) || hasta < desde || !Number.isFinite(p.export_pct)) continue;
    const n = Math.round((hasta - desde) / DIA) + 1;
    suma += p.export_pct * n;
    dias += n;
  }
  if (!dias) return null;
  const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
  return { pct: round(suma / dias, 2), desde: iso(inicio), hasta: iso(fin), dias };
}

export function isValidPackage(p: Package): boolean {
  const w = Number(p.weight) || 0;
  return w > 0 || ((Number(p.length) || 0) > 0 && (Number(p.width) || 0) > 0 && (Number(p.height) || 0) > 0);
}

const round = (n: number, d: number) => Math.round((n + Number.EPSILON) * 10 ** d) / 10 ** d;

export interface Quote {
  direction: Direccion;
  customer_type: string;
  destination: string;
  destination_id: string;
  zone: string;
  weights: { real: number; volumetric: number; billable: number };
  pricing: {
    list_price: number;
    discount_percent: number;
    discount_amount: number;
    /** Promedio de 12 meses aplicado; null si no hay historial cargado. */
    fuel_percent: number | null;
    fuel_amount: number;
    final_price: number;
  };
  fuel: { desde: string; hasta: string } | null;
  currency: string;
  currency_symbol: string;
}

export function quote(
  input: { customerType: string; destination: string; packages: Package[]; lang?: 'es' | 'en'; direction?: Direccion },
  hoy: Date = new Date(),
  historial: PeriodoCombustible[] = FUEL_HISTORY
): Quote {
  if (!isValidType(input.customerType)) throw new CalculationError('El tipo de cliente no es válido.');
  const valid = (input.packages || []).filter(isValidPackage);
  if (valid.length === 0) throw new CalculationError('Agrega al menos un paquete con peso o medidas válidas.');
  const direccion: Direccion = input.direction ?? 'exportar';
  const zone = resolveZone(input.destination);
  if (!zone || !tarifasDe(direccion)[zone]) {
    throw new CalculationError(direccion === 'importar' ? 'No hay tarifas disponibles para el origen seleccionado.' : 'No hay tarifas disponibles para el destino seleccionado.');
  }

  const weights = aggregateWeights(valid);
  const lista = listPrice(zone, weights.billable, direccion);
  const discountPercent = discountFor(input.customerType);
  const discountAmount = round(lista * (discountPercent / 100), 2);
  const neto = round(Math.max(0, lista - discountAmount), 2);
  const combustible = promedioCombustible(historial, hoy);
  const fuelAmount = combustible ? round(neto * (combustible.pct / 100), 2) : 0;

  return {
    direction: direccion,
    customer_type: input.customerType,
    destination: countryLabel(input.destination, input.lang),
    destination_id: String(input.destination).trim(),
    zone,
    weights: { real: round(weights.real, 3), volumetric: round(weights.volumetric, 3), billable: weights.billable },
    pricing: {
      list_price: lista,
      discount_percent: round(discountPercent, 2),
      discount_amount: discountAmount,
      fuel_percent: combustible ? combustible.pct : null,
      fuel_amount: fuelAmount,
      final_price: round(neto + fuelAmount, 2),
    },
    fuel: combustible ? { desde: combustible.desde, hasta: combustible.hasta } : null,
    currency: SETTINGS.currency,
    currency_symbol: SETTINGS.currency_symbol,
  };
}

// ---------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------

const freightLimiter = makeLimiter('freight', 60); // quotes are cheap but not free of abuse

const packageSchema = z.object({
  weight: z.number().min(0).max(100000).default(0),
  length: z.number().min(0).max(10000).default(0),
  width: z.number().min(0).max(10000).default(0),
  height: z.number().min(0).max(10000).default(0),
  quantity: z.number().int().min(1).max(10000).default(1),
});

const quoteSchema = z.object({
  customerType: z.string().trim().min(1).max(40),
  destination: z.string().trim().min(1).max(10),
  // Al importar, `destination` es el país de origen (el envío llega a Colombia).
  direction: z.enum(['exportar', 'importar']).default('exportar'),
  packages: z.array(packageSchema).min(1).max(20),
  email: z.string().trim().toLowerCase().email().max(160).optional(),
  lang: z.enum(['es', 'en']).default('es'),
  website: z.string().max(200).optional(), // honeypot
});

export const freightRouter = express.Router();

// Lo que el selector necesita y nada más: sin zona, sin tarifa.
const DESTINATIONS = ZONES.map((r) => ({ id: r.id, es: r.country_es, en: r.country_en, code: r.country_code })).sort((a, b) =>
  a.es.localeCompare(b.es, 'es')
);

freightRouter.get('/freight/destinations', (_req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.json({ destinations: DESTINATIONS, clientTypes: CLIENT_TYPES, currency: SETTINGS.currency });
});

freightRouter.post('/freight/quote', freightLimiter, express.json({ limit: JSON_BODY_LIMIT }), async (req, res) => {
  const parsed = quoteSchema.safeParse(req.body);
  if (!parsed.success) {
    logSecurityEvent('invalid_input', req, { form: 'freight_quote' });
    return res.status(400).json({ error: 'Datos inválidos.' });
  }
  if (parsed.data.website) {
    logSecurityEvent('honeypot_triggered', req, { form: 'freight_quote' });
    return res.status(400).json({ error: 'Datos inválidos.' });
  }

  let result: Quote;
  try {
    result = quote(parsed.data);
  } catch (err) {
    if (err instanceof CalculationError) return res.status(422).json({ error: err.message });
    throw err;
  }

  // Cada cotización es también un lead: queda en freight_quotes con el
  // precio cotizado, para que el equipo la vea en el panel. Si la base
  // no está configurada, la cotización igual se responde.
  const supabase = getAnonClient();
  if (supabase) {
    const user = await getUserFromRequest(req);
    const email = user?.email ?? parsed.data.email ?? null;
    if (email) {
      const fila = {
        user_id: user?.id ?? null,
        email,
        name: (user?.user_metadata?.full_name as string | undefined) ?? null,
        origin: result.direction === 'importar' ? result.destination : 'Colombia',
        destination: result.direction === 'importar' ? 'Colombia' : result.destination,
        weight_kg: result.weights.billable,
        client_type: result.customer_type,
        zone: result.zone,
        quote_usd: result.pricing.final_price,
      };
      let { error } = await supabase.from('freight_quotes').insert(fila);
      // Una base a la que todavía no se le corrió schema.sql no tiene
      // quote_usd: el lead se guarda igual, sin el precio, en vez de perderse.
      if (error && /quote_usd/.test(error.message)) {
        const { quote_usd: _sinColumna, ...sinPrecio } = fila;
        ({ error } = await supabase.from('freight_quotes').insert(sinPrecio));
      }
      if (error) console.error('freight quote insert failed:', error.message);
    }
  }

  return res.json(result);
});
