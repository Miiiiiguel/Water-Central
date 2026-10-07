import type { Tasa } from './tasaArancel';

// La calculadora ROI del lado del navegador: los números que escribe el
// cliente y lo que el servidor le devuelve. El modelo (rampas, costos
// fijos, sobretasas) vive en server/roi y no viaja a la página.

export type Scenario = 'conservador' | 'optimista';

/** Lo que el cliente escribe en la página. */
export interface RoiEntrada {
  price: number;
  cost: number;
  weightG: number;
  lot: number;
  returnsPct: number;
  ugcPct: number;
  meetsAgreement: boolean;
  litersPerUnit: number;
  domesticShipUsd: number | null;
  adsBudget: number;
  contentBudget: number;
  channelBudget: number;
}

export const ENTRADA_INICIAL: RoiEntrada = {
  price: 54.9,
  cost: 12,
  weightG: 350,
  lot: 500,
  returnsPct: 0.02,
  ugcPct: 0.15,
  meetsAgreement: false,
  litersPerUnit: 0,
  domesticShipUsd: null,
  adsBudget: 999,
  contentBudget: 600,
  channelBudget: 999,
};

export interface AnioUnoResumen {
  revenue: number;
  egresos: number;
  utilidad: number;
  saldo: number[];
  /** Unidades que hay que vender cada mes. */
  unidades: number[];
  costUnit: number[];
  profitUnit: number[];
  profitMonth: number[];
  roiUnit: number[];
}

export interface AnioDosResumen {
  revenue: number;
  egresos: number;
  utilidad: number;
}

export interface FilaDesglose {
  price: number;
  product: number;
  freight: number;
  domesticShip: number;
  aranceles: number;
  returns: number;
  platform: number;
  warehousing: number;
  channel: number;
  ads: number;
  content: number;
  ugc: number;
  total: number;
}

export interface Pronostico {
  revenueArr: number[];
  units: number[];
  ticket: number[];
  cogsArr: number[];
  adsIncrArr: number[];
  imprevArr: number[];
  egresosArr: number[];
  profitMonth: number[];
  saldo: number[];
}

export interface Proyeccion {
  resumen: { cons1: AnioUnoResumen; opt1: AnioUnoResumen; cons2: AnioDosResumen; opt2: AnioDosResumen };
  inversion: { productCost: number; logistics: number; marketing3: number; total: number };
  derecho: { usd: number; calculable: boolean; falta?: string } | null;
  envioAplica: boolean;
  desbloqueado: { detalle: boolean; pronostico: boolean };
  desglose?: { cons: FilaDesglose[]; opt: FilaDesglose[] };
  pronostico?: { cons1: Pronostico; opt1: Pronostico; cons2: Pronostico; opt2: Pronostico };
}

export async function pedirProyeccion(
  entrada: RoiEntrada & { destino: string; hts: { codigo: string; tasa: Tasa } | null },
  token: string | null,
  signal?: AbortSignal
): Promise<Proyeccion | null> {
  try {
    const res = await fetch('/api/roi/proyeccion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(entrada),
      signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as Proyeccion;
  } catch {
    return null;
  }
}

/** Mes (desde 1) en que el saldo acumulado llega a `umbral`. */
export function mesEnQue(saldo: number[], umbral: number): number | null {
  for (let i = 0; i < saldo.length; i++) if (saldo[i] >= umbral) return i + 1;
  return null;
}

/**
 * Números de relleno para lo que se muestra desenfocado detrás de un
 * reporte sin comprar. No salen del modelo: son una sucesión fija que
 * sólo da la forma de una tabla.
 */
export function relleno(n: number, base: number, paso: number): number[] {
  return Array.from({ length: n }, (_, i) => base + paso * ((i * 7) % 5) - paso * ((i * 3) % 4));
}
