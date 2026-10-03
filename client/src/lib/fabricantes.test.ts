import { describe, expect, it } from 'vitest';
import { aLista, extenderUnMes } from './fabricantes';

describe('extenderUnMes', () => {
  it('adds a month from today when the listing is off or expired', () => {
    expect(extenderUnMes(null, '2026-10-03')).toBe('2026-11-03');
    expect(extenderUnMes('2026-09-01', '2026-10-03')).toBe('2026-11-03');
  });

  it('adds a month on top of a listing that is still running', () => {
    expect(extenderUnMes('2026-10-20', '2026-10-03')).toBe('2026-11-20');
  });

  it('stays on the last day when the next month is shorter', () => {
    expect(extenderUnMes('2027-01-31', '2026-10-03')).toBe('2027-02-28');
    expect(extenderUnMes('2026-12-31', '2026-10-03')).toBe('2027-01-31');
  });
});

it('aLista splits by commas, semicolons or lines', () => {
  expect(aLista('33, 3401;\n shampoo ,,')).toEqual(['33', '3401', 'shampoo']);
});
