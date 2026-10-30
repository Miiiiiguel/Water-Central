import { describe, expect, it } from 'vitest';
import { enRango, estadoStock, revisarImportacion, revisarMovimientos, tonoCobertura, totales } from './inventario';
import { csvAObjetos } from '../portal/format';
import { leerTodo } from '../portal/admin';

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

  it('clasifica el stock: agotado, bajo o bien', () => {
    expect(estadoStock({ disponibles: 0, stock_minimo: 10, vendidos: 5 })).toBe('agotado');
    expect(estadoStock({ disponibles: -2, stock_minimo: 0, vendidos: 5 })).toBe('agotado');
    expect(estadoStock({ disponibles: 8, stock_minimo: 10, vendidos: 5 })).toBe('bajo');
    expect(estadoStock({ disponibles: 8, stock_minimo: 0, vendidos: 5 })).toBe('ok');
    expect(tonoCobertura(5)).toBe('rojo'); expect(tonoCobertura(12)).toBe('ambar'); expect(tonoCobertura(40)).toBe('verde'); expect(tonoCobertura(null)).toBe('gris');
  });

  it('revisa un CSV de productos: nuevos, existentes y filas con error', () => {
    const csv = 'SKU,Nombre,Descripción,Imagen,Stock mínimo\nCAM-01,Camiseta,"Algodón, talla M",https://x/i.png,10\ncam-01,Repetida,,,\nGOR-02,Gorra,,,\n,Sin sku,,,\nTAZ-03,Taza,,foto.png,\nBUZ-04,Buzo,,,-3\n';
    const filas = revisarImportacion(csvAObjetos(csv), new Set(['gor-02']));
    expect(filas.map((f) => f.estado)).toEqual(['nuevo', 'error', 'existente', 'error', 'error', 'error']);
    expect(filas[0]).toMatchObject({ sku: 'CAM-01', descripcion: 'Algodón, talla M', stock_minimo: 10, fila: 2 });
    expect(filas[1].error).toMatch(/repetido/);
    expect(filas[3].error).toMatch(/SKU/);
    expect(filas[4].error).toMatch(/imagen/);
    expect(filas[5].error).toMatch(/mínimo/);
  });
});

describe('ingreso masivo desde CSV', () => {
  const leer = (csv: string) => revisarMovimientos(csvAObjetos(csv));
  it('lee la plantilla: ingreso por defecto, venta en negativo, alias y tildes', () => {
    const r = leer('codigo,sku,tipo,cantidad,referencia\ndm1001,CAM-01,ingreso,50,Caja 1\nDM1001,CAM-01,Venta,3,\nDM1002,PAN-9,devolución,2,RMA-4\nDM1002,PAN-9,ajuste,-1,Conteo\nDM1003,X-1,,10,');
    expect(r.map((x) => x.error)).toEqual([undefined, undefined, undefined, undefined, undefined]);
    expect(r.map((x) => [x.codigo, x.tipo, x.cantidad])).toEqual([['DM1001', 'ingreso', 50], ['DM1001', 'venta', -3], ['DM1002', 'devolucion', 2], ['DM1002', 'ajuste', -1], ['DM1003', 'ingreso', 10]]);
    expect(r[0].fila).toBe(2); // la primera fila de datos es la 2 del archivo
  });
  it('una venta con signo negativo sigue siendo una sola venta negativa', () => {
    expect(leer('codigo,sku,tipo,cantidad\nDM1001,A,venta,-4')[0].cantidad).toBe(-4);
  });
  it('marca cada problema con un mensaje que se entiende', () => {
    const r = leer('codigo,sku,tipo,cantidad\n,A,ingreso,1\nDM1001,,ingreso,1\nDM1001,A,regalo,1\nDM1001,A,ingreso,0\nDM1001,A,ingreso,1.5\nDM1001,A,ingreso,-2\nDM1001,A,devolucion,-2\nDM1001,A,ingreso,999999\nDM1001,A,ingreso,abc');
    expect(r.map((x) => x.error)).toEqual([
      expect.stringMatching(/código del cliente/), expect.stringMatching(/Falta el SKU/), expect.stringMatching(/Tipo desconocido «regalo»/),
      expect.stringMatching(/distinto de cero/), expect.stringMatching(/entero/), expect.stringMatching(/Un ingreso no puede ser negativo/),
      expect.stringMatching(/Una devolución no puede ser negativo/), expect.stringMatching(/demasiado grande/), expect.stringMatching(/entero/),
    ]);
  });
});

describe('leerTodo', () => {
  const pagina = (total: number) => async (d: number, h: number) => ({ data: Array.from({ length: Math.max(0, Math.min(h + 1, total) - d) }, (_, i) => d + i), error: null });
  it('junta todas las páginas y se detiene cuando una viene incompleta', async () => {
    expect(await leerTodo<number>(pagina(2500))).toHaveLength(2500);
    expect(await leerTodo<number>(pagina(1000))).toHaveLength(1000);
    expect(await leerTodo<number>(pagina(0))).toEqual([]);
  });
  it('respeta el tope y propaga el error', async () => {
    expect(await leerTodo<number>(pagina(9000), 3000)).toHaveLength(3000);
    await expect(leerTodo(async () => ({ data: null, error: { message: 'sin permiso' } }))).rejects.toMatchObject({ message: 'sin permiso' });
  });
});
