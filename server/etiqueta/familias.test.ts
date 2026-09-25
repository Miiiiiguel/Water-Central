import { describe, expect, it } from 'vitest';
import { FAMILIAS, detectarFamilias, familiaSegura, leerAtributos, terminosDeBusqueda } from './familias';
import { leerGenerico } from './generico';

// El motor de reglas. Lo que se prueba acá no es que acierte una
// partida —eso lo decide el arancel— sino que le pregunte a cada
// producto lo suyo: al zapato por la suela, a la lata por la
// presentación, a la camiseta por el tejido.

const ETIQUETAS = {
  lata: [
    'ATUN LOMITOS EN ACEITE',
    'CONTENIDO NETO 170 g',
    'INGREDIENTES: Atun, aceite vegetal, sal, agua.',
    'INFORMACION NUTRICIONAL',
    'Calorias 180  Proteina 13 g  Sodio 320 mg',
    'CONSUMIR ANTES DE: 12/2027',
    'HECHO EN COLOMBIA',
  ].join('\n'),
  tenis: [
    'TENIS DEPORTIVO RUNNING',
    'CORTE: TEXTIL / MESH',
    'SUELA: CAUCHO',
    'PLANTILLA EXTRAIBLE',
    'TALLA 42',
    'HECHO EN VIETNAM',
  ].join('\n'),
  licuadora: [
    'LICUADORA 5 VELOCIDADES',
    'MODELO: LC-600',
    '120V~ 60Hz 600W',
    'HECHO EN CHINA',
  ].join('\n'),
  camiseta: [
    'CAMISETA HOMBRE',
    '95% ALGODON 5% ELASTANO',
    'TALLA M',
    'LAVAR A MAQUINA',
    'HECHO EN COLOMBIA',
  ].join('\n'),
};

const familiaDe = (texto: string) => {
  const d = detectarFamilias(texto);
  return familiaSegura(d) ? d[0].familia : null;
};

describe('de qué familia es el producto', () => {
  it('una lata de atún es alimento, no textil', () => {
    expect(familiaDe(ETIQUETAS.lata)?.id).toBe('alimento');
  });

  it('un tenis es calzado aunque diga "textil" y "talla"', () => {
    expect(familiaDe(ETIQUETAS.tenis)?.id).toBe('calzado');
  });

  it('una licuadora es eléctrica: los datos de placa la delatan', () => {
    // Sin leer "120V 60Hz 600W" esta etiqueta sólo dice "licuadora".
    expect(familiaDe(ETIQUETAS.licuadora)?.id).toBe('electrico');
  });

  it('una camiseta sigue siendo textil', () => {
    expect(familiaDe(ETIQUETAS.camiseta)?.id).toBe('textil');
  });

  it('con un texto que no dice nada, no se elige familia: se pregunta', () => {
    expect(familiaDe('PRODUCTO\nSKU 8891')).toBeNull();
    expect(familiaDe('')).toBeNull();
  });

  it('cuando dos familias empatan, tampoco se elige', () => {
    // Una billetera de cuero da señales de marroquinería y de textil.
    const d = detectarFamilias('BILLETERA DE CUERO');
    if (d.length > 1 && d[0].puntaje < d[1].puntaje * 2) {
      expect(familiaSegura(d)).toBe(false);
    }
    expect(familiaSegura([])).toBe(false);
  });
});

