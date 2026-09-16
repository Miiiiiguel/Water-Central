// Financial model behind the ROI calculator.
//
// This is Easycomex's own model, ported verbatim from the spreadsheet
// logic: the ramps, the tariffs, the growth assumptions and the order of
// operations are exactly as the team defined them. Keep it that way —
// the numbers a client sees here are the ones the team will defend in a
// meeting, so a "small improvement" to a formula is a bug.
//
// Everything is pure: no DOM, no fetch, no formatting. That is what lets
// client/src/lib/roiModel.test.ts check the money math.

// ---------------------------------------------------------------------
// Fixed assumptions (Easycomex's model, not user-editable in the UI)
// ---------------------------------------------------------------------

/** Units sold per month, year 1: slow and steady. */
export const CONS_UNITS_Y1 = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200];
/** Units sold per month, year 1: campaign peaks in the second half. */
export const OPT_UNITS_Y1 = [100, 300, 500, 800, 1100, 1300, 1500, 2000, 2300, 2500, 3000, 2000];
export const CONS_UNITS_Y2 = [800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800, 1900];
export const OPT_UNITS_Y2 = [2000, 2300, 2500, 2700, 3000, 3200, 3500, 3700, 3800, 4100, 4500, 4000];

/** Monthly contingency budget. */
export const IMPREV_Y1 = [500, 500, 500, 500, 500, 500, 600, 600, 600, 600, 600, 600];
export const IMPREV_Y2 = [600, 600, 700, 700, 700, 700, 700, 700, 700, 700, 700, 700];

export const FREIGHT_USD_KG = 6.9;
/** Above this price the seller absorbs domestic US shipping. */
export const FREE_SHIP_THRESHOLD = 35;
export const DOMESTIC_SHIP = 7;

/** Always applies, on the production cost. */
export const RECIPROCAL_TARIFF = 0.125;
/** Only charged when the product does NOT qualify under a trade agreement. */
export const TRADE_AGREEMENT_TARIFF = 0.08;

/** Extra ad spend from month 4, as a share of the previous month's revenue. */
export const ADS_INCREMENT_Y1 = 0.08;
export const PRICE_GROWTH_Y2 = 0.04;
export const COST_GROWTH_Y2 = 0.06;
/** Year 2 ad spend, as a share of revenue. */
export const ADS_PCT_Y2 = 0.06;

/** Inventory handling and prep, per unit. */
export const WAREHOUSING = { conservador: 3.5, optimista: 3.0 } as const;

export type Scenario = 'conservador' | 'optimista';

// ---------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------

export interface RoiInputs {
  /** Selling price in the US, USD. */
  price: number;
  /** Production cost in Latin America, USD. */
  cost: number;
  /** Packed weight per unit, grams. */
  weightG: number;
  /** Initial inventory, units. */
  lot: number;
  /** Returns, as a fraction of price (0.02 = 2%). */
  returnsPct: number;
  /** Marketplace commission, as a fraction of price. */
  platformPct: number;
  /** Sales-network commission, as a fraction of price. */
  ugcPct: number;
  /** True when the product qualifies under a trade agreement (no extra tariff). */
  meetsAgreement: boolean;
  /** Monthly budgets, USD. */
  adsBudget: number;
  contentBudget: number;
  channelBudget: number;
}

export const DEFAULT_INPUTS: RoiInputs = {
  price: 54.9,
  cost: 12,
  weightG: 350,
  lot: 500,
  returnsPct: 0.02,
  platformPct: 0.07,
  ugcPct: 0.15,
  meetsAgreement: false,
  adsBudget: 999,
  contentBudget: 600,
  channelBudget: 999,
};

// ---------------------------------------------------------------------
// Per-unit cost
// ---------------------------------------------------------------------

export interface CostBreakdown {
  price: number;
  product: number;
  reciprocalTariff: number;
  freight: number;
  domesticShip: number;
  tradeTariff: number;
  returns: number;
  platform: number;
  warehousing: number;
  channel: number;
  ads: number;
  content: number;
  ugc: number;
  total: number;
}

