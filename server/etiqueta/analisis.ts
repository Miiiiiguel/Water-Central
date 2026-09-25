import { leerGenerico, PREGUNTA_GENERICA, type DatosGenericos, type FaltaGenerica } from './generico';
import {
  FAMILIAS, detectarFamilias, familiaDelCapitulo, familiaSegura, leerAtributos, terminosDeBusqueda,
  type Deteccion, type Familia, type ValorAtributo,
} from './familias';
import { SECCIONES, capitulo, seccion } from './capitulos';
import { separarPista } from './pista';
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
//
// Y el paso 2 no tiene callejón sin salida. Si la etiqueta no alcanza,
// se ofrecen las candidatas; si no es ninguna, se pide que la persona
// cuente qué es; si eso tampoco se reconoce, se elige de las 21
// secciones del arancel y después el capítulo. Todo producto que se
// pueda exportar está en alguna.

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
  /** Lo que llegó, entero: se reenvía con cada respuesta. */
  texto: string;
  /** Sólo lo impreso en la etiqueta: lo que se muestra como leído. */
  etiqueta: string;
  /** Qué producto se ve en la foto. No es un dato de la etiqueta. */
  pista: string | null;
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
export const PREGUNTA_DESCRIPCION =
  '¿Qué producto es? Contámelo en pocas palabras, como se lo dirías a un cliente (por ejemplo: reloj de pulsera, gafas de sol, alimento para perros).';
export const PREGUNTA_SECCION =
  'Elegí de la lista el grupo donde entra. Son los 21 grupos del arancel, y entre todos cubren cualquier producto.';
export const PREGUNTA_CAPITULO = '¿Y dentro de ese grupo, cuál es?';

/** Campo con el que la pantalla contesta de qué producto se trata. */
export const CAMPO_FAMILIA = 'familia';
/** Lo que la persona escribe cuando ninguna candidata es. */
export const CAMPO_DESCRIPCION = 'descripcion';
export const CAMPO_SECCION = 'seccion';
export const CAMPO_CAPITULO = 'capitulo';

/** "No es ninguna de esas: te cuento qué es." */
export const OTRO = 'otro';
/** "Tampoco: lo busco en la lista." Ya se contó qué era y no alcanzó. */
export const LISTA = 'lista';

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

interface Contexto {
  candidatas: { id: string; nombre: string }[];
  hayTexto: boolean;
  respuestas: Record<string, string>;
}

/**
 * Qué preguntar cuando todavía no se sabe qué producto es. Cada paso
 * deja una salida al siguiente, y el último —secciones y capítulos—
 * cubre el arancel entero: no hay producto que se quede sin lugar.
 */
function preguntaDeUbicacion({ candidatas, respuestas }: Contexto): Pregunta {
  const dicha = respuestas[CAMPO_FAMILIA];
  const contada = Boolean((respuestas[CAMPO_DESCRIPCION] || '').trim());
  const grupo = respuestas[CAMPO_SECCION] ? seccion(respuestas[CAMPO_SECCION]) : null;

  if (grupo) {
    return {
      campo: CAMPO_CAPITULO,
      pregunta: PREGUNTA_CAPITULO,
      decisiva: true,
      opciones: grupo.capitulos.map((cod) => ({ valor: cod, etiqueta: capitulo(cod)?.nombre ?? cod })),
    };
  }

  const porSecciones: Pregunta = {
    campo: CAMPO_SECCION,
    pregunta: PREGUNTA_SECCION,
    decisiva: true,
    opciones: SECCIONES.map((s) => ({ valor: s.id, etiqueta: s.nombre })),
  };
  const contame: Pregunta = { campo: CAMPO_DESCRIPCION, pregunta: PREGUNTA_DESCRIPCION, decisiva: true };

  if (dicha === LISTA) return porSecciones;
  if (dicha === OTRO && !contada) return contame;
  if (candidatas.length) {
    return {
      campo: CAMPO_FAMILIA,
      pregunta: PREGUNTA_FAMILIA,
      decisiva: true,
      opciones: [
        ...candidatas.map((c) => ({ valor: c.id, etiqueta: c.nombre })),
        // Después de contar qué es, "otro" ya no lleva a contarlo de
        // nuevo: lleva a la lista. Así no hay vuelta en círculo.
        contada
          ? { valor: LISTA, etiqueta: 'Ninguno de estos' }
          : { valor: OTRO, etiqueta: 'Otro producto' },
      ],
    };
  }
  return contada ? porSecciones : contame;
}

