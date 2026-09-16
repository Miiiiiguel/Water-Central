/**
 * EasyComex — Motor de cotización (réplica de EasyComex Calculator v2.2.4)
 * ---------------------------------------------------------------------------
 * Reproduce EXACTAMENTE la lógica de Engine.php / TariffRepository.php /
 * VolumetricCalculator.php para que tu servidor (Wompi, /diagnostico) cotice
 * igual que la calculadora de WordPress.
 *
 * Uso (Node):
 *   const EasyComexPricing = require('./easycomex-pricing');
 *   const data = require('./easycomex-data.json');
 *   const pricing = new EasyComexPricing(data);
 *
 *   const quote = pricing.quote({
 *     customerType: 'VIP',
 *     destination: 'US',            // acepta _ID, código ISO, o nombre (ES/EN)
 *     packages: [
 *       { weight: 12, length: 40, width: 30, height: 25, quantity: 1 },
 *     ],
 *   });
 *   console.log(quote);
 *
 * ESM: import EasyComexPricing from './easycomex-pricing.js' funciona vía
 * interoperabilidad de Node con CommonJS (default = module.exports).
 */

class CalculationError extends Error {}

class EasyComexPricing {
  constructor(data) {
    if (!data || !data.tariffs || !data.zones || !data.client_types) {
      throw new Error('Bundle inválido: falta tariffs / zones / client_types.');
    }
    this.settings = Object.assign(
      {
        volumetric_divisor: 5000,
        weight_aggregation: 'sum_max',
        min_billable_weight: 0,
        currency: 'COP',
        currency_symbol: '$',
      },
      data.settings || {}
    );

    // Tipos de cliente -> descuento (clave en minúsculas, como CustomerRepository).
    this.discounts = {};
    for (const c of data.client_types) {
      if (c.type && String(c.type).trim() !== '') {
        this.discounts[String(c.type).trim().toLowerCase()] = Number(c.discount_percent) || 0;
      }
    }

    this.zonesRows = data.zones;

    // Tarifas agrupadas por zona, ordenadas por límite inferior.
    this.tariffsByZone = {};
    for (const [zone, brackets] of Object.entries(data.tariffs)) {
      const z = zone.toUpperCase();
      this.tariffsByZone[z] = brackets
        .map((b) => ({
          min: Number(b.min),
          max: Number(b.max),
          price: Number(b.price),
          multiplier: b.multiplier === true || b.multiplier === 'true' || b.multiplier === 1 || b.multiplier === '1',
        }))
        .sort((a, b) => a.min - b.min);
    }
  }

  // ---- Tipo de cliente -----------------------------------------------------

  isValidType(type) {
    return Object.prototype.hasOwnProperty.call(this.discounts, String(type).trim().toLowerCase());
  }

  discountFor(type) {
    return this.discounts[String(type).trim().toLowerCase()] ?? 0;
  }

  clientTypes() {
    return Object.entries(this.discounts)
      .map(([label, discount]) => ({ value: label, discount }))
      .sort((a, b) => a.discount - b.discount);
  }

  // ---- Zonificador ---------------------------------------------------------

  /** Resuelve zona desde _ID, código ISO, o nombre (ES/EN). Igual que ZoneRepository. */
  resolveZone(destination) {
    const dest = String(destination).trim();
    if (dest === '') return null;

    // 1. _ID exacto.
    for (const r of this.zonesRows) {
      if (String(r.id) === dest) return (r.zone || '').toUpperCase() || null;
    }
    const needle = dest.toLowerCase();
    // 2. Código ISO.
    for (const r of this.zonesRows) {
      if (String(r.country_code || '').toLowerCase() === needle) {
        return (r.zone || '').toUpperCase() || null;
      }
    }
    // 3. Nombre ES o EN.
    for (const r of this.zonesRows) {
      if (
        String(r.country_es || '').toLowerCase() === needle ||
        String(r.country_en || '').toLowerCase() === needle
      ) {
        return (r.zone || '').toUpperCase() || null;
      }
    }
    return null;
  }

  countryLabel(destination) {
    const dest = String(destination).trim();
    for (const r of this.zonesRows) {
      if (String(r.id) === dest) return r.country_es || r.country_en || dest;
    }
    return dest;
  }

  hasZone(zone) {
    return Object.prototype.hasOwnProperty.call(this.tariffsByZone, String(zone).toUpperCase());
  }

  // ---- Pesos ---------------------------------------------------------------