/**
 * Cost of selling one unit in a month where `units` were sold.
 *
 * The fixed monthly budgets (ads, content, channel) are spread across the
 * units of that month, which is why the per-unit cost falls as volume
 * grows — that effect is the whole point of the model.
 */
export function costBreakdown(units: number, inp: RoiInputs, warehousing: number, totalFreight: number): CostBreakdown {
  const freightPerUnit = totalFreight / inp.lot;
  const domesticShip = inp.price >= FREE_SHIP_THRESHOLD ? DOMESTIC_SHIP : 0;
  const tradeAgreement = inp.meetsAgreement ? 0 : inp.cost * TRADE_AGREEMENT_TARIFF;

  const b: CostBreakdown = {
    price: inp.price,
    product: inp.cost,
    reciprocalTariff: inp.cost * RECIPROCAL_TARIFF,
    freight: freightPerUnit,
    domesticShip,
    tradeTariff: tradeAgreement,
    returns: inp.price * inp.returnsPct,
    platform: inp.price * inp.platformPct,
    warehousing,
    channel: inp.channelBudget / units,
    ads: inp.adsBudget / units,
    content: inp.contentBudget / units,
    ugc: inp.price * inp.ugcPct,
    total: 0,
  };

  b.total =
    b.product + b.reciprocalTariff + b.freight + b.domesticShip + b.tradeTariff +
    b.returns + b.platform + b.warehousing + b.channel + b.ads + b.content + b.ugc;

  return b;
}

export function costPerUnit(units: number, inp: RoiInputs, warehousing: number, totalFreight: number): number {
  return costBreakdown(units, inp, warehousing, totalFreight).total;
}

// ---------------------------------------------------------------------
// Year 1 / Year 2
// ---------------------------------------------------------------------

export interface YearOne {
  revenue: number;
  egresos: number;
  utilidad: number;
  saldo: number[];
  month7Cost: number;
  units: number[];
  ticket: number[];
  revenueArr: number[];
  cogsArr: number[];
  adsIncrArr: number[];
  imprevArr: number[];
  egresosArr: number[];
  costUnit: number[];
  profitUnit: number[];
  profitMonth: number[];
  roiUnit: number[];
  breakdown: CostBreakdown[];
}

export function computeYear1(unitsArr: number[], inp: RoiInputs, warehousing: number, totalFreight: number): YearOne {
  const revenue: number[] = [];
  const cogs: number[] = [];
  const adsIncrArr: number[] = [];
  const egresos: number[] = [];
  const utilidad: number[] = [];
  const saldo: number[] = [];
  const costUnitArr: number[] = [];
  const profitUnitArr: number[] = [];
  const roiUnitArr: number[] = [];
  const breakdownArr: CostBreakdown[] = [];
  let acc = 0;

  for (let i = 0; i < unitsArr.length; i++) {
    const u = unitsArr[i];
    const rev = inp.price * u;
    const bd = costBreakdown(u, inp, warehousing, totalFreight);
    const cpu = bd.total;
    const cg = cpu * u;
    // Extra ad spend kicks in from month 4, based on last month's revenue.
    const adsIncr = i >= 3 ? revenue[i - 1] * ADS_INCREMENT_Y1 : 0;
    const eg = cg + adsIncr + IMPREV_Y1[i];
    const ut = rev - eg;
    acc += ut;

    revenue.push(rev);
    cogs.push(cg);
    adsIncrArr.push(adsIncr);
    egresos.push(eg);
    utilidad.push(ut);
    saldo.push(acc);
    costUnitArr.push(cpu);
    profitUnitArr.push(inp.price - cpu);
    roiUnitArr.push(cpu > 0 ? (inp.price - cpu) / cpu : 0);
    breakdownArr.push(bd);
  }

  return {
    revenue: revenue.reduce((a, b) => a + b, 0),
    egresos: egresos.reduce((a, b) => a + b, 0),
    utilidad: acc,
    saldo,
    // Year 2 grows from the month-7 cost, where the model is "matured".
    month7Cost: costPerUnit(unitsArr[6], inp, warehousing, totalFreight),
    units: unitsArr,
    ticket: unitsArr.map(() => inp.price),
    revenueArr: revenue,
    cogsArr: cogs,
    adsIncrArr,
    imprevArr: IMPREV_Y1,
    egresosArr: egresos,
    costUnit: costUnitArr,
    profitUnit: profitUnitArr,
    profitMonth: utilidad,
    roiUnit: roiUnitArr,
    breakdown: breakdownArr,
  };
}