/**
 * De qué familia es. Manda lo que la persona eligió; después, lo que
 * contó; y recién al final, lo que se leyó.
 */
function elegirFamilia(respuestas: Record<string, string>, detecciones: Deteccion[]): Familia | null {
  const cap = respuestas[CAMPO_CAPITULO];
  if (cap && capitulo(cap)) return familiaDelCapitulo(cap);
  const dicha = respuestas[CAMPO_FAMILIA];
  const nombrada = dicha ? FAMILIAS.find((f) => f.id === dicha) : undefined;
  if (nombrada) return nombrada;
  // Una respuesta que no es ninguna familia no se acepta, y tampoco se
  // reemplaza por una elegida a escondidas: se sigue preguntando. Lo
  // mismo con quien dijo "ninguno de estos".
  if (dicha && dicha !== OTRO) return null;
  if (dicha === OTRO && !(respuestas[CAMPO_DESCRIPCION] || '').trim()) return null;
  return familiaSegura(detecciones) ? detecciones[0].familia : null;
}

/**
 * Lee un texto de etiqueta y devuelve todo lo que se pudo saber, más lo
 * que falta. `respuestas` es lo que la persona ya contestó: manda sobre
 * lo leído, porque quien tiene el producto en la mano es ella.
 */
export function analizar(texto: string, respuestas: Record<string, string> = {}): Analisis {
  // La pista (qué producto se ve en la foto) decide la familia y nada
  // más: los datos que se muestran como leídos salen sólo de la etiqueta.
  const { etiqueta, pista } = separarPista(texto || '');
  const generico = leerGenerico(etiqueta);
  if (respuestas.origen) generico.origen = respuestas.origen;

  // Si la persona contó qué es, se la escucha a ella: la etiqueta ya se
  // leyó y no alcanzó.
  const descripcion = (respuestas[CAMPO_DESCRIPCION] || '').trim();
  const detecciones = detectarFamilias(descripcion || [pista, etiqueta].filter(Boolean).join('\n'));
  const candidatas = detecciones.slice(0, 5).map((d) => ({ id: d.familia.id, nombre: d.familia.nombre }));

  const elegida = elegirFamilia(respuestas, detecciones);
  const hayTexto = Boolean(etiqueta || pista);

  const valores = elegida ? leerAtributos(elegida, etiqueta, generico, respuestas) : [];
  const atributos: AtributoLeido[] = valores.map((v) => ({
    id: v.atributo.id,
    pregunta: v.atributo.pregunta,
    decisivo: v.atributo.decisivo,
    valor: v.valor,
    etiqueta: v.etiqueta,
    origen: v.origen,
  }));

  const textil = elegida?.id === 'textil' ? detalleTextil(etiqueta, valores) : null;

  return {
    // Vuelve entero, con la pista: la pantalla lo reenvía con cada
    // respuesta y el análisis se rehace sin volver a gastar una foto.
    texto: texto || '',
    etiqueta,
    pista,
    legible: hayTexto,
    generico,
    familia: elegida ? { id: elegida.id, nombre: elegida.nombre, capitulos: elegida.capitulos } : null,
    candidatas: elegida ? [] : candidatas,
    atributos,
    textil,
    preguntas: preguntasDe(elegida, valores, generico, { candidatas, hayTexto, respuestas }),
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
  contexto: Contexto
): Pregunta[] {
  if (!contexto.hayTexto) return [];
  if (!familia) return [preguntaDeUbicacion(contexto)];

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
