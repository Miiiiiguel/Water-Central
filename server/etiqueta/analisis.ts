import { leerGenerico, PREGUNTA_GENERICA, type DatosGenericos, type FaltaGenerica } from './generico';
import {
  FAMILIAS, detectarFamilias, familiaSegura, leerAtributos, terminosDeBusqueda,
  type Familia, type ValorAtributo,
} from './familias';
import { leerEtiqueta, type Etiqueta } from './composicion';
import { leerPrenda, type Genero, type Prenda, type Tejido } from './prenda';

// El armado del análisis: de un texto suelto a datos listos para
// clasificar, y a la lista de lo que todavía falta preguntar.
//
// El orden es siempre el mismo y no depende del producto:
//
//   1. Lo que trae cualquier etiqueta (origen, marca, contenido neto).
//   2. Qué familia de producto es.
//   3. Los atributos que esa familia necesita para llegar a su partida.
//
// Si el paso 2 no queda claro, el 3 no se intenta. Preguntar "¿es de
// punto o plana?" sobre una lata de atún no es un error de cálculo: es
// haber supuesto de qué se estaba hablando.

/** Lo que se le pregunta a la persona cuando un dato no está en la foto. */
export interface Pregunta {
  campo: string;
  pregunta: string;
  /** Sin esto no hay partida. Lo no decisivo sólo afina la búsqueda. */
  decisiva: boolean;
  /** Respuestas cerradas; si va vacío, se escribe a mano. */
  opciones?: { valor: string; etiqueta: string }[];
}

export interface AtributoLeido {
  id: string;
  pregunta: string;
  decisivo: boolean;
  valor: string | null;
  /** El valor como se lee en pantalla, cuando es de opción cerrada. */
  etiqueta: string | null;
  origen: ValorAtributo['origen'];
}

export interface Analisis {
  texto: string;
  legible: boolean;
  generico: DatosGenericos;
  familia: { id: string; nombre: string; capitulos: string[] } | null;
  /** Las otras candidatas, para que la persona elija cuando hay duda. */
  candidatas: { id: string; nombre: string }[];
  atributos: AtributoLeido[];
  /** El detalle fino de una etiqueta de ropa. Null para todo lo demás. */
  textil: { etiqueta: Etiqueta; prenda: Prenda } | null;
  preguntas: Pregunta[];
  /** Los términos con los que se buscará en el arancel. En inglés. */
  terminos: string;
}

export const PREGUNTA_FAMILIA =
  '¿Qué tipo de producto es? Cada familia se clasifica con datos distintos, y no quiero preguntarte por el tejido de una camiseta si me trajiste una lata de atún.';

/** Campo con el que la pantalla contesta de qué producto se trata. */
export const CAMPO_FAMILIA = 'familia';

/**
 * El contenido neto sólo se pregunta donde decide algo. En un alimento
 * o una bebida la partida y el impuesto se declaran por peso o volumen;
 * en un juguete, no.
 */
const CONTENIDO_IMPORTA = ['alimento', 'bebida', 'cosmetico', 'aseo'];

function faltaGenerica(familia: Familia | null, datos: DatosGenericos): FaltaGenerica[] {
  const falta: FaltaGenerica[] = [];
  // El país de origen aplica a todo: de él dependen las preferencias
  // arancelarias y las medidas antidumping.
  if (!datos.origen) falta.push('origen');
  if (familia && CONTENIDO_IMPORTA.indexOf(familia.id) !== -1 && !datos.contenidoNeto) {
    falta.push('contenido_neto');
  }
  return falta;
}

/** Las familias como opciones de respuesta: primero las que el texto sugiere. */
function opcionesDeFamilia(candidatas: { id: string; nombre: string }[]) {
  const vistas = candidatas.map((c) => c.id);
  const resto = FAMILIAS.filter((f) => vistas.indexOf(f.id) === -1).map((f) => ({ id: f.id, nombre: f.nombre }));
  return candidatas.concat(resto).map((f) => ({ valor: f.id, etiqueta: f.nombre }));
}

