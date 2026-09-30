import { describe, expect, it } from 'vitest';
import { derechoPorUnidad, parseEspecial, parseTasa, tasaPreferencial } from './tasaArancel';

describe('leer una tarifa', () => {
  it('porcentaje, libre y centavos por kilo', () => {
    expect(parseTasa('6.4%').componentes).toEqual([{ tipo: 'advalorem', pct: 6.4 }]);
    expect(parseTasa('Free')).toMatchObject({ libre: true, calculable: true, componentes: [] });
    expect(parseTasa('13.6¢/kg').componentes).toEqual([{ tipo: 'especifico', usd: 0.136, por: 'kg' }]);
    expect(parseTasa('$1.035/kg').componentes).toEqual([{ tipo: 'especifico', usd: 1.035, por: 'kg' }]);
  });

  it('las compuestas se suman', () => {
    const t = parseTasa('13.6¢/kg + 6%');
    expect(t.componentes).toEqual([{ tipo: 'especifico', usd: 0.136, por: 'kg' }, { tipo: 'advalorem', pct: 6 }]);
    expect(t.necesita).toEqual(['peso']);
  });

  it('por unidad, par, docena, gruesa y litro', () => {
    expect(parseTasa('5¢ each + 4.9%').componentes[0]).toEqual({ tipo: 'especifico', usd: 0.05, por: 'unidad' });
    expect(parseTasa('$2 each').componentes[0]).toEqual({ tipo: 'especifico', usd: 2, por: 'unidad' });
    expect(parseTasa('16¢/pr. + 6%').componentes[0]).toMatchObject({ por: 'par' });
    expect(parseTasa('4.4¢/doz. + 5%').componentes[0]).toMatchObject({ por: 'docena' });
    expect(parseTasa('0.8¢/gross + 3%').componentes[0]).toMatchObject({ por: 'gruesa' });
    expect(parseTasa('8.5¢/liter')).toMatchObject({ necesita: ['volumen'] });
    // El barril se pasa a litros: 10.5¢ el barril de 158,987 L.
    expect(derechoPorUnidad(parseTasa('10.5¢/bbl'), { valor: 1, litros: 158.987294928 }).usd).toBeCloseTo(0.105, 6);
  });

  it('el HTML del export no molesta', () => {
    expect(parseTasa('6.4% <u></u>').componentes).toEqual([{ tipo: 'advalorem', pct: 6.4 }]);
  });

  it('lo que no se entiende no se inventa: queda como no calculable, con el texto', () => {
    for (const raro of [
      '15.3¢ each + 6% on the case + 5.3% on the strap, band or bracelet',
      '5.1¢/kg on drained weight',
      'The duty provided in the applicable subheading + 25%',
      '',
    ]) {
      const t = parseTasa(raro);
      expect(t.calculable, raro).toBe(false);
      expect(t.motivo, raro).toBeTruthy();
    }
  });
});

describe('dólares por unidad', () => {
  it('suma cada parte sobre el dato que corresponde', () => {
    const d = derechoPorUnidad(parseTasa('13.6¢/kg + 6%'), { valor: 10, pesoKg: 0.5 });
    expect(d.calculable).toBe(true);
    expect(d.usd).toBeCloseTo(0.068 + 0.6, 6);
  });

  it('docena y gruesa se reparten por pieza', () => {
    expect(derechoPorUnidad(parseTasa('$1.20/doz.'), { valor: 1 }).usd).toBeCloseTo(0.1, 6);
    expect(derechoPorUnidad(parseTasa('$1.44/gross'), { valor: 1 }).usd).toBeCloseTo(0.01, 6);
  });

  it('sin el volumen, una tarifa por litro no se calcula: se pide el dato', () => {
    expect(derechoPorUnidad(parseTasa('8.5¢/liter'), { valor: 5 })).toEqual({ usd: 0, calculable: false, falta: 'volumen' });
    expect(derechoPorUnidad(parseTasa('8.5¢/liter'), { valor: 5, litros: 0.75 }).usd).toBeCloseTo(0.06375, 6);
  });

  it('libre es cero y calculable', () => {
    expect(derechoPorUnidad(parseTasa('Free'), { valor: 99 })).toEqual({ usd: 0, calculable: true });
  });
});

describe('tarifas preferenciales por país', () => {
  const ESPECIAL = 'Free (A+,AU,BH,CA,CL,CO,D,E,IL,JO,KR,MA,MX,OM,P,PA,PE,S,SG) 3.2% (JP)';

  it('lee cada grupo con sus programas', () => {
    const g = parseEspecial(ESPECIAL);
    expect(g).toHaveLength(2);
    expect(g[0].tasa.libre).toBe(true);
    expect(g[0].programas).toContain('CO');
    expect(g[1].tasa.componentes).toEqual([{ tipo: 'advalorem', pct: 3.2 }]);
  });

  it('Colombia, México y CAFTA-DR encuentran su acuerdo', () => {
    expect(tasaPreferencial(ESPECIAL, 'CO')).toMatchObject({ programa: 'CO', acuerdo: 'TPA Colombia – EE. UU.' });
    expect(tasaPreferencial(ESPECIAL, 'MX')?.programa).toBe('MX');
    expect(tasaPreferencial(ESPECIAL, 'GT')?.programa).toBe('P');
  });

  it('sin acuerdo, o si la partida no lo lista, paga la general', () => {
    expect(tasaPreferencial(ESPECIAL, 'BR')).toBeNull();
    expect(tasaPreferencial('Free (A,AU,KR)', 'CO')).toBeNull();
  });

  it('el SGP vencido nunca cuenta', () => {
    expect(tasaPreferencial('Free (A,A+,A*)', 'EC')).toBeNull();
  });
});
