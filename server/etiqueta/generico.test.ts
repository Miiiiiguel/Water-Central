import { describe, expect, it } from 'vitest';
import { leerCantidad, leerGenerico } from './generico';

// Lo que trae cualquier etiqueta. Las pruebas usan textos de productos
// que no tienen nada que ver entre sí a propósito: si algo de acá sólo
// funciona con ropa, está mal.

describe('el contenido neto', () => {
  it('lee gramos y los pasa a kilos', () => {
    const c = leerCantidad('CONTENIDO NETO 400 g');
    expect(c).toEqual({ valor: 400, unidad: 'g', base: { valor: 0.4, unidad: 'kg' } });
  });

  it('lee mililitros y los pasa a litros', () => {
    expect(leerCantidad('CONT. NETO: 350 ml')?.base).toEqual({ valor: 0.35, unidad: 'L' });
  });

  it('entiende la coma decimal', () => {
    expect(leerCantidad('PESO NETO 1,5 kg')?.valor).toBe(1.5);
  });

  it('convierte onzas, que es como viene lo importado', () => {
    const c = leerCantidad('NET WT 5 OZ');
    expect(c?.unidad).toBe('oz');
    expect(c?.base?.unidad).toBe('kg');
    expect(c?.base?.valor).toBeCloseTo(0.1417, 3);
  });

  it('prefiere el contenido anunciado sobre cualquier otro número de la etiqueta', () => {
    // Una etiqueta de alimento tiene diez cifras con unidad y una sola
    // es el contenido: si gana la primera que aparece, se declara mal.
    const texto = 'SODIO 200 mg\nAZUCARES 12 g\nCONTENIDO NETO 330 ml';
    expect(leerCantidad(texto)?.unidad).toBe('ml');
  });

  it('no inventa una cantidad donde no la hay', () => {
    expect(leerCantidad('ANILLO DE PLATA 925')).toBeNull();
  });
});

describe('los datos que trae cualquier etiqueta', () => {
  const lata = [
    'ATUN LOMITOS EN ACEITE',
    'MARCA: Van Camps',
    'CONTENIDO NETO 170 g',
    'INGREDIENTES: Atun, aceite vegetal, sal.',
    'LOTE: A4521',
    'CONSUMIR ANTES DE: 12/2027',
    'HECHO EN COLOMBIA',
    '7702001012345',
  ].join('\n');

  it('saca el país de origen', () => {
    expect(leerGenerico(lata).origen).toBe('COLOMBIA');
  });

  it('saca la marca, el lote y el vencimiento', () => {
    const d = leerGenerico(lata);
    expect(d.marca).toBe('Van Camps');
    expect(d.lote).toBe('A4521');
    expect(d.vencimiento).toBe('12/2027');
  });

  it('saca el código de barras y no lo confunde con otro número', () => {
    expect(leerGenerico(lata).codigoDeBarras).toBe('7702001012345');
  });

  it('lee los datos de placa de un aparato eléctrico', () => {
    const d = leerGenerico('LICUADORA\nMODELO: LC-600\n120V~ 60Hz 600W\nHECHO EN CHINA');
    expect(d.electrico).toEqual({ voltaje: '120V', potencia: '600W', frecuencia: '60HZ' });
    expect(d.modelo).toBe('LC-600');
  });

  it('no inventa datos eléctricos en algo que no es un aparato', () => {
    expect(leerGenerico('CAMISETA 100% ALGODON TALLA M').electrico).toBeNull();
  });

  it('se queda con el material más específico', () => {
    // "acero inoxidable" contiene "acero": si salen los dos, el dato
    // deja de servir para clasificar.
    expect(leerGenerico('OLLA DE ACERO INOXIDABLE 18/10').materiales).toEqual(['acero inoxidable']);
  });

  it('con un texto vacío no devuelve nada inventado', () => {
    const d = leerGenerico('');
    expect(d.origen).toBeNull();
    expect(d.marca).toBeNull();
    expect(d.contenidoNeto).toBeNull();
    expect(d.materiales).toEqual([]);
  });
});