  aggregateWeights(packages) {
    const divisor = Math.max(1, this.settings.volumetric_divisor);
    const strategy = this.settings.weight_aggregation === 'per_piece_max' ? 'per_piece_max' : 'sum_max';

    let totalReal = 0;
    let totalVol = 0;
    let perPieceBillable = 0;

    for (const p of packages) {
      const qty = Math.max(1, parseInt(p.quantity ?? 1, 10) || 1);
      const w = Number(p.weight) || 0;
      const L = Number(p.length) || 0;
      const W = Number(p.width) || 0;
      const H = Number(p.height) || 0;

      const real = w * qty;
      const vol = divisor > 0 ? ((L * W * H) / divisor) * qty : 0;

      totalReal += real;
      totalVol += vol;

      const singleReal = w;
      const singleVol = qty > 0 ? vol / qty : 0;
      perPieceBillable += Math.max(singleReal, singleVol) * qty;
    }

    const billable = strategy === 'per_piece_max' ? perPieceBillable : Math.max(totalReal, totalVol);
    return { real: totalReal, volumetric: totalVol, billable };
  }

  // ---- Tarifa --------------------------------------------------------------

  /** Igual que TariffRepository::findBracket. Bandas [min, max): min inclusivo, max exclusivo. */
  findBracket(zone, weight) {
    const brackets = this.tariffsByZone[String(zone).toUpperCase()];
    if (!brackets) return null;

    const w = Math.max(0, weight);
    const eps = 0.0001;
    const contains = (b) => w >= b.min - eps && w < b.max - eps;

    // 1. Banda plana que contiene el peso.
    for (const b of brackets) if (!b.multiplier && contains(b)) return b;
    // 2. Banda por-kilo que contiene el peso.
    for (const b of brackets) if (b.multiplier && contains(b)) return b;
    // 3. Fallback: la banda más alta definida.
    return brackets.length ? brackets[brackets.length - 1] : null;
  }

  // ---- Cotización ----------------------------------------------------------

  isValidPackage(p) {
    const w = Number(p.weight) || 0;
    const L = Number(p.length) || 0;
    const W = Number(p.width) || 0;
    const H = Number(p.height) || 0;
    return w > 0 || (L > 0 && W > 0 && H > 0);
  }

  quote({ customerType, origin = '', destination, packages = [] }) {
    if (!this.isValidType(customerType)) {
      throw new CalculationError('El tipo de cliente no es válido.');
    }

    const valid = (packages || []).filter((p) => this.isValidPackage(p));
    if (valid.length === 0) {
      throw new CalculationError('Agrega al menos un paquete con peso o medidas válidas.');
    }

    const zone = this.resolveZone(destination);
    if (zone === null || !this.hasZone(zone)) {
      throw new CalculationError('No hay tarifas disponibles para el destino seleccionado.');
    }

    const weights = this.aggregateWeights(valid);
    const billable = Math.max(weights.billable, this.settings.min_billable_weight);

    const bracket = this.findBracket(zone, billable);
    if (bracket === null) {
      throw new CalculationError('No se encontró una tarifa para el peso facturable.');
    }

    let basePrice;
    let unitRate;
    if (bracket.multiplier) {
      basePrice = bracket.price * billable;
      unitRate = bracket.price;
    } else {
      basePrice = bracket.price;
      unitRate = 0;
    }

    const discountPercent = this.discountFor(customerType);
    const discountAmount = basePrice * (discountPercent / 100);
    const finalPrice = Math.max(0, basePrice - discountAmount);

    return {
      customer_type: customerType,
      origin: origin !== '' ? origin : 'Colombia',
      destination: this.countryLabel(destination),
      zone,
      weights: {
        real: round(weights.real, 3),
        volumetric: round(weights.volumetric, 3),
        billable: round(billable, 3),
      },
      pricing: {
        is_multiplier: bracket.multiplier,
        unit_rate: round(unitRate, 2),
        base_price: Math.round(basePrice),
        discount_percent: round(discountPercent, 2),
        discount_amount: Math.round(discountAmount),
        final_price: Math.round(finalPrice),
      },
      currency: this.settings.currency,
      currency_symbol: this.settings.currency_symbol,
    };
  }
}

function round(n, decimals) {
  const f = Math.pow(10, decimals);
  return Math.round((n + Number.EPSILON) * f) / f;
}

EasyComexPricing.CalculationError = CalculationError;

module.exports = EasyComexPricing;
module.exports.EasyComexPricing = EasyComexPricing;
module.exports.CalculationError = CalculationError;
