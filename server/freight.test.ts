import { describe, expect, it } from 'vitest';
import { CLIENT_TYPES, DISCOUNTS, DISCOUNTS_IMPORT, RATES, RATES_IMPORT, ZONES, aggregateWeights, listPrice, precioEnTabla, promedioCombustible, quote, redondearFacturable, resolveZone } from './freight';

// These pin the engine to the rate tables, so a bad edit to
// freightData.json or to the arithmetic changes a test, not a customer's
// price. Export: the 2026 client rates from Colombia, in pesos, zones A to
// I (Tarifas_clientes PUBLICAS / VIP). Import: the 2026 public rates to
// Colombia, in dollars, zones 1 to 7. The expected numbers are copied
// from those tables.

describe('the data', () => {
  it('has the two client types, with their export and import discounts', () => {
    expect(CLIENT_TYPES).toEqual(['Normal', 'VIP']);
    // Export: "Tarifa Descuento" is the list price × 0.85 (public) and × 0.62 (VIP).
    expect(DISCOUNTS).toEqual({ normal: 15, vip: 38 });
    expect(DISCOUNTS_IMPORT).toEqual({ normal: 10, vip: 25 });
  });

  it('has every destination in a zone of each table, or none, with no duplicate id', () => {
    expect(Object.keys(RATES).sort()).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']);
    expect(ZONES.length).toBeGreaterThan(200);
    expect(new Set(ZONES.map((z) => z.id)).size).toBe(ZONES.length);
    for (const z of ZONES) {
      if (z.zone) expect(RATES[z.zone], `${z.country_es} → zona ${z.zone}`).toBeDefined();
      if (z.zone_import) expect(RATES_IMPORT[z.zone_import], `${z.country_es} → zona ${z.zone_import}`).toBeDefined();
    }
    expect(ZONES.filter((z) => z.zone).length).toBeGreaterThan(200);
  });

  it('puts the countries where the export zone list puts them', () => {
    const zona = (code: string) => ZONES.filter((z) => z.country_code === code).map((z) => z.zone);
    expect(zona('VE')).toEqual(['A']);
    expect(zona('MX')).toEqual(['B']);
    expect(zona('CA')).toEqual(['B']);
    expect(zona('BR')).toEqual(['C']);
    expect(zona('AR')).toEqual(['C']);
    expect(zona('ES')).toEqual(['F']);
    expect(zona('GB')).toEqual(['F']);
    expect(zona('AU')).toEqual(['G']);
    expect(zona('KR')).toEqual(['G']);
    expect(zona('CO')).toEqual([]); // the origin is not a destination
    // Not in the export list: quoted apart.
    expect(zona('CU')).toEqual(['']);
  });

  it('export prices only go down where the published table does, and per kilo with more kilos', () => {
    // The client rate table itself is cheaper at 10.5 kg than at 10 kg in
    // zones B and I (both files say so). Those are the only drops: a new
    // one means a misread or a bad edit.
    const bajas: string[] = [];
    for (const zone of Object.keys(RATES)) {
      let antes = 0;
      for (const [kg, precio] of RATES[zone].table) {
        if (precio < antes) bajas.push(`${zone} ${kg}`);
        antes = precio;
      }
      let porKilo = Infinity;
      for (const t of RATES[zone].por_kg!) {
        expect(t.precio, `zona ${zone}, ${t.desde} kg`).toBeLessThanOrEqual(porKilo);
        porKilo = t.precio;
      }
    }
    expect(bajas).toEqual(['B 10.5', 'I 10.5']);
  });
});

describe('listPrice (export, pesos)', () => {
  it('reads the table where it has the weight', () => {
    expect(listPrice('A', 0.5)).toBe(263074.34);
    expect(listPrice('C', 2)).toBe(414646.28);
    expect(listPrice('B', 12)).toBe(795306.88);
    expect(listPrice('I', 20.5)).toBe(880893.29);
  });

  it('from 21 kg, multiplies the per-kilo rate of the tranche by the weight', () => {
    // Zone B, 25 kg: 49,510 × 25
    expect(listPrice('B', 25)).toBe(1237750);
    // Zone A, 21 kg: 65,663.69 × 21
    expect(listPrice('A', 21)).toBe(1378937.49);
    // Zone H, 300 kg: 102,407.61 × 300
    expect(listPrice('H', 300)).toBe(30722283);
  });

  it('refuses more than 3,000 kg', () => {
    expect(listPrice('A', 3000)).toBeGreaterThan(0);
    expect(() => listPrice('A', 3001)).toThrow(/3\.000 kg/);
  });
});

describe('resolveZone', () => {
  it('tells South Florida from the rest of the United States by id', () => {
    expect(resolveZone('196')).toBe('B');
    expect(resolveZone('197')).toBe('I');
    // The ISO code is ambiguous: first row wins.
    expect(resolveZone('US')).toBe('B');
    // Importing, the import zones.
    expect(resolveZone('196', 'importar')).toBe('3');
    expect(resolveZone('197', 'importar')).toBe('2');
  });

  it('also accepts an ISO code or an exact name, and rejects the unknown', () => {
    expect(resolveZone('ES')).toBe(resolveZone('España'));
    expect(resolveZone('Spain')).toBe('F');
    expect(resolveZone('Narnia')).toBeNull();
    expect(resolveZone('')).toBeNull();
  });
});

