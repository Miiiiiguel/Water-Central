import { describe, expect, it } from 'vitest';
import { cotizar, saldoDe, type Tarifa } from './casillero';

const tarifas: Tarifa[] = [
  { id: 1, libras_desde: 1, libras_hasta: 3, rec_oficina: 6, local: 9.36, regional: 10.06, nacional: 12.67 },
  { id: 2, libras_desde: 4, libras_hasta: 5, rec_oficina: 10, local: 13.36, regional: 14.06, nacional: 16.67 },
];

describe('casillero', () => {
  it('cotiza redondeando las libras hacia arriba', () => {
    expect(cotizar(tarifas, 3, 'local')).toBe(9.36);
    expect(cotizar(tarifas, 3.2, 'local')).toBe(13.36);
    expect(cotizar(tarifas, 0.4, 'nacional')).toBe(12.67);
  });
  it('no cotiza lo que la tabla no cubre', () => {
    expect(cotizar(tarifas, 12, 'local')).toBeNull();
  });
  it('el saldo suma solo movimientos aprobados', () => {
    expect(saldoDe([
      { monto: 50, estado: 'aprobado' }, { monto: -9.36, estado: 'aprobado' },
      { monto: 100, estado: 'pendiente' }, { monto: 20, estado: 'rechazado' },
    ])).toBeCloseTo(40.64);
  });
});
