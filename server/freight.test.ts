import { describe, expect, it } from 'vitest';
import { CLIENT_TYPES, DISCOUNTS, RATES, ZONES, aggregateWeights, listPrice, precioEnTabla, promedioCombustible, quote, redondearFacturable, resolveZone } from './freight';

// These pin the engine to the published 2026 export rate table (express
// worldwide service, packages, from Colombia), so a bad edit to
// freightData.json or to the arithmetic changes a test, not a customer's
// price. The expected numbers are copied from the printed table.

describe('the data', () => {
  it('has the two client types with their discounts', () => {
    expect(CLIENT_TYPES).toEqual(['Normal', 'VIP']);
    expect(DISCOUNTS).toEqual({ normal: 10, vip: 25 });
  });

  it('has every destination in one of the seven zones, with no duplicate id', () => {
    expect(Object.keys(RATES).sort()).toEqual(['1', '2', '3', '4', '5', '6', '7']);
    expect(ZONES.length).toBeGreaterThan(200);
    expect(new Set(ZONES.map((z) => z.id)).size).toBe(ZONES.length);
    for (const z of ZONES) expect(RATES[z.zone], `${z.country_es} → zona ${z.zone}`).toBeDefined();
  });

  it('puts the countries where the rate guide puts them', () => {
    const zona = (code: string) => ZONES.filter((z) => z.country_code === code).map((z) => z.zone);
    expect(zona('BR')).toEqual(['1']);
    expect(zona('PE')).toEqual(['1']);
    expect(zona('MX')).toEqual(['3']);
    expect(zona('CA')).toEqual(['3']);
    expect(zona('PR')).toEqual(['3']);
    expect(zona('CL')).toEqual(['4']);
    expect(zona('ES')).toEqual(['5']);
    expect(zona('GB')).toEqual(['5']);
    expect(zona('CN')).toEqual(['6']);
    expect(zona('AU')).toEqual(['7']);
    expect(zona('CO')).toEqual([]); // the origin is not a destination
  });

  it('every published weight from 10 to 70 kg equals the previous one plus the per-kilo charges', () => {
    // This is what caught any misread digit when the table was transcribed:
    // the guide prints both the prices and the per-0.5/1 kg increments.
    for (const zone of Object.keys(RATES)) {
      const t = new Map(RATES[zone].table);
      const hasta10 = { ...RATES[zone], table: RATES[zone].table.filter(([kg]) => kg <= 10) };
      for (const w of [11, 15, 20, 21, 25, 30, 40, 50, 60, 70]) {
        expect(precioEnTabla(hasta10, w), `zona ${zone}, ${w} kg`).toBeCloseTo(t.get(w)!, 2);
      }
    }
  });

  it('list prices only go up with weight', () => {
    for (const zone of Object.keys(RATES)) {
      let antes = 0;
      for (let kg = 0.5; kg <= 400; kg += kg < 30 ? 0.5 : 1) {
        const p = listPrice(zone, kg);
        expect(p, `zona ${zone}, ${kg} kg`).toBeGreaterThan(antes);
        antes = p;
      }
    }
  });
});

describe('listPrice', () => {
  it('reads the table where it has the weight', () => {
    expect(listPrice('1', 0.5)).toBe(89.27);
    expect(listPrice('2', 12)).toBe(383.8);
    expect(listPrice('3', 2)).toBe(145.81);
    expect(listPrice('5', 10)).toBe(671.99);
    expect(listPrice('7', 70)).toBe(3811.09);
  });

  it('adds the per-half-kilo charge between published weights up to 30 kg', () => {
    // Zone 2, 10.5 kg: 347.20 + 9.15
    expect(listPrice('2', 10.5)).toBe(356.35);
    // Zone 3, 20.5 kg: 541.74 + 9.03
    expect(listPrice('3', 20.5)).toBe(550.77);
  });

  it('adds the per-kilo charge of each tranche above 30 kg', () => {
    // Zone 3, 35 kg: 722.34 + 5 × 18.14
    expect(listPrice('3', 35)).toBe(813.04);
    // Zone 2, 100 kg: 1,404.60 + 30 × 20.79
    expect(listPrice('2', 100)).toBe(2028.3);
    // Zone 3, 301 kg: 1,447.94 + 230 × 24.65 + 1 × 27.15
    expect(listPrice('3', 301)).toBe(7144.59);
  });

  it('refuses more than 3,000 kg', () => {
    expect(listPrice('1', 3000)).toBeGreaterThan(0);
    expect(() => listPrice('1', 3001)).toThrow(/3\.000 kg/);
  });
});

describe('resolveZone', () => {
  it('tells Miami from the rest of the United States by id', () => {
    expect(resolveZone('196')).toBe('3');
    expect(resolveZone('197')).toBe('2');
    // The ISO code is ambiguous: first row wins.
    expect(resolveZone('US')).toBe('3');
  });

  it('also accepts an ISO code or an exact name, and rejects the unknown', () => {
    expect(resolveZone('ES')).toBe(resolveZone('España'));
    expect(resolveZone('Spain')).toBe('5');
    expect(resolveZone('Narnia')).toBeNull();
    expect(resolveZone('')).toBeNull();
  });
});

