import { describe, expect, it } from 'vitest';
import { enRango, totales } from './inventario';

describe('inventario', () => {
  it('suma los totales de la tarjeta', () => {
    expect(totales([
      { total_unidades: 100, disponibles: 70, vendidos: 30 },
      { total_unidades: 50, disponibles: 50, vendidos: 0 },
    ])).toEqual({ productos: 2, totalUnidades: 150, disponibles: 120, vendidos: 30 });
    expect(totales([])).toEqual({ productos: 0, totalUnidades: 0, disponibles: 0, vendidos: 0 });
  });
  it('filtra el historial por rango, incluyendo los dos extremos', () => {
    const f = [{ created_at: '2026-10-01T08:00:00' }, { created_at: '2026-10-15T23:00:00' }, { created_at: '2026-10-31T10:00:00' }];
    expect(enRango(f, '2026-10-01', '2026-10-15')).toHaveLength(2);
    expect(enRango(f, '2026-10-16', '')).toHaveLength(1);
    expect(enRango(f, '', '')).toHaveLength(3);
  });
});
