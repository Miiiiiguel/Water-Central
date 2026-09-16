// El catálogo: qué se vende, a qué precio, y qué entrega cada compra.
//
// Existe por una razón concreta. Los precios estaban repartidos entre el
// texto de la web (USD 499), la calculadora de ROI (39.90 y 99.90), el
// diagnóstico (9.99) y el prompt de Marco Polo — cuatro copias que podían
// contradecirse, y de hecho se contradijeron: Marco Polo estuvo diciendo
// 6.90 después de que el precio subiera. Acá hay una sola.
//
// Dos monedas, un solo cobro. Wompi liquida en pesos, así que el monto
// que se cobra siempre es COP; el dólar es la etiqueta que ve quien no
// está en Colombia, y su banco convierte. La tasa es una variable de
// entorno, no un número escondido en el código.

export const USD_COP_RATE = () => Number(process.env.USD_COP_RATE) || 4000;

export type PlanId =
  | 'diagnostico_madurez'
  | 'analisis_mercado'
  | 'acompanamiento'
  | 'creditos_marco_polo'
  | 'reporte_detalle'
  | 'reporte_pronostico';

export interface CatalogItem {
  label: string;
  labelEn: string;
  /** Precio publicado, en centavos de dólar. null = a medida, no se cobra en línea. */
  usdCents: number | null;
  /** Variable de entorno para fijar el precio en PESOS enteros, si se quiere otro. */
  copEnv: string;
  /** Price ID de Stripe, si algún día se cobra por allá. */
  stripePriceEnv: string;
  /** Lo que la compra entrega además de la fila en `payments`. */
  grants?: { researchCredits: number };
}

export const CATALOG: Record<PlanId, CatalogItem> = {
  diagnostico_madurez: {
    label: 'Plan de acción del diagnóstico de madurez',
    labelEn: 'Maturity diagnosis action plan',
    usdCents: 999,
    copEnv: 'PRICE_DIAGNOSTICO_MADUREZ_COP',
    stripePriceEnv: 'STRIPE_PRICE_DIAGNOSTICO_MADUREZ',
  },
  analisis_mercado: {
    label: 'Análisis de mercado y competencia',
    labelEn: 'Market & competitor analysis',
    usdCents: 49900,
    copEnv: 'PRICE_ANALISIS_MERCADO_COP',
    stripePriceEnv: 'STRIPE_PRICE_ANALISIS_MERCADO',
  },
  acompanamiento: {
    // A medida: nadie puede comprarlo de un botón, y el botón no finge
    // que sí. Lleva a hablar con el equipo.
    label: 'Plan de crecimiento a medida',
    labelEn: 'Custom growth plan',
    usdCents: null,
    copEnv: 'PRICE_ACOMPANAMIENTO_COP',
    stripePriceEnv: 'STRIPE_PRICE_ACOMPANAMIENTO',
  },
  creditos_marco_polo: {
    label: '50 consultas de Marco Polo',
    labelEn: '50 Marco Polo lookups',
    usdCents: 1900,
    copEnv: 'PRICE_CREDITOS_MARCO_POLO_COP',
    stripePriceEnv: 'STRIPE_PRICE_CREDITOS_MARCO_POLO',
    grants: { researchCredits: 50 },
  },
  reporte_detalle: {
    label: 'Desglose de costos mes a mes',
    labelEn: 'Month-by-month cost breakdown',
    usdCents: 3990,
    copEnv: 'PRICE_REPORTE_DETALLE_COP',
    stripePriceEnv: 'STRIPE_PRICE_REPORTE_DETALLE',
  },
  reporte_pronostico: {
    label: 'Pronóstico completo a 2 años',
    labelEn: 'Full 2-year forecast',
    usdCents: 9990,
    copEnv: 'PRICE_REPORTE_PRONOSTICO_COP',
    stripePriceEnv: 'STRIPE_PRICE_REPORTE_PRONOSTICO',
  },
};

export const PLAN_IDS = Object.keys(CATALOG) as [PlanId, ...PlanId[]];

export const isPlanId = (v: unknown): v is PlanId => typeof v === 'string' && v in CATALOG;

/**
 * Dólares a pesos, redondeando HACIA ABAJO a la centena.
 *
 * Lo de la centena no es estética: es lo que hace que 9.99 dólares den
 * exactamente los $39.900 que ya están publicados en la web y en el
 * diagnóstico. Si el redondeo fuera al alza, el mismo diagnóstico
 * costaría $40.000 en un lado y $39.900 en el otro.
 */
export function usdCentsToCopCents(usdCents: number, rate = USD_COP_RATE()): number {
  const pesos = Math.floor(((usdCents / 100) * rate) / 100) * 100;
  return pesos * 100;
}

export interface Price {
  /** Lo que de verdad se cobra, en centavos de peso. */
  amountInCents: number;
  currency: 'COP';
  /** Lo que se muestra: pesos para Colombia, dólares para el resto. */
  displayCop: string;
  displayUsd: string | null;
}

export function copDisplay(copCents: number): string {
  return `$${(copCents / 100).toLocaleString('es-CO', { maximumFractionDigits: 0 })} COP`;
}

/** El precio de un plan, o null si es a medida / sin precio configurado. */
export function priceOf(plan: PlanId, env: NodeJS.ProcessEnv = process.env): Price | null {
  const item = CATALOG[plan];

  const override = Number(env[item.copEnv]);
  const copCents = Number.isFinite(override) && override > 0
    ? Math.round(override) * 100
    : item.usdCents === null
      ? 0
      : usdCentsToCopCents(item.usdCents, Number(env.USD_COP_RATE) || 4000);

  if (copCents <= 0) return null;

  return {
    amountInCents: copCents,
    currency: 'COP',
    displayCop: copDisplay(copCents),
    displayUsd: item.usdCents === null ? null : `USD ${(item.usdCents / 100).toFixed(2).replace(/\.00$/, '')}`,
  };
}
