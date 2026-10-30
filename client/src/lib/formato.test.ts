import { describe, expect, it } from 'vitest';
import { csvAObjetos, hace, iniciales, leerCSV, transportista, usd } from '../portal/format';

describe('formatos del portal', () => {
  it('formatea dólares con centavos', () => { expect(usd(1284.5)).toBe('$1,284.50'); expect(usd(null)).toBe('$0.00'); expect(usd('12')).toBe('$12.00'); });
  it('dice hace cuánto pasó algo', () => {
    const t = Date.parse('2026-10-30T12:00:00Z');
    expect(hace('2026-10-30T11:59:50Z', t)).toBe('justo ahora');
    expect(hace('2026-10-30T11:30:00Z', t)).toBe('hace 30 min');
    expect(hace('2026-10-30T09:00:00Z', t)).toBe('hace 3 h');
    expect(hace('2026-10-29T09:00:00Z', t)).toBe('ayer');
    expect(hace('2026-10-20T12:00:00Z', t)).toBe('hace 10 d');
  });
  it('saca las iniciales del nombre o del correo', () => { expect(iniciales('Ana María Gómez')).toBe('AG'); expect(iniciales(null, 'zeta@x.co')).toBe('Z'); expect(iniciales('')).toBe('?'); });
  it('reconoce el transportista por el formato de la guía', () => {
    expect(transportista('1Z999AA10123456784')?.nombre).toBe('UPS');
    expect(transportista('9400111899223344556677')?.nombre).toBe('USPS');
    expect(transportista('TBA314159265')?.nombre).toBe('Amazon Logistics');
    expect(transportista('772123456789')?.nombre).toBe('Courier');
    expect(transportista('hola')).toBeNull();
  });
  it('lee CSV con comillas, comas, saltos de línea dentro de campos y punto y coma', () => {
    expect(leerCSV('a,b\n"x, y","l1\nl2"\n')).toEqual([['a', 'b'], ['x, y', 'l1\nl2']]);
    expect(leerCSV('a;b\r\n1;2\r\n')).toEqual([['a', 'b'], ['1', '2']]);
    expect(leerCSV('﻿a,b\n"di ""hola""",2')).toEqual([['a', 'b'], ['di "hola"', '2']]);
    expect(csvAObjetos('SKU,Descripción\nA1,Hola')).toEqual([{ sku: 'A1', descripcion: 'Hola' }]);
  });
});
