import { describe, expect, it } from 'vitest';
import { china301, esTextil, recargoAdicional } from './recargos';

const caso = (o: Partial<Parameters<typeof recargoAdicional>[0]>) =>
  recargoAdicional({ destino: 'US', origen: 'CO', codigo: null, califica: false, ...o });

describe('recargoAdicional', () => {
  it('charges the forced-labor 301 by origin: 12.5 %, 10 % or nothing', () => {
    expect(caso({})).toBe(0.125);
    expect(caso({ origen: 'PE' })).toBe(0.125);
    expect(caso({ origen: 'EC' })).toBe(0.1);
    expect(caso({ origen: 'AR' })).toBe(0.1);
    expect(caso({ origen: 'PA' })).toBe(0);
    expect(caso({ origen: 'BO' })).toBe(0);
  });

  it('is a US measure only', () => {
    expect(caso({ destino: 'DE' })).toBe(0);
    expect(caso({ destino: 'GB', origen: 'CN' })).toBe(0);
  });

  it('is not waived by the Colombia, Peru or Chile agreements', () => {
    expect(caso({ califica: true, codigo: '6109.10.00.04' })).toBe(0.125);
    expect(caso({ origen: 'PE', califica: true })).toBe(0.125);
    expect(caso({ origen: 'CL', califica: true })).toBe(0.125);
  });

  it('is waived for USMCA-qualifying goods and CAFTA-DR qualifying textiles', () => {
    expect(caso({ origen: 'MX', califica: true })).toBe(0);
    expect(caso({ origen: 'MX', califica: false })).toBe(0.1);
    expect(caso({ origen: 'GT', califica: true, codigo: '6109.10.00' })).toBe(0);
    // A CAFTA product that is not a textile still pays.
    expect(caso({ origen: 'CR', califica: true, codigo: '3304.99.50' })).toBe(0.125);
    // A CAFTA textile that does not qualify pays.
    expect(caso({ origen: 'DO', califica: false, codigo: '6109.10.00' })).toBe(0.125);
  });

  it('excludes coffee, cocoa, bananas, oil, gold and medicines for every origin', () => {
    expect(caso({ codigo: '0901.21.00' })).toBe(0);
    expect(caso({ codigo: '0803.90.00' })).toBe(0);
    expect(caso({ codigo: '1806.32.10' })).toBe(0);
    expect(caso({ codigo: '2709.00.20' })).toBe(0);
    expect(caso({ codigo: '7108.12.50' })).toBe(0);
    expect(caso({ codigo: '3004.90.92' })).toBe(0);
    // Flowers are not on the list.
    expect(caso({ codigo: '0603.11.00' })).toBe(0.125);
  });

  it('adds the China 301 lists on top of the forced-labor duty', () => {
    expect(caso({ origen: 'CN', codigo: '6109.10.00' })).toBeCloseTo(0.125 + 0.075, 9);
    expect(caso({ origen: 'CN', codigo: '9403.60.80' })).toBeCloseTo(0.125 + 0.25, 9);
    expect(caso({ origen: 'CN', codigo: '9503.00.00' })).toBeCloseTo(0.125, 9);
    // Excluded from the forced-labor duty, still on the China list.
    expect(caso({ origen: 'CN', codigo: '0901.21.00' })).toBeCloseTo(0.25, 9);
  });
});

describe('china301', () => {
  it('uses the longest matching prefix and 25 % otherwise', () => {
    expect(china301('6204.62.40')).toBe(0.075);
    expect(china301('8517.13.00')).toBe(0);
    expect(china301('8517.62.00')).toBe(0.25);
    expect(china301('8703.80.00')).toBe(1);
    expect(china301(null)).toBe(0.25);
  });
});

it('textiles are chapters 50 to 63', () => {
  expect(esTextil('5208.12.40')).toBe(true);
  expect(esTextil('6302.21.90')).toBe(true);
  expect(esTextil('6403.99.60')).toBe(false);
});

describe('the 60 economies', () => {
  it('covers each tier: flat 10 %, flat 12.5 %, and net of the general rate', () => {
    expect(caso({ origen: 'IN' })).toBe(0.1);
    expect(caso({ origen: 'VN' })).toBe(0.125);
    // EU and Taiwan: 10 % minus the line's general rate.
    expect(caso({ origen: 'DE', nmf: 0.04 })).toBeCloseTo(0.06, 9);
    expect(caso({ origen: 'IT', nmf: 0.16 })).toBe(0);
    expect(caso({ origen: 'TW' })).toBe(0.1);
    // Japan, Korea, Switzerland: 12.5 % minus the general rate.
    expect(caso({ origen: 'JP', nmf: 0.025 })).toBeCloseTo(0.1, 9);
    expect(caso({ origen: 'CH', nmf: 0.2 })).toBe(0);
    // Not among the 60.
    expect(caso({ origen: 'FJ' })).toBe(0);
  });

  it('waives it for USMCA goods from Canada and qualifying Jordan textiles', () => {
    expect(caso({ origen: 'CA', califica: true })).toBe(0);
    expect(caso({ origen: 'CA' })).toBe(0.1);
    expect(caso({ origen: 'JO', califica: true, codigo: '6110.20.20' })).toBe(0);
    expect(caso({ origen: 'JO', califica: true, codigo: '3304.99.50' })).toBe(0.1);
  });
});
