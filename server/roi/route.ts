import express from 'express';
import { z } from 'zod';
import { makeLimiter, JSON_BODY_LIMIT } from '../security';
import { getSupabaseAdmin, getUserFromRequest } from '../supabaseAdmin';
import { logSecurityEvent } from '../log';
import { esCuentaMaestra } from '../maestros';
import { derechoPorUnidad, type Tasa } from '../../client/src/lib/tasaArancel';
import {
  DEFAULT_INPUTS,
  FREE_SHIP_THRESHOLD,
  project,
  totalFreightFor,
  type CostBreakdown,
  type RoiInputs,
  type YearOne,
  type YearTwo,
} from './model';
import { recargoAdicional } from './recargos';

// La calculadora ROI, del lado del servidor.
//
// El navegador manda los números del cliente (precio, costo, peso, lote,
// presupuestos, destino y la tarifa de su partida) y recibe resultados:
// lo que se ve en la página y nada más. Los supuestos del modelo —rampas
// de ventas, costos fijos por unidad, flete por kilo, sobretasa
// recíproca— no salen de acá.
//
// Los dos reportes pagos (desglose de costos y pronóstico a 2 años) sólo
// viajan a quien los compró: antes se mandaban a todos y se tapaban con
// un desenfoque, que se quita desde las herramientas del navegador.

export const DESTINOS_ROI = ['US', 'GB', 'DE', 'FR', 'IT', 'ES'] as const;
export const PLAN_DETALLE = 'reporte_detalle';
export const PLAN_PRONOSTICO = 'reporte_pronostico';

const componenteSchema = z.union([
  z.object({ tipo: z.literal('advalorem'), pct: z.number().min(0).max(1000) }),
  z.object({
    tipo: z.literal('especifico'),
    usd: z.number().min(0).max(100000),
    por: z.enum(['kg', 'unidad', 'par', 'docena', 'gruesa', 'litro']),
  }),
]);

const tasaSchema = z.object({
  texto: z.string().max(400),
  libre: z.boolean(),
  componentes: z.array(componenteSchema).max(12),
  calculable: z.boolean(),
  motivo: z.string().max(400).optional(),
  necesita: z.array(z.enum(['peso', 'volumen'])).max(2),
});

const num = (max: number) => z.number().finite().min(0).max(max);

export const entradaSchema = z.object({
  price: num(1_000_000),
  cost: num(1_000_000),
  weightG: z.number().finite().min(1).max(1_000_000),
  lot: z.number().finite().min(1).max(10_000_000),
  returnsPct: num(1),
  ugcPct: num(1),
  meetsAgreement: z.boolean(),
  litersPerUnit: num(10_000),
  domesticShipUsd: num(10_000).nullable(),
  adsBudget: num(100_000_000),
  contentBudget: num(100_000_000),
  channelBudget: num(100_000_000),
  destino: z.enum(DESTINOS_ROI),
  // País de origen (ISO). Las páginas viejas no lo mandan: era Colombia.
  origen: z.string().regex(/^[A-Z]{2}$/).default('CO'),
  hts: z.object({ codigo: z.string().max(20), tasa: tasaSchema }).nullable(),
});

export type EntradaRoi = z.infer<typeof entradaSchema>;

/** Lo que el modelo necesita, con lo que no decide el cliente puesto acá. */
export function aInputs(e: EntradaRoi): RoiInputs {
  const esUS = e.destino === 'US';
  return {
    ...DEFAULT_INPUTS,
    price: e.price,
    cost: e.cost,
    weightG: e.weightG,
    lot: e.lot,
    returnsPct: e.returnsPct,
    ugcPct: e.ugcPct,
    meetsAgreement: e.meetsAgreement,
    litersPerUnit: e.litersPerUnit,
    // La tarifa cotizada es de un envío dentro de EE. UU.
    domesticShipUsd: esUS ? e.domesticShipUsd : null,
    adsBudget: e.adsBudget,
    contentBudget: e.contentBudget,
    channelBudget: e.channelBudget,
    // Los recargos de EE. UU. por país de origen (Sección 301 por trabajo
    // forzoso y, para China, su Sección 301 de siempre) salen de
    // ./recargos: el cliente no los ve ni los cambia. Un TLC no los
    // exime, salvo T-MEC y textiles de CAFTA-DR que califican.
    reciprocalPct: recargoAdicional({ destino: e.destino, origen: e.origen, codigo: e.hts?.codigo ?? null, califica: e.meetsAgreement }),
    // EE. UU. cobra el arancel sobre el valor del producto (FOB); el
    // Reino Unido y la UE, sobre producto + flete (CIF).
    dutyBase: esUS ? 'fob' : 'cif',
    hts: e.hts ? { codigo: e.hts.codigo, tasa: e.hts.tasa as Tasa } : null,
  };
}

