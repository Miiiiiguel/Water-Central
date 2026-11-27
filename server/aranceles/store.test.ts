import { describe, expect, it } from 'vitest';
import { ARANCEL_DE, arancelLocal, cargarArancel, construir, lineasLocales, tasaLocal } from './store';

describe('los aranceles descargados', () => {
  it('cargan todos los países y cada uno trae miles de líneas', () => {
    for (const id of new Set(Object.values(ARANCEL_DE))) {
      const idx = cargarArancel(id);
      expect(idx, id).not.toBeNull();
      expect(idx!.lineas.length, id).toBeGreaterThan(7000);
      expect(idx!.meta.fuente, id).not.toBe('');
    }
  });

  it('las camisetas de algodón pagan lo que dice cada arancel oficial', () => {
    expect(arancelLocal('CL', '61091000')?.general?.texto).toBe('6%');
    expect(arancelLocal('CO', '6109100000')?.general?.texto).toBe('15%');
    expect(arancelLocal('BR', '61091000')?.general?.texto).toBe('35%');
    expect(arancelLocal('MX', '61091003')?.general?.texto).toBe('35%');
    expect(arancelLocal('PE', '6109100031')?.general?.texto).toBe('11%');
  });

  it('el café sin tostar de México paga 45 %, y lo exento es 0 %', () => {
    expect(arancelLocal('MX', '09012199')?.general?.texto).toBe('45%');
    const exento = cargarArancel('MX')!.lineas.find((r) => r.fila.t === 'Ex.')!;
    const a = arancelLocal('MX', exento.fila.c)!;
    expect(a.general?.libre).toBe(true);
  });

  it('las líneas de una subpartida traen su código y una descripción que se entiende', () => {
    const l = lineasLocales('PE', '610910')!;
    expect(l.length).toBeGreaterThan(3);
    expect(l.every((x) => x.codigo.startsWith('610910') && x.descripcion.length > 3)).toBe(true);
    expect(lineasLocales('CO', '999999')).toEqual([]);
  });

  it('una línea que no existe o que es un título no devuelve tarifa', () => {
    expect(arancelLocal('CO', '6109000000')).toBeNull();
    expect(arancelLocal('CO', '61')).toBeNull();
  });
});

describe('la tasa como la publica cada país', () => {
  it('"Ex." es 0 %, "12.6% BK" es 12.6 % con aviso, lo compuesto no se calcula', () => {
    expect(tasaLocal('Ex.').tasa?.libre).toBe(true);
    const bk = tasaLocal('12.6% BK');
    expect(bk.tasa?.componentes[0]).toEqual({ tipo: 'advalorem', pct: 12.6 });
    expect(bk.aviso).toMatch(/capital/);
    expect(tasaLocal('20% + 0.36 USD/kg de azúcar').tasa?.calculable).toBe(false);
    expect(tasaLocal(null).tasa).toBeNull();
  });

  it('el árbol arma la descripción desde los títulos de arriba', () => {
    const idx = construir(
      [
        { c: '6109', n: 0, d: 'Camisetas', t: null, f: false },
        { c: '610910', n: 1, d: 'De algodón:', t: null, f: false },
        { c: '6109100010', n: 2, d: 'Los demás', t: '10%', f: true },
      ],
      { pais: 'X', fuente: 'f', url: '', idioma: 'es', nota: '' }
    );
    expect(idx.porCodigo.get('6109100010')!.ruta).toEqual(['De algodón', 'Los demás']);
  });
});

describe('el arancel común de la UE descargado', () => {
  it('trae las líneas de 10 dígitos con la tarifa de terceros países', () => {
    expect(arancelLocal('UE', '6109100010')?.general?.texto).toBe('12%');
    expect(cargarArancel('UE')!.lineas.length).toBeGreaterThan(15000);
  });
});