/**
 * Lee un texto de etiqueta y devuelve todo lo que se pudo saber, más lo
 * que falta. `respuestas` es lo que la persona ya contestó: manda sobre
 * lo leído, porque quien tiene el producto en la mano es ella.
 */
export function analizar(texto: string, respuestas: Record<string, string> = {}): Analisis {
  const limpio = texto || '';
  const generico = leerGenerico(limpio);
  if (respuestas.origen) generico.origen = respuestas.origen;

  const detecciones = detectarFamilias(limpio);
  const candidatas = detecciones.slice(0, 5).map((d) => ({ id: d.familia.id, nombre: d.familia.nombre }));

  const elegida = respuestas[CAMPO_FAMILIA]
    ? FAMILIAS.find((f) => f.id === respuestas[CAMPO_FAMILIA]) ?? null
    : familiaSegura(detecciones)
      ? detecciones[0].familia
      : null;

  const valores = elegida ? leerAtributos(elegida, limpio, generico, respuestas) : [];
  const atributos: AtributoLeido[] = valores.map((v) => ({
    id: v.atributo.id,
    pregunta: v.atributo.pregunta,
    decisivo: v.atributo.decisivo,
    valor: v.valor,
    etiqueta: v.etiqueta,
    origen: v.origen,
  }));

  const textil = elegida?.id === 'textil' ? detalleTextil(limpio, valores) : null;

  return {
    texto: limpio,
    legible: Boolean(limpio.trim()),
    generico,
    familia: elegida ? { id: elegida.id, nombre: elegida.nombre, capitulos: elegida.capitulos } : null,
    candidatas: elegida ? [] : candidatas,
    atributos,
    textil,
    preguntas: preguntasDe(elegida, valores, generico, candidatas, Boolean(limpio.trim())),
    terminos: elegida ? terminosDeBusqueda(elegida, valores) : '',
  };
}

/**
 * Lo que falta, convertido en preguntas concretas y en el orden en que
 * conviene hacerlas: primero la familia (sin ella no se sabe ni qué
 * preguntar), después lo que decide la partida, y al final lo que sólo
 * afina la búsqueda.
 */
export function preguntasDe(
  familia: Familia | null,
  valores: ValorAtributo[],
  generico: DatosGenericos,
  candidatas: { id: string; nombre: string }[],
  hayTexto: boolean
): Pregunta[] {
  if (!hayTexto) return [];

  if (!familia) {
    return [{
      campo: CAMPO_FAMILIA,
      pregunta: PREGUNTA_FAMILIA,
      decisiva: true,
      opciones: opcionesDeFamilia(candidatas),
    }];
  }

  const preguntas: Pregunta[] = [];
  const delAtributo = (v: ValorAtributo): Pregunta => ({
    campo: v.atributo.id,
    pregunta: v.atributo.pregunta,
    decisiva: v.atributo.decisivo,
    opciones: v.atributo.opciones?.map((o) => ({ valor: o.valor, etiqueta: o.etiqueta })),
  });

  for (const v of valores) if (!v.valor && v.atributo.decisivo) preguntas.push(delAtributo(v));
  for (const campo of faltaGenerica(familia, generico)) {
    preguntas.push({ campo, pregunta: PREGUNTA_GENERICA[campo], decisiva: false });
  }
  for (const v of valores) if (!v.valor && !v.atributo.decisivo) preguntas.push(delAtributo(v));
  return preguntas;
}

/**
 * Para la ropa se conserva la lectura fina que ya existía: capas,
 * porcentajes, cuidados y advertencias. Es información que ninguna otra
 * familia tiene, y que un exportador de confección necesita ver.
 */
function detalleTextil(texto: string, valores: ValorAtributo[]): { etiqueta: Etiqueta; prenda: Prenda } {
  const valorDe = (id: string) => valores.find((v) => v.atributo.id === id)?.valor ?? undefined;
  return {
    etiqueta: leerEtiqueta(texto),
    prenda: leerPrenda(texto, {
      genero: valorDe('genero') as Genero | undefined,
      tejido: valorDe('tejido') as Tejido | undefined,
    }),
  };
}
