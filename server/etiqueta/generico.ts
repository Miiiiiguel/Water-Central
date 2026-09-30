// Lo que trae CUALQUIER etiqueta, sea una camiseta, una lata de atún o
// un taladro.
//
// El arancel tiene 98 capítulos y los textiles son menos del 9% de las
// partidas. Lo que sirve para todos es esto: de dónde viene, quién lo
// hace, cuánto trae y qué código de barras tiene. Las reglas propias de
// cada familia de producto viven aparte, en familias.ts.
//
// El contenido neto no es un adorno: el arancel declara la cantidad en
// una unidad concreta —kilos, docenas, litros, unidades— y esa unidad
// sale de la partida. Leerla de la etiqueta ahorra una pregunta y evita
// una declaración mal hecha.

export interface Cantidad {
  valor: number;
  /** Tal como lo dice la etiqueta: "g", "ml", "oz", "unidades". */
  unidad: string;
  /** Normalizado a la unidad base del sistema métrico: kg, L o unidades. */
  base: { valor: number; unidad: 'kg' | 'L' | 'u' } | null;
}

export interface DatosGenericos {
  origen: string | null;
  marca: string | null;
  modelo: string | null;
  contenidoNeto: Cantidad | null;
  codigoDeBarras: string | null;
  lote: string | null;
  vencimiento: string | null;
  /** Materiales nombrados sin más contexto: "acero inoxidable", "100% plástico". */
  materiales: string[];
  /** Datos eléctricos, cuando los hay: deciden partida en los capítulos 84 y 85. */
  electrico: { voltaje: string | null; potencia: string | null; frecuencia: string | null } | null;
}

export type FaltaGenerica = 'origen' | 'contenido_neto';

