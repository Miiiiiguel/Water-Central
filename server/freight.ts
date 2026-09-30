import express from 'express';
import { z } from 'zod';
import { makeLimiter, JSON_BODY_LIMIT } from './security';
import { getAnonClient, getUserFromRequest } from './supabaseAdmin';
import { logSecurityEvent } from './log';
import data from './freightData.json';

// Calculadora de fletes — réplica exacta de EasyComex Calculator v2.2.4
// (Engine.php / TariffRepository.php / VolumetricCalculator.php), con los
// datos reales exportados de las CCT de JetEngine en freightData.json.
//
// Todo el cálculo ocurre acá, en el servidor, a propósito: la tabla de
// tarifas y los descuentos por tipo de cliente son información comercial.
// El navegador recibe la lista de destinos (sin zona) y, por cada
// cotización, el resultado — nunca la tabla.
//
// Pipeline (idéntico al plugin):
//   destino (_ID del zonificador) → zona
//   peso real        = Σ peso × cantidad
//   peso volumétrico = Σ (L×W×H / 5000) × cantidad
//   peso facturable  = max(real, volumétrico)                 (sum_max)
//   tarifa           = banda plana que contiene el peso, si no la banda
//                      por kilo, si no la banda más alta
//   base             = plana ? precio : precio × facturable
//   final            = base − base × descuento%
// Bandas [min, max): mínimo inclusivo, máximo exclusivo.

export interface Bracket {
  min: number;
  max: number;
  price: number;
  multiplier: boolean;
}

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

interface Bundle {
  settings: { volumetric_divisor: number; weight_aggregation: string; min_billable_weight: number; currency: string; currency_symbol: string };
  client_types: { type: string; discount_percent: number }[];
  zones: ZoneRow[];
  tariffs: Record<string, Bracket[]>;
}

const bundle = data as Bundle;

const SETTINGS = {
  volumetric_divisor: bundle.settings?.volumetric_divisor ?? 5000,
  weight_aggregation: bundle.settings?.weight_aggregation ?? 'sum_max',
  min_billable_weight: bundle.settings?.min_billable_weight ?? 0,
  currency: bundle.settings?.currency ?? 'COP',
  currency_symbol: bundle.settings?.currency_symbol ?? '$',
};

/** Tipo de cliente (minúsculas) → % de descuento. */
export const DISCOUNTS: Record<string, number> = Object.fromEntries(
  bundle.client_types.filter((c) => c.type && c.type.trim()).map((c) => [c.type.trim().toLowerCase(), Number(c.discount_percent) || 0])
);

export const CLIENT_TYPES = bundle.client_types.map((c) => c.type.trim());

export const ZONES: ZoneRow[] = bundle.zones;

/** Tarifas por zona, ordenadas por límite inferior. */
export const TARIFFS: Record<string, Bracket[]> = Object.fromEntries(
  Object.entries(bundle.tariffs).map(([zone, brackets]) => [
    zone.toUpperCase(),
    brackets
      .map((b) => ({ min: Number(b.min), max: Number(b.max), price: Number(b.price), multiplier: b.multiplier === true }))
      .sort((a, b) => a.min - b.min),
  ])
);

export class CalculationError extends Error {}

export function isValidType(type: string): boolean {
  return Object.prototype.hasOwnProperty.call(DISCOUNTS, type.trim().toLowerCase());
}

export function discountFor(type: string): number {
  return DISCOUNTS[type.trim().toLowerCase()] ?? 0;
}

/**
 * Zona desde el _ID del zonificador, el código ISO o el nombre exacto —
 * en ese orden, como ZoneRepository. El _ID es el único determinista:
 * "US" existe dos veces (196 = Estados Unidos excepto Miami → B,
 * 197 = Miami → I), igual que "BT".
 */
export function resolveZone(destination: string): string | null {
  const dest = String(destination).trim();
  if (!dest) return null;
  const byId = ZONES.find((r) => r.id === dest);
  if (byId) return byId.zone.toUpperCase() || null;
  const needle = dest.toLowerCase();
  const byCode = ZONES.find((r) => r.country_code.toLowerCase() === needle);
  if (byCode) return byCode.zone.toUpperCase() || null;
  const byName = ZONES.find((r) => r.country_es.toLowerCase() === needle || r.country_en.toLowerCase() === needle);
  return byName ? byName.zone.toUpperCase() || null : null;
}

