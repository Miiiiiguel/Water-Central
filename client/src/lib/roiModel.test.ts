import { describe, expect, it } from 'vitest';
import {
  CONS_UNITS_Y1,
  DEFAULT_INPUTS,
  computeInvestment,
  computeYear1,
  computeYear2,
  costBreakdown,
  dutyPerUnit,
  findMonth,
  project,
  totalFreightFor,
  WAREHOUSING,
  type RoiInputs,
} from './roiModel';
import { parseTasa } from './tasaArancel';

// The expected values below are derived by hand from the model's stated
// rules, never read back out of the code — otherwise the test would only
// prove the code equals itself. If one of these fails, either the model
// changed on purpose (update the arithmetic in the comment too) or a
// formula broke.

const inp = DEFAULT_INPUTS;
const freight = totalFreightFor(inp); // (500 units x 350 g) = 175 kg x 6.9 = 1207.5

describe('freight', () => {
  it('charges by total shipped weight', () => {
    expect(freight).toBeCloseTo(1207.5, 6);
  });

  it('splits the lot freight across the lot, not the month', () => {
    // 1207.5 / 500 units = 2.415 per unit, whatever the month sells.
    expect(costBreakdown(100, inp, 3.5, freight).freight).toBeCloseTo(2.415, 6);
    expect(costBreakdown(1200, inp, 3.5, freight).freight).toBeCloseTo(2.415, 6);
  });
});

describe('cost per unit', () => {
  it('matches the hand-computed breakdown in month 1', () => {
    const b = costBreakdown(100, inp, WAREHOUSING.conservador, freight);
    expect(b.product).toBeCloseTo(12, 6);
    expect(b.reciprocalTariff).toBeCloseTo(1.5, 6); // 12 x 12.5%
    expect(b.tradeTariff).toBeCloseTo(0.96, 6); // 12 x 8%, product does not qualify
    expect(b.domesticShip).toBeCloseTo(7, 6); // price 54.90 >= 35
    expect(b.returns).toBeCloseTo(1.098, 6); // 54.90 x 2%
    expect(b.platform).toBeCloseTo(3.843, 6); // 54.90 x 7%
    expect(b.ugc).toBeCloseTo(8.235, 6); // 54.90 x 15%
    expect(b.warehousing).toBeCloseTo(3.5, 6);
    expect(b.channel).toBeCloseTo(9.99, 6); // 999 / 100 units
    expect(b.ads).toBeCloseTo(9.99, 6);
    expect(b.content).toBeCloseTo(6, 6); // 600 / 100 units
    // 12 + 1.5 + 2.415 + 7 + 0.96 + 1.098 + 3.843 + 3.5 + 9.99 + 9.99 + 6 + 8.235
    expect(b.total).toBeCloseTo(66.531, 6);
  });

  it('falls as volume spreads the fixed monthly budgets', () => {
    const m1 = costBreakdown(100, inp, WAREHOUSING.conservador, freight).total;
    const m12 = costBreakdown(1200, inp, WAREHOUSING.conservador, freight).total;
    // Only the three budgets move: (999+999+600) x (1/100 - 1/1200) = 23.815
    expect(m1 - m12).toBeCloseTo(23.815, 6);
    expect(m12).toBeLessThan(inp.price); // month 12 is profitable per unit
    expect(m1).toBeGreaterThan(inp.price); // month 1 is not
  });

  it('drops the trade tariff when the product qualifies', () => {
    const qualifies: RoiInputs = { ...inp, meetsAgreement: true };
    const before = costBreakdown(500, inp, 3.5, freight).total;
    const after = costBreakdown(500, qualifies, 3.5, freight).total;
    expect(before - after).toBeCloseTo(0.96, 6);
  });

  it('drops domestic shipping below the free-shipping threshold', () => {
    const cheap: RoiInputs = { ...inp, price: 34.99 };
    expect(costBreakdown(500, cheap, 3.5, totalFreightFor(cheap)).domesticShip).toBe(0);
    const atThreshold: RoiInputs = { ...inp, price: 35 };
    expect(costBreakdown(500, atThreshold, 3.5, totalFreightFor(atThreshold)).domesticShip).toBe(7);
  });
});

describe('year 1', () => {
  const y1 = computeYear1(CONS_UNITS_Y1, inp, WAREHOUSING.conservador, freight);

  it('has no extra ad spend before month 4, then 8% of last month', () => {
    expect(y1.adsIncrArr.slice(0, 3)).toEqual([0, 0, 0]);
    // Month 4 = 8% of month 3 revenue (300 units x 54.90 = 16,470).
    expect(y1.adsIncrArr[3]).toBeCloseTo(16470 * 0.08, 6);
  });

  it('loses money per unit early and makes it later', () => {
    expect(y1.profitUnit[0]).toBeCloseTo(54.9 - 66.531, 6);
    expect(y1.profitUnit[11]).toBeGreaterThan(0);
  });

  it('keeps the running balance consistent with monthly profit', () => {
    const summed = y1.profitMonth.reduce((a, b) => a + b, 0);
    expect(y1.saldo[11]).toBeCloseTo(summed, 6);
    expect(y1.utilidad).toBeCloseTo(summed, 6);
  });

  it('reports revenue as price x units', () => {
    const units = CONS_UNITS_Y1.reduce((a, b) => a + b, 0); // 7,800
    expect(y1.revenue).toBeCloseTo(units * inp.price, 6);
  });

  it('bases year 2 on the month-7 cost', () => {
    expect(y1.month7Cost).toBeCloseTo(costBreakdown(700, inp, WAREHOUSING.conservador, freight).total, 6);
  });
});

