import { describe, expect, it } from 'vitest';
import { CATALOG, PLAN_IDS, copDisplay, priceOf, usdCentsToCopCents } from './catalog';
import { buildSystemPrompt } from './chat';

// El catálogo es lo que le cobra a un cliente real. Estas pruebas fijan
// los números que ya están publicados en la web: si alguien toca la tasa
// o el redondeo, se entera acá y no en el extracto bancario.

describe('de dólares a pesos', () => {
  it('9.99 dólares son los $39.900 que dice la web', () => {
    expect(usdCentsToCopCents(999, 4000)).toBe(3_990_000);
    expect(copDisplay(3_990_000)).toBe('$39.900 COP');
  });

  it('redondea hacia abajo a la centena, nunca hacia arriba', () => {
    // 9.99 × 4000 = 39.960 pesos. Al alza serían $40.000: un peso más
    // caro que el precio publicado, en todas las compras.
    expect(usdCentsToCopCents(999, 4000) / 100).toBe(39_900);
    expect(usdCentsToCopCents(49900, 4000) / 100).toBe(1_996_000);
  });

  it('la tasa se puede cambiar sin tocar el código', () => {
    expect(priceOf('analisis_mercado', { USD_COP_RATE: '4500' })!.amountInCents / 100).toBe(2_245_500);
  });

  it('un precio fijado en pesos manda sobre la conversión', () => {
    const price = priceOf('creditos_marco_polo', { PRICE_CREDITOS_MARCO_POLO_COP: '50000' })!;
    expect(price.amountInCents).toBe(5_000_000);
    expect(price.displayCop).toBe('$50.000 COP');
  });
});

describe('el catálogo', () => {
  it('cobra en pesos, siempre', () => {
    for (const plan of PLAN_IDS) {
      const price = priceOf(plan, {});
      if (price) expect(price.currency, plan).toBe('COP');
    }
  });

  it('el plan a medida no tiene precio, y por eso no se puede comprar de un botón', () => {
    expect(CATALOG.acompanamiento.usdCents).toBeNull();
    expect(priceOf('acompanamiento', {})).toBeNull();
  });

  it('todo lo demás sí tiene precio', () => {
    for (const plan of PLAN_IDS) {
      if (plan === 'acompanamiento') continue;
      expect(priceOf(plan, {}), plan).not.toBeNull();
    }
  });

  it('el paquete de consultas promete en la etiqueta lo que entrega', () => {
    const credits = CATALOG.creditos_marco_polo.grants!.researchCredits;
    expect(CATALOG.creditos_marco_polo.label).toContain(String(credits));
    expect(CATALOG.creditos_marco_polo.labelEn).toContain(String(credits));
  });
});

describe('el guion de Marco Polo', () => {
  const prompt = buildSystemPrompt();

  it('nunca nombra de dónde salen los datos', () => {
    // Si un cliente aprende el nombre del proveedor, se va directo a
    // contratarlo. Esta es la prueba que impide que se le escape.
    expect(prompt.toLowerCase()).not.toContain('kalodata');
    expect(prompt.toLowerCase()).not.toContain('sicex');
  });

  it('lleva los precios del catálogo, no una copia vieja', () => {
    expect(prompt).toContain('$39.900 COP');
    expect(prompt).toContain('USD 9.99');
    expect(prompt).toContain('USD 499');
    expect(prompt).not.toContain('6.90');
  });

  it('le prohíbe inventar', () => {
    expect(prompt).toMatch(/nunca inventes/i);
  });
});
