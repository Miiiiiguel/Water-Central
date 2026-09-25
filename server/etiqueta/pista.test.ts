import { describe, expect, it } from 'vitest';
import { interpretarSalida, separarPista } from './pista';

// La línea con la que el lector dice qué producto vio. Tiene que poder
// separarse siempre del texto de la etiqueta, porque lo que no estaba
// impreso no se muestra como leído.

describe('separar la pista', () => {
  it('saca la línea del texto de la etiqueta', () => {
    const { etiqueta, pista } = separarPista('45% COTTON\n55% WOOL\nPRODUCTO_VISTO: suéter');
    expect(etiqueta).toBe('45% COTTON\n55% WOOL');
    expect(pista).toBe('suéter');
  });

  it('una línea impresa "PRODUCTO:" es de la etiqueta, no la pista', () => {
    const { etiqueta, pista } = separarPista('PRODUCTO: CAFE TOSTADO\nPESO NETO 500 g');
    expect(etiqueta).toContain('PRODUCTO: CAFE TOSTADO');
    expect(pista).toBeNull();
  });

  it('"desconocido" es no saber, y no se usa', () => {
    expect(separarPista('PRODUCTO_VISTO: desconocido').pista).toBeNull();
  });

  it('un texto escrito a mano, sin pista, queda igual', () => {
    expect(separarPista('95% ALGODON').etiqueta).toBe('95% ALGODON');
    expect(separarPista('95% ALGODON').pista).toBeNull();
  });
});

describe('lo que devuelve el lector', () => {
  it('sin texto y sin producto reconocible es ilegible', () => {
    expect(interpretarSalida('SIN_TEXTO')).toEqual({ texto: '', ilegible: true });
    expect(interpretarSalida('SIN_TEXTO\nPRODUCTO_VISTO: desconocido').ilegible).toBe(true);
    expect(interpretarSalida('').ilegible).toBe(true);
  });

  it('sin texto pero con un producto a la vista, alcanza para empezar', () => {
    expect(interpretarSalida('SIN_TEXTO\nPRODUCTO_VISTO: taza de cerámica')).toEqual({
      texto: 'PRODUCTO_VISTO: taza de cerámica',
      ilegible: false,
    });
  });

  it('con texto, la pista queda al final', () => {
    const r = interpretarSalida('RELOJ\n5 ATM\nPRODUCTO_VISTO: reloj de pulsera\n');
    expect(r.texto).toBe('RELOJ\n5 ATM\nPRODUCTO_VISTO: reloj de pulsera');
  });
});