export interface YearTwo {
  revenue: number;
  egresos: number;
  utilidad: number;
  units: number[];
  ticket: number[];
  revenueArr: number[];
  cogsArr: number[];
  adsIncrArr: number[];
  imprevArr: number[];
  egresosArr: number[];
  profitMonth: number[];
  saldo: number[];
}

export function computeYear2(unitsArr: number[], inp: RoiInputs, month7Cost: number): YearTwo {
  const baseCost = month7Cost * (1 + COST_GROWTH_Y2);
  const ticket2 = inp.price * (1 + PRICE_GROWTH_Y2);

  const revenueArr: number[] = [];
  const cogsArr: number[] = [];
  const adsArr: number[] = [];
  const egresosArr: number[] = [];
  const utilidadArr: number[] = [];
  const saldoArr: number[] = [];
  let revenue = 0;
  let egresos = 0;
  let acc = 0;

  for (let i = 0; i < unitsArr.length; i++) {
    const u = unitsArr[i];
    const rev = ticket2 * u;
    const cg = baseCost * u;
    const ads = rev * ADS_PCT_Y2;
    const eg = cg + ads + IMPREV_Y2[i];
    const ut = rev - eg;
    acc += ut;
    revenue += rev;
    egresos += eg;

    revenueArr.push(rev);
    cogsArr.push(cg);
    adsArr.push(ads);
    egresosArr.push(eg);
    utilidadArr.push(ut);
    saldoArr.push(acc);
  }

  return {
    revenue,
    egresos,
    utilidad: revenue - egresos,
    units: unitsArr,
    ticket: unitsArr.map(() => ticket2),
    revenueArr,
    cogsArr,
    adsIncrArr: adsArr,
    imprevArr: IMPREV_Y2,
    egresosArr,
    profitMonth: utilidadArr,
    saldo: saldoArr,
  };
}

// ---------------------------------------------------------------------
// Start-up capital
// ---------------------------------------------------------------------

export interface Investment {
  productCost: number;
  logistics: number;
  marketing3: number;
  total: number;
}

export function computeInvestment(inp: RoiInputs, totalFreight: number): Investment {
  const productCost = inp.lot * inp.cost;
  const logistics = totalFreight + WAREHOUSING.conservador * inp.lot;
  const marketing3 = (inp.channelBudget + inp.adsBudget + inp.contentBudget) * 3;
  return { productCost, logistics, marketing3, total: productCost + logistics + marketing3 };
}

/** Total outbound freight for the initial lot, USD. */
export function totalFreightFor(inp: RoiInputs): number {
  return ((inp.lot * inp.weightG) / 1000) * FREIGHT_USD_KG;
}

/** 1-based month in which the running balance first reaches `threshold`. */
export function findMonth(saldo: number[], threshold: number): number | null {
  for (let i = 0; i < saldo.length; i++) if (saldo[i] >= threshold) return i + 1;
  return null;
}

// ---------------------------------------------------------------------
// One call that produces everything the page renders
// ---------------------------------------------------------------------

export interface RoiProjection {
  cons1: YearOne;
  opt1: YearOne;
  cons2: YearTwo;
  opt2: YearTwo;
  investment: Investment;
  totalFreight: number;
}

export function project(inp: RoiInputs): RoiProjection {
  const totalFreight = totalFreightFor(inp);
  const cons1 = computeYear1(CONS_UNITS_Y1, inp, WAREHOUSING.conservador, totalFreight);
  const opt1 = computeYear1(OPT_UNITS_Y1, inp, WAREHOUSING.optimista, totalFreight);
  return {
    cons1,
    opt1,
    cons2: computeYear2(CONS_UNITS_Y2, inp, cons1.month7Cost),
    opt2: computeYear2(OPT_UNITS_Y2, inp, opt1.month7Cost),
    investment: computeInvestment(inp, totalFreight),
    totalFreight,
  };
}
