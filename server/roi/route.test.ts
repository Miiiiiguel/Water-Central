import { describe, expect, it } from 'vitest';
import { aInputs, entradaSchema, proyeccion, type EntradaRoi } from './route';
import { RECIPROCAL_TARIFF, project } from './model';
import { parseTasa } from '../../client/src/lib/tasaArancel';

const BASE: EntradaRoi = {
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
  destino: 'US',
  origen: 'CO',
  hts: null,
};

describe('lo que decide el servidor', () => {
  it('applies the origin surcharge only to the US, whatever the browser sends', () => {
    expect(aInputs(BASE).reciprocalPct).toBe(RECIPROCAL_TARIFF);
    expect(aInputs({ ...BASE, destino: 'ES' }).reciprocalPct).toBe(0);
    // The Colombia TPA does not waive it.
    expect(aInputs({ ...BASE, meetsAgreement: true }).reciprocalPct).toBe(RECIPROCAL_TARIFF);
    // China adds its own Section 301 on top.
    expect(aInputs({ ...BASE, origen: 'CN' }).reciprocalPct).toBeCloseTo(0.125 + 0.25, 9);
    // A body without origin (an old page) is Colombia.
    const { origen: _o, ...sinOrigen } = BASE;
    expect(entradaSchema.parse(sinOrigen).origen).toBe('CO');
    // A reciprocalPct in the body is not part of the schema: it is dropped.
    const conTrampa = entradaSchema.parse({ ...BASE, reciprocalPct: 0 });
    expect('reciprocalPct' in conTrampa).toBe(false);
  });

  it('charges duty on FOB where the destination does, CIF elsewhere', () => {
    expect(aInputs(BASE).dutyBase).toBe('fob');
    expect(aInputs({ ...BASE, destino: 'DE' }).dutyBase).toBe('cif');
    expect(aInputs({ ...BASE, destino: 'CA' }).dutyBase).toBe('fob');
    expect(aInputs({ ...BASE, destino: 'JP' }).dutyBase).toBe('cif');
  });

  it('takes any country as destination, and nothing else', () => {
    expect(entradaSchema.safeParse({ ...BASE, destino: 'KE' }).success).toBe(true);
    expect(entradaSchema.safeParse({ ...BASE, destino: 'XX' }).success).toBe(false);
    expect(entradaSchema.safeParse({ ...BASE, destino: 'PR' }).success).toBe(false);
  });

  it('only quotes US domestic shipping for the US', () => {
    expect(aInputs({ ...BASE, domesticShipUsd: 8 }).domesticShipUsd).toBe(8);
    expect(aInputs({ ...BASE, destino: 'GB', domesticShipUsd: 8 }).domesticShipUsd).toBeNull();
  });
});

describe('las unidades al mes que proyecta el cliente', () => {
  it('mueven las ventas: el mes 12 conservador es lo que escribió, y el optimista escala igual', () => {
    const r = proyeccion({ ...BASE, unitsMonth: 600 }, { detalle: false, pronostico: false });
    expect(r.resumen.cons1.unidades[11]).toBe(600);
    expect(r.resumen.cons1.unidades[0]).toBe(50);
    const base = proyeccion({ ...BASE, unitsMonth: 1200 }, { detalle: false, pronostico: false });
    expect(r.resumen.opt1.unidades.reduce((a, b) => a + b, 0)).toBeCloseTo(base.resumen.opt1.unidades.reduce((a, b) => a + b, 0) / 2, -1);
  });

  it('el primer envío son los tres primeros meses conservadores, y la inversión lo usa', () => {
    const r = proyeccion({ ...BASE, unitsMonth: 600 }, { detalle: false, pronostico: false });
    expect(r.inversion.unidades).toBe(50 + 100 + 150);
    expect(r.inversion.productCost).toBeCloseTo(300 * BASE.cost, 6);
  });

  it('el año 2 trae su total de unidades', () => {
    const r = proyeccion({ ...BASE, unitsMonth: 1200 }, { detalle: false, pronostico: false });
    expect(r.resumen.cons2.unidadesTotal).toBe(800 + 900 + 1000 + 1100 + 1200 + 1300 + 1400 + 1500 + 1600 + 1700 + 1800 + 1900);
  });

  it('una página vieja que manda el primer envío y no las unidades sigue funcionando', () => {
    const r = proyeccion({ ...BASE, unitsMonth: undefined, lot: 500 }, { detalle: false, pronostico: false });
    expect(r.inversion.unidades).toBe(500);
    expect(r.resumen.cons1.unidades[11]).toBe(1200);
  });
});