export function countryLabel(destination: string, lang: 'es' | 'en' = 'es'): string {
  const row = ZONES.find((r) => r.id === String(destination).trim());
  if (!row) return destination;
  return (lang === 'en' ? row.country_en : row.country_es) || row.country_es || row.country_en;
}

export function aggregateWeights(packages: Package[]) {
  const divisor = Math.max(1, SETTINGS.volumetric_divisor);
  const perPiece = SETTINGS.weight_aggregation === 'per_piece_max';
  let real = 0;
  let volumetric = 0;
  let perPieceBillable = 0;
  for (const p of packages) {
    const qty = Math.max(1, Math.trunc(Number(p.quantity ?? 1)) || 1);
    const w = Number(p.weight) || 0;
    const L = Number(p.length) || 0;
    const W = Number(p.width) || 0;
    const H = Number(p.height) || 0;
    const vol = ((L * W * H) / divisor) * qty;
    real += w * qty;
    volumetric += vol;
    perPieceBillable += Math.max(w, vol / qty) * qty;
  }
  return { real, volumetric, billable: perPiece ? perPieceBillable : Math.max(real, volumetric) };
}

/** Igual que TariffRepository::findBracket. */
export function findBracket(zone: string, weight: number): Bracket | null {
  const brackets = TARIFFS[zone.toUpperCase()];
  if (!brackets) return null;
  const w = Math.max(0, weight);
  const eps = 0.0001;
  const contains = (b: Bracket) => w >= b.min - eps && w < b.max - eps;
  return brackets.find((b) => !b.multiplier && contains(b)) ?? brackets.find((b) => b.multiplier && contains(b)) ?? brackets[brackets.length - 1] ?? null;
}

export function isValidPackage(p: Package): boolean {
  const w = Number(p.weight) || 0;
  return w > 0 || ((Number(p.length) || 0) > 0 && (Number(p.width) || 0) > 0 && (Number(p.height) || 0) > 0);
}

const round = (n: number, d: number) => Math.round((n + Number.EPSILON) * 10 ** d) / 10 ** d;

export interface Quote {
  customer_type: string;
  destination: string;
  destination_id: string;
  zone: string;
  weights: { real: number; volumetric: number; billable: number };
  pricing: {
    is_multiplier: boolean;
    unit_rate: number;
    base_price: number;
    discount_percent: number;
    discount_amount: number;
    final_price: number;
  };
  currency: string;
  currency_symbol: string;
}

export function quote(input: { customerType: string; destination: string; packages: Package[]; lang?: 'es' | 'en' }): Quote {
  if (!isValidType(input.customerType)) throw new CalculationError('El tipo de cliente no es válido.');
  const valid = (input.packages || []).filter(isValidPackage);
  if (valid.length === 0) throw new CalculationError('Agrega al menos un paquete con peso o medidas válidas.');
  const zone = resolveZone(input.destination);
  if (!zone || !TARIFFS[zone]) throw new CalculationError('No hay tarifas disponibles para el destino seleccionado.');

  const weights = aggregateWeights(valid);
  const billable = Math.max(weights.billable, SETTINGS.min_billable_weight);
  const bracket = findBracket(zone, billable);
  if (!bracket) throw new CalculationError('No se encontró una tarifa para el peso facturable.');

  const basePrice = bracket.multiplier ? bracket.price * billable : bracket.price;
  const unitRate = bracket.multiplier ? bracket.price : 0;
  const discountPercent = discountFor(input.customerType);
  const discountAmount = basePrice * (discountPercent / 100);
  const finalPrice = Math.max(0, basePrice - discountAmount);

  return {
    customer_type: input.customerType,
    destination: countryLabel(input.destination, input.lang),
    destination_id: String(input.destination).trim(),
    zone,
    weights: { real: round(weights.real, 3), volumetric: round(weights.volumetric, 3), billable: round(billable, 3) },
    pricing: {
      is_multiplier: bracket.multiplier,
      unit_rate: round(unitRate, 2),
      base_price: Math.round(basePrice),
      discount_percent: round(discountPercent, 2),
      discount_amount: Math.round(discountAmount),
      final_price: Math.round(finalPrice),
    },
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
      const { error } = await supabase.from('freight_quotes').insert({
        user_id: user?.id ?? null,
        email,
        name: (user?.user_metadata?.full_name as string | undefined) ?? null,
        origin: 'Colombia',
        destination: result.destination,
        weight_kg: result.weights.billable,
        client_type: result.customer_type,
        zone: result.zone,
        quote_cop: result.pricing.final_price,
      });
      if (error) console.error('freight quote insert failed:', error.message);
    }
  }

  return res.json(result);
});