describe('year 2', () => {
  const y1 = computeYear1(CONS_UNITS_Y1, inp, WAREHOUSING.conservador, freight);
  const y2 = computeYear2([1000], inp, y1.month7Cost);

  it('raises the ticket 4% and the cost 6%', () => {
    expect(y2.ticket[0]).toBeCloseTo(inp.price * 1.04, 6);
    expect(y2.cogsArr[0]).toBeCloseTo(y1.month7Cost * 1.06 * 1000, 6);
  });

  it('spends 6% of revenue on ads', () => {
    expect(y2.adsIncrArr[0]).toBeCloseTo(y2.revenueArr[0] * 0.06, 6);
  });

  it('nets revenue minus every outflow', () => {
    expect(y2.utilidad).toBeCloseTo(y2.revenue - y2.egresos, 6);
  });
});

describe('investment', () => {
  it('adds inventory, outbound logistics and three months of budget', () => {
    const inv = computeInvestment(inp, freight);
    expect(inv.productCost).toBeCloseTo(6000, 6); // 500 x 12
    expect(inv.logistics).toBeCloseTo(1207.5 + 3.5 * 500, 6); // freight + prep
    expect(inv.marketing3).toBeCloseTo((999 + 999 + 600) * 3, 6);
    expect(inv.total).toBeCloseTo(6000 + 2957.5 + 7794, 6);
  });
});

describe('findMonth', () => {
  it('returns the first 1-based month at or above the threshold', () => {
    expect(findMonth([-10, -5, 0, 5], 0)).toBe(3);
    expect(findMonth([-10, -5], 0)).toBeNull();
  });
});

describe('project', () => {
  it('makes the optimistic scenario out-earn the conservative one', () => {
    const p = project(inp);
    expect(p.opt1.revenue).toBeGreaterThan(p.cons1.revenue);
    expect(p.opt1.utilidad).toBeGreaterThan(p.cons1.utilidad);
  });

  it('survives a zero-budget, zero-commission product without dividing by zero', () => {
    const lean: RoiInputs = {
      ...inp,
      adsBudget: 0,
      contentBudget: 0,
      channelBudget: 0,
      returnsPct: 0,
      platformPct: 0,
      ugcPct: 0,
    };
    const p = project(lean);
    expect(Number.isFinite(p.cons1.utilidad)).toBe(true);
    expect(Number.isFinite(p.investment.total)).toBe(true);
  });
});

describe('arancel real del HTS', () => {
  const base: RoiInputs = { ...DEFAULT_INPUTS, cost: 12, weightG: 500 };

  it('sin partida elegida se mantiene el supuesto del equipo', () => {
    expect(dutyPerUnit(base)).toBeCloseTo(0.96, 6);
    expect(dutyPerUnit({ ...base, meetsAgreement: true })).toBe(0);
  });

  it('con partida: su tarifa sobre el costo', () => {
    const conPartida = { ...base, hts: { codigo: '6109.10.00.12', tasa: parseTasa('16.5%') } };
    expect(dutyPerUnit(conPartida)).toBeCloseTo(1.98, 6);
    expect(costBreakdown(100, conPartida, 3.5, 100).tradeTariff).toBeCloseTo(1.98, 6);
  });

  it('libre por acuerdo: cero', () => {
    expect(dutyPerUnit({ ...base, hts: { codigo: '6109.10.00.12', tasa: parseTasa('Free') } })).toBe(0);
  });

  it('centavos por kilo usan el peso del producto', () => {
    const cafe = { ...base, hts: { codigo: '0901.90.20.00', tasa: parseTasa('1.5¢/kg') } };
    expect(dutyPerUnit(cafe)).toBeCloseTo(0.0075, 6);
  });

  it('por litro usa el contenido que se indique', () => {
    const vino = { ...base, litersPerUnit: 0.75, hts: { codigo: '2204.21.50', tasa: parseTasa('6.3¢/liter') } };
    expect(dutyPerUnit(vino)).toBeCloseTo(0.04725, 6);
  });

  it('la sobretasa recíproca se puede ajustar', () => {
    expect(costBreakdown(100, { ...base, reciprocalPct: 0.1 }, 3.5, 100).reciprocalTariff).toBeCloseTo(1.2, 6);
  });

  it('una partida con arancel más alto baja la utilidad del año', () => {
    const libre = project({ ...base, hts: { codigo: 'x', tasa: parseTasa('Free') } });
    const caro = project({ ...base, hts: { codigo: 'x', tasa: parseTasa('32%') } });
    expect(caro.cons1.utilidad).toBeLessThan(libre.cons1.utilidad);
  });
});