const anio1Libre = (y: YearOne) => ({
  revenue: y.revenue,
  egresos: y.egresos,
  utilidad: y.utilidad,
  saldo: y.saldo,
  // Sin `units`: las unidades por mes son la rampa de ventas del modelo.
  // Viajan sólo dentro del pronóstico pagado.
  costUnit: y.costUnit,
  profitUnit: y.profitUnit,
  profitMonth: y.profitMonth,
  roiUnit: y.roiUnit,
});

const anio2Libre = (y: YearTwo) => ({ revenue: y.revenue, egresos: y.egresos, utilidad: y.utilidad });

/**
 * El desglose pagado, con la sobretasa recíproca sumada a los aranceles:
 * quien lo compra ve cuánto paga en aranceles, no cuánto pesa cada
 * medida del modelo.
 */
export function desgloseDe(bd: CostBreakdown[]) {
  return bd.map((b) => ({
    price: b.price,
    product: b.product,
    freight: b.freight,
    domesticShip: b.domesticShip,
    aranceles: b.tradeTariff + b.reciprocalTariff,
    returns: b.returns,
    platform: b.platform,
    warehousing: b.warehousing,
    channel: b.channel,
    ads: b.ads,
    content: b.content,
    ugc: b.ugc,
    total: b.total,
  }));
}

const pronosticoDe = (y: YearOne | YearTwo) => ({
  revenueArr: y.revenueArr,
  units: y.units,
  ticket: y.ticket,
  cogsArr: y.cogsArr,
  adsIncrArr: y.adsIncrArr,
  imprevArr: y.imprevArr,
  egresosArr: y.egresosArr,
  profitMonth: y.profitMonth,
  saldo: y.saldo,
});

export function proyeccion(e: EntradaRoi, desbloqueado: { detalle: boolean; pronostico: boolean }) {
  const inp = aInputs(e);
  const p = project(inp);
  const fletePorUnidad = inp.dutyBase === 'cif' ? totalFreightFor(inp) / inp.lot : 0;
  const derecho = inp.hts
    ? derechoPorUnidad(inp.hts.tasa, { valor: inp.cost + fletePorUnidad, pesoKg: inp.weightG / 1000, litros: inp.litersPerUnit })
    : null;

  // Pagar el pronóstico incluye el desglose (así lo dice la oferta).
  const verDesglose = desbloqueado.detalle || desbloqueado.pronostico;
  return {
    resumen: { cons1: anio1Libre(p.cons1), opt1: anio1Libre(p.opt1), cons2: anio2Libre(p.cons2), opt2: anio2Libre(p.opt2) },
    inversion: p.investment,
    derecho: derecho ? { usd: derecho.usd, calculable: derecho.calculable, falta: derecho.falta } : null,
    envioAplica: inp.price >= FREE_SHIP_THRESHOLD,
    desbloqueado: { detalle: verDesglose, pronostico: desbloqueado.pronostico },
    ...(verDesglose ? { desglose: { cons: desgloseDe(p.cons1.breakdown), opt: desgloseDe(p.opt1.breakdown) } } : {}),
    ...(desbloqueado.pronostico
      ? { pronostico: { cons1: pronosticoDe(p.cons1), opt1: pronosticoDe(p.opt1), cons2: pronosticoDe(p.cons2), opt2: pronosticoDe(p.opt2) } }
      : {}),
  };
}

/** Qué reportes compró quien llama. Sin sesión, ninguno. */
async function reportesComprados(req: express.Request): Promise<{ detalle: boolean; pronostico: boolean }> {
  const nada = { detalle: false, pronostico: false };
  const user = await getUserFromRequest(req);
  if (!user) return nada;
  if (esCuentaMaestra(user)) return { detalle: true, pronostico: true };
  const admin = getSupabaseAdmin();
  if (!admin) return nada;
  const { data } = await admin
    .from('payments')
    .select('plan')
    .eq('user_id', user.id)
    .eq('status', 'paid')
    .in('plan', [PLAN_DETALLE, PLAN_PRONOSTICO]);
  const planes = new Set((data ?? []).map((r) => (r as { plan: string }).plan));
  return { detalle: planes.has(PLAN_DETALLE), pronostico: planes.has(PLAN_PRONOSTICO) };
}

export const roiRouter = express.Router();

// Se recalcula mientras la persona escribe (con una pausa corta en el
// navegador), así que el techo es alto; lo que frena es el lote en bucle.
const roiLimiter = makeLimiter('roi', 900);

roiRouter.post('/roi/proyeccion', roiLimiter, express.json({ limit: JSON_BODY_LIMIT }), async (req, res) => {
  const parsed = entradaSchema.safeParse(req.body);
  if (!parsed.success) {
    logSecurityEvent('invalid_input', req, { form: 'roi' });
    return res.status(400).json({ error: 'datos_invalidos', message: 'Revisa los números: alguno no es válido.' });
  }
  const desbloqueado = await reportesComprados(req);
  res.setHeader('Cache-Control', 'no-store');
  res.json(proyeccion(parsed.data, desbloqueado));
});
