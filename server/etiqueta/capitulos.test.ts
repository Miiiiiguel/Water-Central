import { describe, expect, it } from 'vitest';
import { CAPITULOS, SECCIONES } from './capitulos';
import { FAMILIAS, detectarFamilias, familiaDelCapitulo, familiaSegura } from './familias';

// La garantía de que el lector sirve para cualquier producto: los 96
// capítulos de producto del arancel tienen una familia donde caer, y
// las etiquetas de productos que no son ropa ni comida se reconocen.

const TODOS = Array.from({ length: 97 }, (_, i) => String(i + 1).padStart(2, '0')).filter((c) => c !== '77');

describe('la tabla de capítulos', () => {
  it('tiene los 96 capítulos de producto, del 01 al 97 sin el 77', () => {
    expect(CAPITULOS.map((c) => c.codigo).sort()).toEqual(TODOS);
  });

  it('cada capítulo está en exactamente una de las 21 secciones', () => {
    expect(SECCIONES).toHaveLength(21);
    const enSecciones = SECCIONES.flatMap((s) => s.capitulos);
    expect(enSecciones.slice().sort()).toEqual(TODOS);
  });

  it('las palabras están normalizadas como el texto contra el que se comparan', () => {
    for (const cap of CAPITULOS) {
      for (const senal of cap.senales) {
        expect(senal, `${cap.codigo}: ${senal}`).toMatch(/^[a-z0-9%+ -]+$/);
      }
    }
  });
});

describe('la cobertura', () => {
  it('todo capítulo tiene una familia que lo clasifica, y una sola', () => {
    for (const codigo of TODOS) {
      const duenas = FAMILIAS.filter((f) => f.capitulos.indexOf(codigo) !== -1);
      expect(duenas.map((f) => f.id), codigo).toHaveLength(1);
      expect(familiaDelCapitulo(codigo)?.id).toBe(duenas[0].id);
    }
  });

  it('ninguna palabra delata a dos familias a la vez', () => {
    // Si una misma palabra sumara para dos familias, toda etiqueta que
    // la trajera quedaría empatada por construcción.
    const duena = new Map<string, string>();
    const repetidas: string[] = [];
    for (const f of FAMILIAS) {
      for (const s of f.senales) {
        const otra = duena.get(s);
        if (otra && otra !== f.id) repetidas.push(`${s} (${otra} y ${f.id})`);
        duena.set(s, f.id);
      }
    }
    expect(repetidas).toEqual([]);
  });
});

/** La familia que el detector elige sin preguntar, o null si pregunta. */
function elegida(texto: string): string | null {
  const d = detectarFamilias(texto);
  return familiaSegura(d) ? d[0].familia.id : null;
}

describe('etiquetas que antes no tenían dónde caer', () => {
  const casos: [string, string, string][] = [
    ['un reloj', 'RELOJ DE PULSERA\nACERO INOXIDABLE\nRESISTENTE AL AGUA 5 ATM\nMOVIMIENTO DE CUARZO', 'cap91'],
    ['unas gafas de sol', 'SUNGLASSES\nUV400 POLARIZED\nMADE IN CHINA', 'cap90'],
    ['una guitarra', 'GUITARRA ACUSTICA\nCUERDAS DE ACERO\nHECHO EN COLOMBIA', 'cap92'],
    ['un alimento para perros', 'ALIMENTO PARA PERROS ADULTOS\nANALISIS GARANTIZADO\nPROTEINA CRUDA MIN 24%\nINGREDIENTES: pollo, arroz', 'cap23'],
    ['unos pañales', 'PANALES DESECHABLES ETAPA 3\nTALLA M\n40 unidades', 'cap96'],
    ['un sombrero vueltiao', 'SOMBRERO VUELTIAO\nHECHO A MANO EN COLOMBIA', 'cap65'],
    ['un paraguas', 'PARAGUAS AUTOMATICO\n8 VARILLAS', 'cap66'],
    ['un medicamento de venta libre', 'Drug Facts\nActive ingredient: Ibuprofen 200 mg\nUses: temporarily relieves minor aches', 'cap30'],
    ['un fertilizante', 'FERTILIZANTE GRANULADO NPK 15-15-15\nPESO NETO 50 kg', 'cap31'],
    ['unas pastillas de freno', 'PASTILLAS DE FRENO DELANTERAS\nREPUESTO ORIGINAL', 'cap87'],
    ['un dron', 'DRON CUADRICOPTERO\nCON ESTABILIZADOR', 'cap88'],
    ['una pintura', 'OLEO SOBRE LIENZO\n60 x 80 cm\nFIRMADO POR EL ARTISTA', 'cap97'],
    ['un candado', 'CANDADO DE SEGURIDAD\n40 mm\n3 LLAVES', 'cap83'],
    ['unas flores', 'FLORES FRESCAS\nRAMO DE FLORES - ROSAS ROJAS\nPRODUCT OF COLOMBIA', 'cap06'],
    ['una peluca', 'PELUCA DE CABELLO HUMANO\n100% HUMAN HAIR WIG', 'cap67'],
    ['un insecticida', 'INSECTICIDA EN AEROSOL\nMANTENGASE FUERA DEL ALCANCE DE LOS NIÑOS', 'cap38'],
  ];

  for (const [que, texto, familia] of casos) {
    it(`reconoce ${que}`, () => {
      expect(elegida(texto)).toBe(familia);
    });
  }
});

describe('los capítulos nuevos suman a las familias que ya existían', () => {
  it('un café en grano es alimento aunque no traiga tabla nutricional', () => {
    expect(elegida('CAFE EN GRANO 100% ARABICA\nTOSTION MEDIA\nPESO NETO 500 g')).toBe('alimento');
  });

  it('un arroz es alimento: el capítulo 10 entró a esa familia', () => {
    expect(elegida('ARROZ BLANCO\nPESO NETO 1 kg')).toBe('alimento');
    expect(familiaDelCapitulo('10')?.id).toBe('alimento');
  });

  it('un pescado congelado es alimento, y el alimento pregunta si viene fresco o congelado', () => {
    expect(familiaDelCapitulo('03')?.id).toBe('alimento');
  });

  it('unas velas son del capítulo de los jabones', () => {
    expect(elegida('VELAS AROMATICAS\nAROMA VAINILLA\n3 unidades')).toBe('aseo');
  });

  it('un reloj inteligente es electrónica, no relojería', () => {
    expect(elegida('SMARTWATCH\nBLUETOOTH 5.0\nBATERIA RECARGABLE 300 mAh')).toBe('electrico');
  });
});

describe('cuando dos lecturas son razonables, se pregunta', () => {
  it('una gorra de algodón: puede ser ropa o sombrerería, y eso lo decide quien la tiene', () => {
    const d = detectarFamilias('GORRA\n100% ALGODON');
    expect(familiaSegura(d)).toBe(false);
    const ids = d.map((x) => x.familia.id);
    expect(ids).toContain('cap65');
    expect(ids).toContain('textil');
  });

  it('los ingredientes de una galleta no la mandan al capítulo de los cereales', () => {
    const texto = [
      'GALLETAS DE AVENA',
      'INGREDIENTES: harina de trigo, avena, azucar, maiz',
      'INFORMACION NUTRICIONAL',
      'CONTENIDO NETO 300 g',
    ].join('\n');
    expect(elegida(texto)).toBe('alimento');
  });

  it('un zapato con suela de caucho sigue siendo calzado', () => {
    expect(elegida('ZAPATO CASUAL\nCORTE: CUERO\nSUELA: CAUCHO\nTALLA 40')).toBe('calzado');
  });
});
