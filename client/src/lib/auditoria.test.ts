import { describe, expect, it } from 'vitest';
import { diferencias, resumen, titulo, valorLegible, type FilaAuditoria } from './auditoria';

const f = (p: Partial<FilaAuditoria>): FilaAuditoria => ({ id: 1, actor: 'a', tabla: 'casillero_paquetes', accion: 'UPDATE', fila: 'p1', detalle: null, created_at: '2026-10-30T10:00:00Z', ...p });

describe('auditoría legible', () => {
  it('en un UPDATE muestra solo lo que cambió e ignora updated_at', () => {
    const d = diferencias(f({ detalle: { antes: { estado: 'recibido', peso_lb: 2, updated_at: 'x' }, despues: { estado: 'alistamiento', peso_lb: 2, updated_at: 'y' } } }));
    expect(d).toEqual([{ campo: 'estado', antes: 'recibido', despues: 'alistamiento' }]);
  });
  it('en un INSERT lista la fila nueva y en un DELETE la que se perdió', () => {
    expect(diferencias(f({ accion: 'INSERT', detalle: { guia: 'G1', updated_at: 'x' } }))).toEqual([{ campo: 'guia', antes: undefined, despues: 'G1' }]);
    expect(diferencias(f({ accion: 'DELETE', detalle: { guia: 'G1' } }))).toEqual([{ campo: 'guia', antes: 'G1', despues: undefined }]);
  });
  it('titula en español', () => {
    expect(titulo(f({ accion: 'DELETE' }))).toBe('Eliminó un paquete');
    expect(titulo(f({ tabla: 'anuncio', accion: 'INSERT' }))).toBe('Creó un anuncio');
    expect(titulo(f({ tabla: 'otra', accion: 'UPDATE' }))).toBe('Modificó otra');
  });
  it('resume cada tipo de cambio', () => {
    expect(resumen(f({ detalle: { antes: { guia: 'G1', estado: 'recibido' }, despues: { guia: 'G1', estado: 'despachado' } } }))).toBe('guía G1 · estado: recibido → despachado');
    expect(resumen(f({ tabla: 'casillero_wallet', accion: 'INSERT', fila: 'w', detalle: { tipo: 'ajuste', monto: 7.5, referencia: 'Bono' } }))).toBe('ajuste · USD 7.5 · Bono');
    expect(resumen(f({ tabla: 'anuncio', accion: 'INSERT', fila: null, detalle: { titulo: 'Feriado' } }))).toBe('Feriado');
    expect(resumen(f({ tabla: 'profiles', detalle: { antes: { casillero_codigo: 'DM1001', casillero_bloqueado: false }, despues: { casillero_codigo: 'DM1001', casillero_bloqueado: true } } }))).toBe('DM1001 · casillero bloqueado: no → sí');
    expect(resumen(f({ tabla: 'casillero_tarifas', accion: 'INSERT', detalle: { libras_desde: 10, libras_hasta: 12 } }))).toBe('10–12 lb');
  });
  it('formatea valores', () => {
    expect(valorLegible(null)).toBe('—');
    expect(valorLegible(true)).toBe('sí');
    expect(valorLegible({ a: 1 })).toBe('{"a":1}');
    expect(valorLegible(undefined)).toBe('');
  });
});