describe('weights', () => {
  it('rounds the billable weight up: half kilos to 30 kg, whole kilos above', () => {
    expect(redondearFacturable(0.1)).toBe(0.5);
    expect(redondearFacturable(2)).toBe(2);
    expect(redondearFacturable(2.01)).toBe(2.5);
    expect(redondearFacturable(30)).toBe(30);
    expect(redondearFacturable(30.2)).toBe(31);
  });

  it('bills the greater of real and volumetric weight of each piece (divisor 5000)', () => {
    // 40×30×25 cm = 6 kg volumetric; 12 kg real wins.
    expect(aggregateWeights([{ weight: 12, length: 40, width: 30, height: 25 }])).toEqual({ real: 12, volumetric: 6, billable: 12 });
    // 1 kg real in a 50×50×50 box → 25 kg volumetric wins.
    expect(aggregateWeights([{ weight: 1, length: 50, width: 50, height: 50 }])).toEqual({ real: 1, volumetric: 25, billable: 25 });
  });

  it('rounds each piece to the half kilo, then adds them up', () => {
    // 3 × 1.2 kg = 3 × 1.5 billable = 4.5; plus a 0.3 kg piece → 0.5.
    const w = aggregateWeights([{ weight: 1.2, quantity: 3 }, { weight: 0.3 }]);
    expect(w.real).toBeCloseTo(3.9, 6);
    expect(w.billable).toBe(5);
  });
});

const HOY = new Date('2026-10-01T15:00:00Z');

describe('promedioCombustible', () => {
  it('weights each published percentage by the days it was in force', () => {
    // 30 days at 20 % and 10 days at 30 % → (600 + 300) / 40 = 22.5 %
    const p = promedioCombustible(
      [
        { from: '2026-08-01', to: '2026-08-30', export_pct: 20 },
        { from: '2026-08-31', to: '2026-09-09', export_pct: 30 },
      ],
      HOY
    );
    expect(p).toEqual({ pct: 22.5, desde: '2025-10-02', hasta: '2026-10-01', dias: 40 });
  });

  it('only counts the last 12 months, and the part of a period inside them', () => {
    const p = promedioCombustible(
      [
        { from: '2024-01-01', to: '2025-09-30', export_pct: 99 }, // entirely before the window
        { from: '2025-10-01', to: '2025-10-02', export_pct: 10 }, // only Oct 2 counts
        { from: '2025-10-03', to: '2025-10-03', export_pct: 40 },
        { from: '2026-10-02', to: '2026-10-08', export_pct: 99 }, // published ahead: not yet in force
      ],
      HOY
    );
    expect(p).toMatchObject({ pct: 25, dias: 2 });
  });

  it('is null with no history, so the quote goes out without the surcharge', () => {
    expect(promedioCombustible([], HOY)).toBeNull();
  });
});

describe('quote', () => {
  it('12 kg to Miami, Normal: list price minus 10%', () => {
    const q = quote({ customerType: 'Normal', destination: '197', packages: [{ weight: 12, length: 40, width: 30, height: 25, quantity: 1 }] }, HOY, []);
    expect(q.zone).toBe('2');
    expect(q.weights.billable).toBe(12);
    expect(q.pricing).toEqual({ list_price: 383.8, discount_percent: 10, discount_amount: 38.38, fuel_percent: null, fuel_amount: 0, final_price: 345.42 });
    expect(q.fuel).toBeNull();
    expect(q.currency).toBe('USD');
  });

  it('5 kg to the rest of the US, VIP: list price minus 25% (case-insensitive type)', () => {
    const q = quote({ customerType: 'vip', destination: '196', packages: [{ weight: 5 }] }, HOY, []);
    expect(q.zone).toBe('3');
    expect(q.pricing).toEqual({ list_price: 240.24, discount_percent: 25, discount_amount: 60.06, fuel_percent: null, fuel_amount: 0, final_price: 180.18 });
  });

  it('adds the 12-month average fuel surcharge on top of the discounted price', () => {
    const historial = [{ from: '2025-10-02', to: '2026-10-01', export_pct: 30 }];
    const q = quote({ customerType: 'Normal', destination: '197', packages: [{ weight: 12 }] }, HOY, historial);
    // 345.42 × 30 % = 103.626 → 103.63
    expect(q.pricing).toEqual({ list_price: 383.8, discount_percent: 10, discount_amount: 38.38, fuel_percent: 30, fuel_amount: 103.63, final_price: 449.05 });
    expect(q.fuel).toEqual({ desde: '2025-10-02', hasta: '2026-10-01' });
  });

  it('refuses what it cannot price', () => {
    expect(() => quote({ customerType: 'Multiplicador', destination: '196', packages: [{ weight: 1 }] })).toThrow(/tipo de cliente/);
    expect(() => quote({ customerType: 'VIP', destination: '196', packages: [{ weight: 0 }] })).toThrow(/paquete/);
    expect(() => quote({ customerType: 'VIP', destination: 'Narnia', packages: [{ weight: 1 }] })).toThrow(/destino/);
    expect(() => quote({ customerType: 'VIP', destination: '196', packages: [{ weight: 1001, quantity: 3 }] })).toThrow(/aparte/);
  });
});