describe('lo que viaja al navegador', () => {
  it('without a purchase: results only, no breakdown, no forecast, no model assumptions', () => {
    const r = proyeccion(BASE, { detalle: false, pronostico: false });
    expect(r.desglose).toBeUndefined();
    expect(r.pronostico).toBeUndefined();
    const json = JSON.stringify(r);
    expect(json).not.toMatch(/reciprocal|breakdown|warehousing|month7Cost|totalFreight|"units"/);
    // The free numbers are the model's, unchanged.
    const p = project(aInputs(BASE));
    expect(r.resumen.cons1.utilidad).toBeCloseTo(p.cons1.utilidad, 6);
    expect(r.inversion.total).toBeCloseTo(p.investment.total, 6);
  });

  it('the free summary carries the units to sell each month and the balance the chart draws', () => {
    const r = proyeccion(BASE, { detalle: false, pronostico: false });
    const p = project(aInputs(BASE));
    expect(r.resumen.cons1.unidades).toEqual(p.cons1.units);
    // The chart's cumulative balance is the running sum of the monthly profit row.
    let acc = 0;
    r.resumen.cons1.profitMonth.forEach((v, i) => {
      acc += v;
      expect(r.resumen.cons1.saldo[i]).toBeCloseTo(acc, 6);
    });
  });

  it('the bought breakdown folds the reciprocal surcharge into duties, with the same total', () => {
    const r = proyeccion(BASE, { detalle: true, pronostico: false });
    const p = project(aInputs(BASE));
    const fila = r.desglose!.cons[0];
    const bd = p.cons1.breakdown[0];
    expect(fila.aranceles).toBeCloseTo(bd.tradeTariff + bd.reciprocalTariff, 9);
    expect(fila.total).toBeCloseTo(bd.total, 9);
    expect('reciprocalTariff' in fila).toBe(false);
    expect(r.pronostico).toBeUndefined();
  });

  it('the forecast includes the breakdown, as the offer says', () => {
    const r = proyeccion(BASE, { detalle: false, pronostico: true });
    expect(r.desglose).toBeDefined();
    expect(r.pronostico!.cons2.revenueArr).toHaveLength(12);
    expect(r.desbloqueado).toEqual({ detalle: true, pronostico: true });
  });

  it('returns the duty per unit of the chosen code, on CIF outside the US', () => {
    const tasa = parseTasa('10%');
    const us = proyeccion({ ...BASE, hts: { codigo: '6109100012', tasa } }, { detalle: false, pronostico: false });
    expect(us.derecho!.usd).toBeCloseTo(1.2, 9);
    const es = proyeccion({ ...BASE, destino: 'ES', hts: { codigo: '6109100010', tasa } }, { detalle: false, pronostico: false });
    expect(es.derecho!.usd).toBeGreaterThan(1.2);
  });

  it('rejects nonsense instead of computing it', () => {
    expect(entradaSchema.safeParse({ ...BASE, price: -1 }).success).toBe(false);
    expect(entradaSchema.safeParse({ ...BASE, destino: 'XX' }).success).toBe(false);
    expect(entradaSchema.safeParse({ ...BASE, lot: 0 }).success).toBe(false);
    expect(entradaSchema.safeParse({ ...BASE, unitsMonth: 0 }).success).toBe(false);
  });
});

describe('descuentos en fechas especiales', () => {
  it('una página vieja no los manda: no hay efecto', () => {
    const e = entradaSchema.parse({ ...BASE });
    expect(e.promociones).toBeNull();
    expect('efectoPromos' in proyeccion(e, { detalle: false, pronostico: false })).toBe(false);
  });

  it('con Black Friday se venden más unidades y se dice cuánto cambia la ganancia', () => {
    const e = entradaSchema.parse({ ...BASE, promociones: { inicioMes: 9, fechas: [{ mes: 11, descuento: 0.25, alza: 2 }] } });
    const r = proyeccion(e, { detalle: false, pronostico: false });
    expect(r.efectoPromos!.conservador.unidades).toBeGreaterThan(0);
    const sin = proyeccion({ ...e, promociones: null }, { detalle: false, pronostico: false });
    expect(r.efectoPromos!.conservador.utilidad).toBeCloseTo(r.resumen.cons1.utilidad - sin.resumen.cons1.utilidad, 6);
  });

  it('no acepta descuentos absurdos', () => {
    expect(entradaSchema.safeParse({ ...BASE, promociones: { inicioMes: 9, fechas: [{ mes: 11, descuento: 1.5, alza: 2 }] } }).success).toBe(false);
  });
});
