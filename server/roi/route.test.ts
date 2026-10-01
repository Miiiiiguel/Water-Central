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
  hts: null,
};

describe('lo que decide el servidor', () => {
  it('applies the reciprocal surcharge only to the US, whatever the browser sends', () => {
    expect(aInputs(BASE).reciprocalPct).toBe(RECIPROCAL_TARIFF);
    expect(aInputs({ ...BASE, destino: 'ES' }).reciprocalPct).toBe(0);
    // A reciprocalPct in the body is not part of the schema: it is dropped.
    const conTrampa = entradaSchema.parse({ ...BASE, reciprocalPct: 0 });
    expect('reciprocalPct' in conTrampa).toBe(false);
  });

  it('charges duty on FOB in the US and on CIF elsewhere', () => {
    expect(aInputs(BASE).dutyBase).toBe('fob');
    expect(aInputs({ ...BASE, destino: 'DE' }).dutyBase).toBe('cif');
  });

  it('only quotes US domestic shipping for the US', () => {
    expect(aInputs({ ...BASE, domesticShipUsd: 8 }).domesticShipUsd).toBe(8);
    expect(aInputs({ ...BASE, destino: 'GB', domesticShipUsd: 8 }).domesticShipUsd).toBeNull();
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
  });
});
