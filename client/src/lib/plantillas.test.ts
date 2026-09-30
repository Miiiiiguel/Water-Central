import { describe, expect, it } from 'vitest';
import { INCOTERMS, ITEM_VACIO, TRATADOS, documentoVacio, faltantes, totalDeItem, totales, type Documento } from './plantillas';

const lleno = (): Documento => {
  const d = documentoVacio(new Date('2026-09-30T00:00:00Z'));
  d.exportador = { ...d.exportador, nombre: 'Café Andino SAS', direccion: 'Cra 1 # 2-3', ciudad: 'Medellín', pais: 'Colombia' };
  d.importador = { ...d.importador, nombre: 'Andes Imports LLC', direccion: '100 Main St', ciudad: 'Miami', pais: 'Estados Unidos' };
  d.numero = 'FC-001';
  d.items = [
    { ...ITEM_VACIO, descripcion: 'Café tostado en grano, 340 g', partida: '0901.21.0045', cantidad: 100, valorUnitario: 6.5, pesoNetoKg: 34, pesoBrutoKg: 38, bultos: 4 },
    { ...ITEM_VACIO, descripcion: 'Café molido, 250 g', partida: '0901.21.0055', cantidad: 50, valorUnitario: 5.25, pesoNetoKg: 12.5, pesoBrutoKg: 14, bultos: 2 },
  ];
  return d;
};

describe('plantillas de exportación', () => {
  it('suma totales de valor, peso y bultos sin errores de redondeo', () => {
    const t = totales(lleno().items);
    expect(t.valor).toBe(912.5);
    expect(t.pesoNetoKg).toBe(46.5);
    expect(t.pesoBrutoKg).toBe(52);
    expect(t.bultos).toBe(6);
    expect(totalDeItem({ ...ITEM_VACIO, cantidad: 3, valorUnitario: 0.1 })).toBe(0.3);
  });

  it('un número negativo o vacío no resta', () => {
    expect(totales([{ ...ITEM_VACIO, cantidad: -5, valorUnitario: 10 }]).valor).toBe(0);
  });

  it('una factura completa no pide nada más', () => {
    expect(faltantes('factura', lleno())).toEqual([]);
  });

  it('la factura exige número, partida de 6+ dígitos y precio de cada producto', () => {
    const d = lleno();
    d.numero = '';
    d.items[0].partida = '0901';
    d.items[1].valorUnitario = 0;
    const f = faltantes('factura', d);
    expect(f).toContain('Número de factura');
    expect(f.some((x) => x.includes('partida'))).toBe(true);
    expect(f.some((x) => x.includes('Precio unitario'))).toBe(true);
  });

  it('la proforma no exige número', () => {
    const d = lleno();
    d.numero = '';
    expect(faltantes('proforma', d)).toEqual([]);
  });

  it('la lista de empaque pide peso bruto y bultos, no precios', () => {
    const d = lleno();
    d.items[1].valorUnitario = 0;
    expect(faltantes('empaque', d)).toEqual([]);
    d.items[1].pesoBrutoKg = 0;
    expect(faltantes('empaque', d).some((x) => x.includes('Peso bruto'))).toBe(true);
  });

  it('la certificación de origen pide criterio y firmante', () => {
    const d = lleno();
    expect(faltantes('origen', d)).toEqual(expect.arrayContaining([expect.stringContaining('criterio'), 'Nombre de quien firma']));
    d.criterioOrigen = 'Producido enteramente en Colombia';
    d.firmante = 'Ana Pérez';
    expect(faltantes('origen', d)).toEqual([]);
  });

  it('están los 11 Incoterms 2020, y sólo FAS, FOB, CFR y CIF son marítimos', () => {
    expect(INCOTERMS.map((i) => i.codigo)).toEqual(['EXW', 'FCA', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP', 'FAS', 'FOB', 'CFR', 'CIF']);
    expect(INCOTERMS.filter((i) => i.transporte === 'maritimo').map((i) => i.codigo)).toEqual(['FAS', 'FOB', 'CFR', 'CIF']);
    // Sólo en DDP el vendedor importa; sólo CIP y CIF obligan al vendedor a asegurar.
    expect(INCOTERMS.filter((i) => i.importacion === 'vendedor').map((i) => i.codigo)).toEqual(['DDP']);
    expect(INCOTERMS.filter((i) => i.seguro === 'vendedor').map((i) => i.codigo)).toEqual(['CIP', 'CIF']);
  });

  it('los acuerdos de la certificación son los vigentes con EE. UU. para los países de origen de la calculadora', () => {
    expect(TRATADOS.map((t) => t.nombre)).toContain('TPA Colombia – Estados Unidos');
    expect(TRATADOS.map((t) => t.nombre)).toContain('CAFTA-DR');
  });
});