describe('qué se le pregunta a cada familia', () => {
  it('al calzado se le pregunta por el corte y la suela, y las lee de la etiqueta', () => {
    const familia = familiaDe(ETIQUETAS.tenis)!;
    const valores = leerAtributos(familia, ETIQUETAS.tenis, leerGenerico(ETIQUETAS.tenis));
    const valor = (id: string) => valores.find((v) => v.atributo.id === id)?.valor;
    expect(valor('material_corte')).toBe('textil');
    expect(valor('material_suela')).toBe('caucho_plastico');
    expect(valor('tipo')).toBe('deportivo');
  });

  it('al calzado NO se le pregunta por el tejido de punto', () => {
    const familia = familiaDe(ETIQUETAS.tenis)!;
    const ids = familia.atributos.map((a) => a.id);
    expect(ids).not.toContain('tejido');
    expect(ids).not.toContain('fibra');
  });

  it('al alimento se le pregunta la presentación y saca el primer ingrediente', () => {
    const familia = familiaDe(ETIQUETAS.lata)!;
    const valores = leerAtributos(familia, ETIQUETAS.lata, leerGenerico(ETIQUETAS.lata));
    expect(valores.find((v) => v.atributo.id === 'ingrediente_principal')?.valor).toBe('atun');
    // "EN ACEITE" es una de las formas de decir "en conserva".
    expect(valores.find((v) => v.atributo.id === 'presentacion')?.valor).toBe('conserva');
  });

  it('a la camiseta se le sigue leyendo la fibra y la prenda', () => {
    const familia = familiaDe(ETIQUETAS.camiseta)!;
    const valores = leerAtributos(familia, ETIQUETAS.camiseta, leerGenerico(ETIQUETAS.camiseta));
    const valor = (id: string) => valores.find((v) => v.atributo.id === id);
    expect(valor('fibra')?.valor).toBe('algodon');
    expect(valor('prenda')?.valor).toBe('camiseta');
    expect(valor('genero')?.valor).toBe('hombre');
  });

  it('el tejido que no está escrito queda marcado como supuesto', () => {
    // Una camiseta es de punto salvo rarezas: se asume, pero se dice.
    const familia = familiaDe(ETIQUETAS.camiseta)!;
    const valores = leerAtributos(familia, ETIQUETAS.camiseta, leerGenerico(ETIQUETAS.camiseta));
    const tejido = valores.find((v) => v.atributo.id === 'tejido');
    expect(tejido?.valor).toBe('punto');
    expect(tejido?.origen).toBe('supuesto');
  });

  it('lo que contesta la persona manda sobre lo que dice la etiqueta', () => {
    const familia = familiaDe(ETIQUETAS.camiseta)!;
    const valores = leerAtributos(familia, ETIQUETAS.camiseta, leerGenerico(ETIQUETAS.camiseta), {
      tejido: 'plano',
    });
    const tejido = valores.find((v) => v.atributo.id === 'tejido');
    expect(tejido?.valor).toBe('plano');
    expect(tejido?.origen).toBe('respuesta');
  });
});

describe('los términos con los que se busca en el arancel', () => {
  it('se arman en inglés a partir de lo que se sabe', () => {
    const familia = familiaDe(ETIQUETAS.tenis)!;
    const valores = leerAtributos(familia, ETIQUETAS.tenis, leerGenerico(ETIQUETAS.tenis));
    const t = terminosDeBusqueda(familia, valores);
    expect(t).toContain('footwear');
    expect(t).toContain('uppers of textile materials');
    expect(t).toContain('outer soles of rubber plastics');
  });

  it('no rellenan lo que no se sabe', () => {
    const familia = FAMILIAS.find((f) => f.id === 'calzado')!;
    const valores = leerAtributos(familia, 'ZAPATO', leerGenerico('ZAPATO'));
    expect(terminosDeBusqueda(familia, valores)).toBe('footwear');
  });
});

describe('el catálogo de familias', () => {
  it('cubre bastante más que los textiles', () => {
    const capitulos = new Set<string>();
    for (const f of FAMILIAS) for (const c of f.capitulos) capitulos.add(c);
    expect(FAMILIAS.length).toBeGreaterThanOrEqual(12);
    expect(capitulos.size).toBeGreaterThanOrEqual(25);
  });

  it('cada familia tiene id único, capítulos y al menos un dato decisivo', () => {
    const ids = FAMILIAS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of FAMILIAS) {
      expect(f.capitulos.length, f.id).toBeGreaterThan(0);
      expect(f.senales.length, f.id).toBeGreaterThan(0);
      // Las familias hechas a mano existen para preguntar lo que decide
      // la partida. Las de un capítulo (cap91, cap65…) no: el capítulo
      // ya es la decisión, y lo que sigue lo resuelve la búsqueda en el
      // arancel, dentro de él.
      if (!f.id.startsWith('cap')) expect(f.atributos.some((a) => a.decisivo), f.id).toBe(true);
      // Un atributo se contesta con botones o escribiendo, pero se
      // contesta: uno sin opciones ni lector deja la pregunta muda.
      for (const a of f.atributos) {
        expect(Boolean(a.opciones || a.extraer || a.termino), `${f.id}.${a.id}`).toBe(true);
        expect(a.pregunta.length, `${f.id}.${a.id}`).toBeGreaterThan(10);
      }
    }
  });
});