function normalizar(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

const ORIGEN = /\b(?:made\s+in|hecho\s+en|fabricado\s+en|fabricado\s+na|feito\s+no|produced\s+in|product\s+of|producto\s+de|origen|fabrique\s+en|industria)\s*:?\s*([a-zA-ZÁÉÍÓÚÑáéíóúñ][a-zA-ZÁÉÍÓÚÑáéíóúñ .]{2,27})/i;
const MARCA = /\b(?:marca|brand|fabricante|manufactured\s+by|distribuido\s+por)\s*:?\s*([A-Za-z0-9ÁÉÍÓÚÑáéíóúñ&. -]{2,32})/i;
const MODELO = /\b(?:modelo|model|ref|referencia|style|art|articulo)\s*[.:#]?\s*([A-Z0-9][A-Z0-9/-]{2,18})\b/i;
// "L" a secas no vale como abreviatura de lote: se comía la primera
// palabra de cualquier renglón que empezara con ele ("LOMITOS").
const LOTE = /\b(?:lote|lot|batch|l\.)\s*[.:#]?\s*([A-Z0-9-]{3,14})\b/i;
// Un vencimiento viene como "15/01/2027" pero también como "12/2027":
// el segundo tramo puede ser el año entero.
const VENCE = /\b(?:vence|vencimiento|caduca|consumir\s+antes\s+de|exp(?:iry|ires)?|best\s+before|validade)\s*[.:]?\s*([0-9]{1,4}[/.-][0-9]{1,4}(?:[/.-][0-9]{2,4})?)/i;
// EAN-13, EAN-8 y UPC-A, que es lo que trae un producto de consumo.
const BARRAS = /\b(\d{13}|\d{12}|\d{8})\b/;

/** Las unidades que aparecen en una etiqueta, con su equivalencia métrica. */
const UNIDADES: { patron: string; unidad: string; base: 'kg' | 'L' | 'u'; factor: number }[] = [
  { patron: 'kg', unidad: 'kg', base: 'kg', factor: 1 },
  { patron: 'g', unidad: 'g', base: 'kg', factor: 0.001 },
  { patron: 'mg', unidad: 'mg', base: 'kg', factor: 0.000001 },
  { patron: 'lb', unidad: 'lb', base: 'kg', factor: 0.453592 },
  { patron: 'lbs', unidad: 'lb', base: 'kg', factor: 0.453592 },
  { patron: 'oz', unidad: 'oz', base: 'kg', factor: 0.0283495 },
  { patron: 'l', unidad: 'L', base: 'L', factor: 1 },
  { patron: 'lt', unidad: 'L', base: 'L', factor: 1 },
  { patron: 'ml', unidad: 'ml', base: 'L', factor: 0.001 },
  { patron: 'cc', unidad: 'ml', base: 'L', factor: 0.001 },
  { patron: 'fl oz', unidad: 'fl oz', base: 'L', factor: 0.0295735 },
  { patron: 'unidades', unidad: 'unidades', base: 'u', factor: 1 },
  { patron: 'unidad', unidad: 'unidades', base: 'u', factor: 1 },
  { patron: 'und', unidad: 'unidades', base: 'u', factor: 1 },
  { patron: 'uds', unidad: 'unidades', base: 'u', factor: 1 },
  { patron: 'piezas', unidad: 'unidades', base: 'u', factor: 1 },
  { patron: 'pcs', unidad: 'unidades', base: 'u', factor: 1 },
];

/**
 * El contenido neto. Se busca primero junto a las palabras que lo
 * anuncian ("CONTENIDO NETO", "NET WT"), y si no aparecen, la primera
 * cantidad con unidad reconocible. Ese orden importa: una etiqueta de
 * alimento tiene diez números y sólo uno es el contenido.
 */
export function leerCantidad(texto: string): Cantidad | null {
  const plano = normalizar(texto).replace(/\s+/g, ' ');
  const unidades = UNIDADES.map((u) => u.patron.replace(' ', '\\s*')).join('|');
  const numero = '(\\d{1,5}(?:[.,]\\d{1,3})?)';

  const anunciado = new RegExp(
    `(?:contenido\\s+neto|peso\\s+neto|net\\s+wt|net\\s+weight|contenido|cont\\.?\\s*neto)\\s*[.:]?\\s*${numero}\\s*(${unidades})\\b`
  ).exec(plano);
  const suelto = anunciado ?? new RegExp(`${numero}\\s*(${unidades})\\b`).exec(plano);
  if (!suelto) return null;

  const valor = parseFloat(suelto[1].replace(',', '.'));
  if (!Number.isFinite(valor) || valor <= 0) return null;
  const escrita = suelto[2].replace(/\s+/g, ' ').trim();
  const def = UNIDADES.find((u) => u.patron === escrita);
  if (!def) return null;

  return {
    valor,
    unidad: def.unidad,
    base: { valor: Number((valor * def.factor).toFixed(6)), unidad: def.base },
  };
}

const MATERIALES = [
  'acero inoxidable', 'acero', 'aluminio', 'hierro', 'cobre', 'bronce', 'zinc', 'titanio',
  'plastico', 'polipropileno', 'polietileno', 'pvc', 'pet', 'acrilico', 'silicona', 'caucho', 'goma',
  'vidrio', 'ceramica', 'porcelana', 'madera', 'mdf', 'bambu', 'carton', 'papel',
  'cuero', 'gamuza', 'lona', 'melamina', 'marmol', 'piedra', 'resina', 'fibra de vidrio',
];

// Los datos de placa van pegados en un mismo renglón ("120V~ 60Hz
// 600W"). Por eso el espacio admitido es sólo espacio o tabulación, no
// `\s`: un salto de línea dejaba que el "600" de un número de modelo
// se juntara con el "120V" del renglón siguiente y saliera "600120V".
const VOLTAJE = /\b(\d{2,3}(?:[ \t]?-[ \t]?\d{2,3})?[ \t]?v(?:olts?)?\b|\d{1,2}[ \t]?v[ \t]?(?:dc|cc)\b)/i;
const POTENCIA = /\b(\d{1,5}[ \t]?(?:w|watts?|kw)\b)/i;
const FRECUENCIA = /\b(\d{2,3}[ \t]?(?:\/[ \t]?\d{2,3}[ \t]?)?hz\b)/i;

/**
 * Lee lo que cualquier etiqueta puede traer. Lo que no está queda en
 * null: no se deduce el país de origen de la marca ni el contenido de
 * la foto.
 */
export function leerGenerico(textoCrudo: string): DatosGenericos {
  const texto = (textoCrudo || '').replace(/ /g, ' ');
  const plano = normalizar(texto);

  const origen = ORIGEN.exec(texto);
  const marca = MARCA.exec(texto);
  const modelo = MODELO.exec(texto);
  const lote = LOTE.exec(texto);
  const vence = VENCE.exec(texto);
  // El código de barras se busca en una línea propia: si no, cualquier
  // número largo de la etiqueta pasa por código.
  const barras = texto
    .split(/\r?\n/)
    .map((l) => BARRAS.exec(l.replace(/\s+/g, '')))
    .find((m): m is RegExpExecArray => Boolean(m));

  const materiales = MATERIALES.filter((m) => plano.includes(m))
    // "acero inoxidable" ya contiene "acero": se queda el más específico.
    .filter((m, _i, todos) => !todos.some((otro) => otro !== m && otro.includes(m)));

  const voltaje = VOLTAJE.exec(texto);
  const potencia = POTENCIA.exec(texto);
  const frecuencia = FRECUENCIA.exec(texto);
  const hayElectrico = Boolean(voltaje || potencia || frecuencia);

  return {
    origen: origen ? limpiar(origen[1]) : null,
    marca: marca ? limpiar(marca[1]) : null,
    modelo: modelo ? modelo[1].toUpperCase() : null,
    contenidoNeto: leerCantidad(texto),
    codigoDeBarras: barras ? barras[1] : null,
    lote: lote ? lote[1].toUpperCase() : null,
    vencimiento: vence ? vence[1] : null,
    materiales,
    electrico: hayElectrico
      ? {
          voltaje: voltaje ? voltaje[1].replace(/\s+/g, '').toUpperCase() : null,
          potencia: potencia ? potencia[1].replace(/\s+/g, '').toUpperCase() : null,
          frecuencia: frecuencia ? frecuencia[1].replace(/\s+/g, '').toUpperCase() : null,
        }
      : null,
  };
}

function limpiar(valor: string): string {
  return valor.trim().replace(/[.,;:\s]+$/, '');
}

export const PREGUNTA_GENERICA: Record<FaltaGenerica, string> = {
  origen: '¿En qué país se fabricó? De eso dependen las preferencias arancelarias.',
  contenido_neto: '¿Cuánto contiene o cuánto pesa? El arancel se declara en una unidad concreta.',
};
