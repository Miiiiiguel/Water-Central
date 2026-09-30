import { describe, expect, it } from 'vitest';
import { CLIENT_TYPES, DISCOUNTS, TARIFFS, ZONES, aggregateWeights, findBracket, quote, resolveZone } from './freight';

// These pin the engine to the plugin it replaces (EasyComex Calculator
// v2.2.4) and to the exported data, so a bad edit to freightData.json or
// to the arithmetic changes a test, not a customer's price.

describe('the data', () => {
  it('has the three client types with their real discounts', () => {
    expect(CLIENT_TYPES).toEqual(['Normal', 'Multiplicador', 'VIP']);
    expect(DISCOUNTS).toEqual({ normal: 30, multiplicador: 40, vip: 50 });
  });

  it('has 211 destinations across the nine zones', () => {
    expect(ZONES).toHaveLength(211);
    expect(Object.keys(TARIFFS).sort()).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']);
  });

  it('has no gap in any zone from 0 to 10 000 kg', () => {
    for (const [zone, brackets] of Object.entries(TARIFFS)) {
      // Every 0.5 kg step up to 21 kg must hit a flat band; above that a per-kilo band.
      for (let w = 0; w < 21; w += 0.25) {
        const b = findBracket(zone, w)!;
        expect(b.multiplier, `${zone} ${w}kg fell through to per-kilo`).toBe(false);
        expect(w >= b.min && w < b.max, `${zone} ${w}kg → [${b.min},${b.max})`).toBe(true);
      }
      for (const w of [21, 44.9, 45, 70, 71, 99, 100, 299, 300, 999, 1000, 9999]) {
        const b = findBracket(zone, w)!;
        expect(b.multiplier).toBe(true);
        expect(w >= b.min && w < b.max).toBe(true);
      }
      expect(brackets).toHaveLength(48);
    }
  });

  it('carries the Zone F [18, 18.5) band the WordPress table was missing', () => {
    const b = findBracket('F', 18.2)!;
    expect(b).toMatchObject({ min: 18, max: 18.5, price: 2232851, multiplier: false });
  });
});

describe('resolveZone', () => {
  it('tells Miami from the rest of the United States by _ID', () => {
    expect(resolveZone('196')).toBe('B');
    expect(resolveZone('197')).toBe('I');
    // The ISO code is ambiguous: first row wins, as in the plugin.
    expect(resolveZone('US')).toBe('B');
  });

  it('also accepts an ISO code or an exact name, and rejects the unknown', () => {
    expect(resolveZone('CO')).toBe(resolveZone('Colombia'));
    expect(resolveZone('Afganistán')).toBe('H');
    expect(resolveZone('Afghanistan')).toBe('H');
    expect(resolveZone('Narnia')).toBeNull();
    expect(resolveZone('')).toBeNull();
  });
});

describe('aggregateWeights', () => {
  it('bills the greater of real and volumetric weight (sum_max, divisor 5000)', () => {
    // 40×30×25 cm = 30 000 cm³ → 6 kg volumetric; 12 kg real wins.
    expect(aggregateWeights([{ weight: 12, length: 40, width: 30, height: 25 }])).toEqual({ real: 12, volumetric: 6, billable: 12 });
    // 1 kg real in a 50×50×50 box → 25 kg volumetric wins.
    expect(aggregateWeights([{ weight: 1, length: 50, width: 50, height: 50 }])).toEqual({ real: 1, volumetric: 25, billable: 25 });
  });

  it('multiplies by quantity and sums across packages', () => {
    const w = aggregateWeights([{ weight: 2, quantity: 3 }, { weight: 1.5 }]);
    expect(w.real).toBe(7.5);
    expect(w.billable).toBe(7.5);
  });
});

describe('findBracket', () => {
  it('treats bands as [min, max): 10 kg is in [10, 10.5), not [9.5, 10)', () => {
    const b = findBracket('B', 10)!;
    expect(b.min).toBe(10);
    expect(b.max).toBe(10.5);
  });

  it('falls back to the highest band for absurd weights', () => {
    const b = findBracket('B', 999999)!;
    expect(b.min).toBe(1000);
  });
});

describe('quote', () => {
  it('reproduces the README example: 12 kg to the US (not Miami), VIP', () => {
    const q = quote({ customerType: 'VIP', destination: '196', packages: [{ weight: 12, length: 40, width: 30, height: 25, quantity: 1 }] });
    const band = findBracket('B', 12)!;
    expect(q.zone).toBe('B');
    expect(q.weights.billable).toBe(12);
    expect(q.pricing.is_multiplier).toBe(false);
    expect(q.pricing.base_price).toBe(band.price);
    expect(q.pricing.discount_percent).toBe(50);
    expect(q.pricing.final_price).toBe(Math.round(band.price * 0.5));
    expect(q.currency).toBe('COP');
  });

  it('charges per kilo above 21 kg', () => {
    const q = quote({ customerType: 'Normal', destination: '197', packages: [{ weight: 30 }] });
    expect(q.zone).toBe('I');
    expect(q.pricing.is_multiplier).toBe(true);
    expect(q.pricing.unit_rate).toBe(41936);
    expect(q.pricing.base_price).toBe(Math.round(41936 * 30));
    expect(q.pricing.final_price).toBe(Math.round(41936 * 30 * 0.7));
  });

  it('applies Normal 30 / Multiplicador 40 / VIP 50', () => {
    const base = (t: string) => quote({ customerType: t, destination: '196', packages: [{ weight: 5 }] }).pricing;
    const b = base('Normal').base_price;
    expect(base('Normal').final_price).toBe(Math.round(b * 0.7));
    expect(base('Multiplicador').final_price).toBe(Math.round(b * 0.6));
    expect(base('vip').final_price).toBe(Math.round(b * 0.5)); // case-insensitive, like the plugin
  });

  it('refuses what the plugin refuses', () => {
    expect(() => quote({ customerType: 'Gold', destination: '196', packages: [{ weight: 1 }] })).toThrow(/tipo de cliente/);
    expect(() => quote({ customerType: 'VIP', destination: '196', packages: [{ weight: 0 }] })).toThrow(/paquete/);
    expect(() => quote({ customerType: 'VIP', destination: 'Narnia', packages: [{ weight: 1 }] })).toThrow(/destino/);
  });

  it('matches the JS reference engine on a sweep of inputs', async () => {
    // The vendor's own CommonJS engine (kept as a fixture), run against the same data.
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    const Ref = require('./fixtures/easycomex-pricing.reference.cjs');
    const data = require('./freightData.json');
    const ref = new Ref(data);
    for (const dest of ['1', '5', '196', '197', '50', '120'])
      for (const type of ['Normal', 'Multiplicador', 'VIP'])
        for (const w of [0.3, 0.5, 2.25, 10, 17.9, 18.2, 20.9, 21, 33.3, 71, 250, 1500]) {
          const mine = quote({ customerType: type, destination: dest, packages: [{ weight: w, length: 20, width: 20, height: 20 }] });
          const theirs = ref.quote({ customerType: type, destination: dest, packages: [{ weight: w, length: 20, width: 20, height: 20 }] });
          expect(mine.pricing, `${dest}/${type}/${w}`).toEqual(theirs.pricing);
          expect(mine.weights).toEqual(theirs.weights);
          expect(mine.zone).toBe(theirs.zone);
        }
  });
});