describe('weights', () => {
  it('rounds the billable weight up: half kilos to 20.5 kg exporting (30 kg importing), whole kilos above', () => {
    expect(redondearFacturable(0.1)).toBe(0.5);
    expect(redondearFacturable(2)).toBe(2);
    expect(redondearFacturable(2.01)).toBe(2.5);
    expect(redondearFacturable(20.5)).toBe(20.5);
    expect(redondearFacturable(20.6)).toBe(21);
    expect(redondearFacturable(30, 'importar')).toBe(30);
    expect(redondearFacturable(30.2, 'importar')).toBe(31);
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
  it('12 kg to Miami (South Florida), Normal: list price minus 15%, in pesos', () => {
    const q = quote({ customerType: 'Normal', destination: '197', packages: [{ weight: 12, length: 40, width: 30, height: 25, quantity: 1 }] }, HOY, []);
    expect(q.zone).toBe('I');
    expect(q.weights.billable).toBe(12);
    // 660,231.92 → 660,232; −15 % = 99,035 → 561,197 ("Tarifa Descuento", public: 561,197.13)
    expect(q.pricing).toEqual({ list_price: 660232, discount_percent: 15, discount_amount: 99035, fuel_percent: null, fuel_amount: 0, final_price: 561197 });
    expect(q.fuel).toBeNull();
    expect(q.currency).toBe('COP');
  });

  it('5 kg to the rest of the US, VIP: list price minus 38% (case-insensitive type)', () => {
    const q = quote({ customerType: 'vip', destination: '196', packages: [{ weight: 5 }] }, HOY, []);
    expect(q.zone).toBe('B');
    // 511,253.72 → 511,254; −38 % = 194,277 → 316,977 ("Tarifa Descuento", VIP: 316,977.31)
    expect(q.pricing).toEqual({ list_price: 511254, discount_percent: 38, discount_amount: 194277, fuel_percent: null, fuel_amount: 0, final_price: 316977 });
  });

  it('adds the 12-month average fuel surcharge on top of the discounted price', () => {
    const historial = [{ from: '2025-10-02', to: '2026-10-01', export_pct: 30 }];
    const q = quote({ customerType: 'Normal', destination: '197', packages: [{ weight: 12 }] }, HOY, historial);
    // 561,197 × 30 % = 168,359.1 → 168,359
    expect(q.pricing).toEqual({ list_price: 660232, discount_percent: 15, discount_amount: 99035, fuel_percent: 30, fuel_amount: 168359, final_price: 729556 });
    expect(q.fuel).toEqual({ desde: '2025-10-02', hasta: '2026-10-01' });
  });

  it('a destination with no export rate is quoted apart, and says so', () => {
    expect(() => quote({ customerType: 'Normal', destination: 'CU', packages: [{ weight: 1 }] })).toThrow(/aparte/);
  });

  it('refuses what it cannot price', () => {
    expect(() => quote({ customerType: 'Multiplicador', destination: '196', packages: [{ weight: 1 }] })).toThrow(/tipo de cliente/);
    expect(() => quote({ customerType: 'VIP', destination: '196', packages: [{ weight: 0 }] })).toThrow(/paquete/);
    expect(() => quote({ customerType: 'VIP', destination: 'Narnia', packages: [{ weight: 1 }] })).toThrow(/destino/);
    expect(() => quote({ customerType: 'VIP', destination: '196', packages: [{ weight: 1001, quantity: 3 }] })).toThrow(/aparte/);
  });
});

describe('importar (hacia Colombia)', () => {
  it('has its own table, zones 1 to 7, in dollars', () => {
    expect(Object.keys(RATES_IMPORT).sort()).toEqual(['1', '2', '3', '4', '5', '6', '7']);
    const q = quote({ customerType: 'Normal', destination: '196', direction: 'importar', packages: [{ weight: 1 }] }, HOY, []);
    expect(q.currency).toBe('USD');
  });

  it('every published weight from 10 to 70 kg equals the previous one plus the per-kilo charges', () => {
    for (const zone of Object.keys(RATES_IMPORT)) {
      const t = new Map(RATES_IMPORT[zone].table);
      const hasta10 = { ...RATES_IMPORT[zone], table: RATES_IMPORT[zone].table.filter(([kg]) => kg <= 10) };
      for (const w of [11, 15, 20, 21, 25, 30, 40, 50, 60, 70]) {
        expect(precioEnTabla(hasta10, w), `zona ${zone}, ${w} kg`).toBeCloseTo(t.get(w)!, 2);
      }
    }
  });

  it('reads the printed import prices', () => {
    expect(listPrice('1', 0.5, 'importar')).toBe(109.33);
    expect(listPrice('2', 12, 'importar')).toBe(299.8);
    // The cell OCR misread: the guide prints 302.39.
    expect(listPrice('6', 2, 'importar')).toBe(302.39);
    expect(listPrice('7', 70, 'importar')).toBe(3624.84);
    // Zone 3, 35 kg: 736.11 + 5 × 16.71
    expect(listPrice('3', 35, 'importar')).toBe(819.66);
  });

  it('quotes an import from the rest of the US, VIP: list minus 25%', () => {
    const q = quote({ customerType: 'VIP', destination: '196', direction: 'importar', packages: [{ weight: 5 }] }, HOY, []);
    expect(q.direction).toBe('importar');
    expect(q.zone).toBe('3');
    // The import discount stays 25 % for VIP.
    expect(q.pricing).toEqual({ list_price: 236.81, discount_percent: 25, discount_amount: 59.2, fuel_percent: null, fuel_amount: 0, final_price: 177.61 });
  });

  it('exports by default', () => {
    expect(quote({ customerType: 'Normal', destination: '197', packages: [{ weight: 12 }] }, HOY, []).direction).toBe('exportar');
  });
});
