import { describe, expect, it } from 'vitest';
import { cotizar, cotizarTodas, saldoDe, validarTarifas, type Tarifa } from './casillero';

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
  it('sobre la tabla solo cotiza si el equipo fijó el precio por libra extra (igual que la base)', () => {
    expect(cotizar(tarifas, 8, 'nacional', { libra_extra_nacional: '2.5' })).toBe(16.67 + 2.5 * 3);
    expect(cotizar(tarifas, 8, 'local', { libra_extra_nacional: '2.5' })).toBeNull();
    expect(cotizar(tarifas, 8, 'nacional', { libra_extra_nacional: '' })).toBeNull();
    expect(cotizarTodas(tarifas, 2, {})).toEqual({ rec_oficina: 6, local: 9.36, regional: 10.06, nacional: 12.67 });
  });
  it('el saldo suma solo movimientos aprobados', () => {
    expect(saldoDe([
      { monto: 50, estado: 'aprobado' }, { monto: -9.36, estado: 'aprobado' },
      { monto: 100, estado: 'pendiente' }, { monto: 20, estado: 'rechazado' },
    ])).toBeCloseTo(40.64);
  });
});

describe('validarTarifas', () => {
  const f = (d: number, h: number, p = 5) => ({ libras_desde: d, libras_hasta: h, rec_oficina: p, local: p, regional: p, nacional: p });
  it('acepta una tabla continua sin avisos', () => {
    expect(validarTarifas([f(1, 3), f(4, 5), f(6, 9)])).toEqual({ errores: [], avisos: [] });
  });
  it('rechaza rangos al revés, traslapados o con precios inválidos', () => {
    expect(validarTarifas([f(5, 3)]).errores[0]).toMatch(/no puede ser menor/);
    expect(validarTarifas([f(1, 4), f(3, 6)]).errores.join(' ')).toMatch(/se traslapan/);
    expect(validarTarifas([{ ...f(1, 3), local: -1 }]).errores[0]).toMatch(/no es válido/);
    expect(validarTarifas([{ ...f(1, 3), nacional: Number.NaN }]).errores[0]).toMatch(/no es válido/);
    expect(validarTarifas([f(0, 3)]).errores[0]).toMatch(/enteros/);
    expect(validarTarifas([]).errores[0]).toMatch(/al menos un rango/);
  });
  it('avisa de los huecos pero deja guardar, sin importar el orden de las filas', () => {
    const r = validarTarifas([f(6, 9), f(1, 3)]);
    expect(r.errores).toEqual([]);
    expect(r.avisos[0]).toMatch(/Hueco entre 3 y 6/);
  });
});
