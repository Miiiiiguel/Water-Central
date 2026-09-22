import type { Analisis, Pregunta } from './etiqueta';

// El análisis de etiqueta, dicho como lo diría Marco Polo.
//
// La pantalla /analizar podía mostrar las cinco preguntas juntas; un
// chat no. Acá se arma UN turno: lo que se entendió de la foto y la
// siguiente pregunta, una sola, con sus botones. La persona contesta y
// se arma el turno siguiente.
//
// Dos reglas heredadas del resto de Marco Polo:
//   - Sin markdown, sin viñetas y sin emojis: estas respuestas se
//     pueden leer en voz alta.
//   - Lo que no se sabe no se rellena. Si algo se dedujo, se dice que
//     se dedujo.

export type Idioma = 'es' | 'en';

export interface Turno {
  /** Lo que Marco Polo escribe. */
  texto: string;
  /** La que toca contestar ahora, o null si ya no falta nada. */
  pregunta: Pregunta | null;
  /** Botones de respuesta; vacío cuando hay que escribirla. */
  opciones: { label: string; value: string }[];
}

/** Con qué valor viaja una respuesta a una pregunta de la etiqueta. */
export function respuestaChip(campo: string, valor: string): string {
  return `__etiqueta:${campo}=${valor}__`;
}

const CHIP = /^__etiqueta:([a-z_]{1,40})=(.{1,120})__$/;

export function leerChip(valor: string): { campo: string; valor: string } | null {
  const m = CHIP.exec(valor);
  return m ? { campo: m[1], valor: m[2] } : null;
}

/** El resumen de lo que se leyó, en una frase por dato y sin adornos. */
function loQueSeLeyo(a: Analisis, idioma: Idioma): string[] {
  const es = idioma === 'es';
  const lineas: string[] = [];
  const g = a.generico;

  if (a.familia) {
    lineas.push(
      es
        ? `Es ${a.familia.nombre.toLowerCase()}. En el arancel eso vive en ${
            a.familia.capitulos.length === 1 ? 'el capítulo' : 'los capítulos'
          } ${a.familia.capitulos.join(', ')}.`
        : `It is ${a.familia.nombre.toLowerCase()}. In the tariff schedule that lives in ${
            a.familia.capitulos.length === 1 ? 'chapter' : 'chapters'
          } ${a.familia.capitulos.join(', ')}.`
    );
  }

  const datos: string[] = [];
  if (g.marca) datos.push(es ? `marca ${g.marca}` : `brand ${g.marca}`);
  if (g.origen) datos.push(es ? `hecho en ${g.origen}` : `made in ${g.origen}`);
  if (g.contenidoNeto) datos.push(`${g.contenidoNeto.valor} ${g.contenidoNeto.unidad}`);
  if (g.modelo) datos.push(es ? `modelo ${g.modelo}` : `model ${g.modelo}`);
  for (const at of a.atributos) {
    if (!at.valor || at.origen === 'supuesto') continue;
    datos.push((at.etiqueta ?? at.valor).toLowerCase());
  }
  if (datos.length) {
    lineas.push((es ? 'Leí: ' : 'I read: ') + datos.join(', ') + '.');
  }

  // Lo deducido se nombra aparte y se deja corregir. Un supuesto que
  // pasa por dato leído es el que termina en una partida equivocada.
  const supuestos = a.atributos.filter((at) => at.origen === 'supuesto' && at.valor);
  for (const at of supuestos) {
    lineas.push(
      es
        ? `Supuse ${(at.etiqueta ?? at.valor ?? '').toLowerCase()}, porque en este tipo de producto casi siempre lo es. Si no, corregime.`
        : `I assumed ${(at.etiqueta ?? at.valor ?? '').toLowerCase()}, because it almost always is for this kind of product. Correct me if not.`
    );
  }

  return lineas;
}

/**
 * Arma el turno: lo que se entendió y la siguiente pregunta. Las
 * preguntas vienen ya ordenadas por el servidor —primero lo que decide
 * la partida— así que acá se toma la primera y nada más.
 */
export function turnoDe(a: Analisis, idioma: Idioma): Turno {
  const es = idioma === 'es';

  if (!a.legible) {
    return {
      texto: es
        ? 'No se leyó nada en esa foto. Acercá la cámara a la etiqueta, que quede plana y con buena luz, y probá otra vez.'
        : 'Nothing could be read in that photo. Move the camera closer to the label, keep it flat and well lit, and try again.',
      pregunta: null,
      opciones: [{ label: es ? 'Otra foto' : 'Another photo', value: '__analizar__' }],
    };
  }

  const lineas = loQueSeLeyo(a, idioma);
  const pregunta = a.preguntas[0] ?? null;

  if (!pregunta) {
    lineas.push(
      es
        ? 'Con esto ya tengo lo que hace falta para clasificarlo. La partida y el arancel son lo próximo que entra.'
        : 'That is everything needed to classify it. The tariff line and the duty are what comes next.'
    );
    return {
      texto: lineas.join('\n'),
      pregunta: null,
      opciones: [{ label: es ? 'Analizar otro producto' : 'Analyze another product', value: '__analizar__' }],
    };
  }

  const faltan = a.preguntas.length;
  if (faltan > 1) {
    lineas.push(
      es
        ? `Me faltan ${faltan} datos. Vamos de a uno.`
        : `I am missing ${faltan} details. One at a time.`
    );
  }
  lineas.push(pregunta.pregunta);

  return {
    texto: lineas.join('\n'),
    pregunta,
    opciones: (pregunta.opciones ?? []).map((o) => ({
      label: o.etiqueta,
      value: respuestaChip(pregunta.campo, o.valor),
    })),
  };
}
