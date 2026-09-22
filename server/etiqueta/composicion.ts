// De lo que dice la etiqueta a datos con los que se puede clasificar.
//
// Fase 2 del módulo de análisis de producto: recibe el texto crudo que
// devolvió el OCR y saca composición, capas, talla, origen y cuidados.
// No llama a nada ni sabe de aranceles; es una función pura, y por eso
// se puede probar contra etiquetas reales sin gastar una sola llamada.
//
// Tres cosas que la realidad obliga a tener en cuenta:
//
//   1. La etiqueta viene en el idioma que sea, y muchas veces en dos o
//      tres a la vez ("100% ALGODÓN / 100% COTTON / 100% COTON").
//   2. El OCR confunde letras con números: "P0LYESTER", "C0TT0N",
//      "ELASTAN0". Descartar esas líneas sería descartar media etiqueta.
//   3. Una prenda tiene capas. "SHELL 100% POLYESTER / LINING 100%
//      COTTON" no es una prenda de algodón: para el arancel manda la
//      tela exterior, y confundirlas cambia la partida y el porcentaje
//      que paga el cliente.

/** Una fibra reconocida, con el porcentaje que declara la etiqueta. */
export interface Fibra {
  /** Nombre normalizado, el que entiende el arancel: 'algodon', 'poliester'… */
  fibra: string;
  /** Cómo aparecía escrito en la etiqueta, por si hay que mostrarlo. */
  comoDice: string;
  /** Null cuando la etiqueta nombra la fibra pero no su porcentaje. */
  porcentaje: number | null;
}

/** Una capa de la prenda: exterior, forro, relleno… */
export interface Capa {
  capa: 'exterior' | 'forro' | 'relleno' | 'puno' | 'adorno' | 'sin_especificar';
  fibras: Fibra[];
  suma: number;
}

export interface Etiqueta {
  capas: Capa[];
  /** Las fibras de la tela exterior, que son las que clasifican. */
  fibras: Fibra[];
  /** La de mayor porcentaje del exterior: define la partida en textiles. */
  fibraPrincipal: Fibra | null;
  talla: string | null;
  origen: string | null;
  cuidados: string[];
  /** Registro del fabricante en EE. UU. (RN) y en Canadá (CA). */
  rn: string | null;
  ca: string | null;
  /** Problemas que hay que mirar antes de usar esto para clasificar. */
  advertencias: string[];
  /** Qué hace falta preguntarle a la persona. */
  faltante: Faltante[];
}

export type Faltante = 'composicion' | 'porcentajes' | 'tela_exterior' | 'origen' | 'talla';

interface Sinonimo {
  fibra: string;
  palabras: string[];
}

/**
 * El diccionario de fibras. El nombre normalizado es el que usa el
 * arancel en inglés, porque es contra ese texto que se busca después.
 */
const FIBRAS: Sinonimo[] = [
  { fibra: 'algodon', palabras: ['algodon', 'algodao', 'cotton', 'coton', 'baumwolle', 'cotone'] },
  { fibra: 'poliester', palabras: ['poliester', 'polyester', 'poliestere', 'pes'] },
  { fibra: 'elastano', palabras: ['elastano', 'elastane', 'spandex', 'lycra', 'elastan', 'elasthanne'] },
  { fibra: 'nylon', palabras: ['nylon', 'nailon', 'poliamida', 'polyamide', 'nilon'] },
  { fibra: 'lana', palabras: ['lana', 'wool', 'laine', 'merino', 'woolmark'] },
  { fibra: 'viscosa', palabras: ['viscosa', 'viscose', 'rayon', 'rayonne'] },
  { fibra: 'lino', palabras: ['lino', 'linen', 'linho', 'flax'] },
  { fibra: 'seda', palabras: ['seda', 'silk', 'soie'] },
  { fibra: 'acrilico', palabras: ['acrilico', 'acrylic', 'acrylique', 'acrilico'] },
  { fibra: 'modal', palabras: ['modal'] },
  { fibra: 'lyocell', palabras: ['lyocell', 'tencel'] },
  { fibra: 'bambu', palabras: ['bambu', 'bamboo'] },
  { fibra: 'canamo', palabras: ['canamo', 'hemp', 'canhamo'] },
  { fibra: 'yute', palabras: ['yute', 'jute'] },
  { fibra: 'cuero', palabras: ['cuero', 'leather', 'couro', 'piel'] },
  { fibra: 'poliuretano', palabras: ['poliuretano', 'polyurethane'] },
  { fibra: 'cachemira', palabras: ['cachemira', 'cashmere', 'cachemire'] },
  { fibra: 'angora', palabras: ['angora'] },
  { fibra: 'alpaca', palabras: ['alpaca'] },
];

const CAPAS: { capa: Capa['capa']; palabras: string[] }[] = [
  { capa: 'exterior', palabras: ['shell', 'exterior', 'tela exterior', 'outer', 'body', 'cuerpo', 'tejido principal', 'main fabric', 'face'] },
  { capa: 'forro', palabras: ['forro', 'lining', 'liner', 'forra'] },
  { capa: 'relleno', palabras: ['relleno', 'filling', 'padding', 'fill', 'wadding', 'insulation'] },
  { capa: 'puno', palabras: ['puno', 'puno y cuello', 'rib', 'ribbing', 'cuello', 'collar', 'cuffs'] },
  { capa: 'adorno', palabras: ['adorno', 'trim', 'ribete', 'encaje', 'lace', 'contrast'] },
];

/**
 * Letras que el OCR cambia por números y al revés. Se deshace el cambio
 * sólo para comparar contra el diccionario, nunca sobre el texto que se
 * le muestra a la persona.
 */
const CONFUSIONES: Record<string, string> = { '0': 'o', '1': 'l', '3': 'e', '4': 'a', '5': 's', '8': 'b', '|': 'l' };

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** La misma palabra, con los números que el OCR metió deshechos. */
function desconfundir(palabra: string): string {
  return palabra.replace(/[013458|]/g, (c) => CONFUSIONES[c] ?? c);
}

/** Distancia de edición, acotada: sirve para "poliesterr" o "algodn". */
function distancia(a: string, b: string, tope: number): number {
  if (Math.abs(a.length - b.length) > tope) return tope + 1;
  let fila = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const siguiente = [i];
    for (let j = 1; j <= b.length; j++) {
      siguiente[j] = Math.min(
        fila[j] + 1,
        siguiente[j - 1] + 1,
        fila[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    fila = siguiente;
    if (Math.min(...fila) > tope) return tope + 1;
  }
  return fila[b.length];
}

/**
 * ¿Esta palabra nombra una fibra? Primero exacto, después deshaciendo
 * los números del OCR, y sólo al final por parecido —con un tope corto,
 * porque confundir "lana" con "lino" sería peor que no reconocer nada.
 */
export function fibraDe(palabra: string): { fibra: string; exacta: boolean } | null {
  const limpia = normalizar(palabra).replace(/[^a-z0-9]/g, '');
  if (limpia.length < 3) return null;
  const candidatas = [limpia, desconfundir(limpia)];

  for (const c of candidatas) {
    for (const entrada of FIBRAS) {
      if (entrada.palabras.includes(c)) return { fibra: entrada.fibra, exacta: c === limpia };
    }
  }
  if (limpia.length < 5) return null;
  for (const c of candidatas) {
    for (const entrada of FIBRAS) {
      for (const p of entrada.palabras) {
        if (p.length >= 5 && distancia(c, p, 1) <= 1) return { fibra: entrada.fibra, exacta: false };
      }
    }
  }
  return null;
}

function capaDe(linea: string): Capa['capa'] | null {
  const n = normalizar(linea);
  for (const { capa, palabras } of CAPAS) {
    for (const p of palabras) {
      // La etiqueta de capa encabeza su parte: "FORRO: 100% POLIESTER".
      if (new RegExp(`(^|[^a-z])${p}([^a-z]|$)`).test(n)) return capa;
    }
  }
  return null;
}

/** Los porcentajes con su fibra, en el orden en que aparecen en el texto. */
function fibrasDeLinea(linea: string): Fibra[] {
  const encontradas: Fibra[] = [];
  // Se parte por separadores para que "65% ALGODON 35% POLIESTER" y
  // "65% ALGODON / 35% POLIESTER" den lo mismo.
  const trozos = linea.split(/[,;/·•]|\s{3,}/);
  for (const trozo of trozos) {
    const palabras = trozo.split(/\s+/).filter(Boolean);
    let pendiente: number | null = null;
    for (let i = 0; i < palabras.length; i++) {
      const bruta = palabras[i];
      const conPorcentaje = /^(\d{1,3})\s*%$/.exec(bruta) || /^(\d{1,3})%$/.exec(bruta);
      if (conPorcentaje) { pendiente = parseInt(conPorcentaje[1], 10); continue; }
      if (/^%$/.test(bruta) && /^\d{1,3}$/.test(palabras[i - 1] ?? '')) {
        pendiente = parseInt(palabras[i - 1], 10);
        continue;
      }
      const soloNumero = /^(\d{1,3})$/.exec(bruta);
      if (soloNumero && /^%/.test(palabras[i + 1] ?? '')) { pendiente = parseInt(soloNumero[1], 10); continue; }

      const fibra = fibraDe(bruta);
      if (!fibra) continue;
      // El porcentaje puede ir antes ("65% ALGODÓN") o después
      // ("ALGODÓN 65%"); se mira hacia adelante si no venía de antes.
      let porcentaje = pendiente;
      if (porcentaje === null) {
        const siguiente = palabras[i + 1] ?? '';
        const m = /^(\d{1,3})\s*%?$/.exec(siguiente);
        if (m && /%/.test(siguiente + (palabras[i + 2] ?? ''))) porcentaje = parseInt(m[1], 10);
      }
      if (porcentaje !== null && (porcentaje < 1 || porcentaje > 100)) porcentaje = null;
      encontradas.push({ fibra: fibra.fibra, comoDice: bruta.replace(/[^a-zA-Z0-9\u00c0-\u024f%]/g, ''), porcentaje });
      pendiente = null;
    }
  }
  return encontradas;
}

const ORIGEN = /\b(?:made\s+in|hecho\s+en|fabricado\s+en|hecho\s+na|feito\s+no|fabrique\s+en|produced\s+in|industria)\s+([a-zA-ZÁÉÍÓÚÑáéíóúñ .]{3,28})/i;
const TALLA = /\b(?:talla|size|tamanho|taille|tam)\b\s*[:.]?\s*([a-z0-9]{1,6})\b/i;
const RN = /\bRN\s*[:#]?\s*(\d{4,6})\b/i;
const CA = /\bCA\s*[:#]?\s*(\d{4,6})\b/i;

/**
 * Los cuidados se buscan sobre el texto SIN acentos: la etiqueta dice
 * "LAVAR A MÁQUINA" y el OCR a veces se come la tilde. Comparar con
 * acentos hacía que media etiqueta en español no se reconociera.
 */
const CUIDADOS: { clave: string; patrones: RegExp[] }[] = [
  { clave: 'lavar_a_maquina', patrones: [/lavar? a maquina/i, /machine wash/i, /lavagem a maquina/i] },
  { clave: 'lavar_a_mano', patrones: [/lavar? a mano/i, /hand wash/i] },
  { clave: 'agua_fria', patrones: [/agua fria/i, /cold water/i, /\b30\s*°?c/i] },
  { clave: 'no_blanqueador', patrones: [/no (usar )?(cloro|blanqueador|lejia)/i, /do not bleach/i, /non chlore/i] },
  { clave: 'no_secadora', patrones: [/no (usar )?secadora/i, /do not tumble dry/i, /nao secar/i] },
  { clave: 'secar_a_la_sombra', patrones: [/secar a la sombra/i, /dry in shade/i] },
  { clave: 'planchar_bajo', patrones: [/planchar.{0,12}baja/i, /iron low/i, /low heat/i] },
  { clave: 'no_planchar', patrones: [/no planchar/i, /do not iron/i] },
  { clave: 'lavado_en_seco', patrones: [/lavado en seco/i, /dry clean/i, /limpieza en seco/i] },
];

/**
 * Lee la etiqueta. Nunca completa lo que no dice: si el porcentaje no
 * está, queda en null y se pide; si la composición no aparece, se
 * devuelve vacía con la advertencia, no una suposición.
 */
export function leerEtiqueta(textoCrudo: string): Etiqueta {
  const texto = (textoCrudo || '').replace(/ /g, ' ');
  const lineas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const porCapa = new Map<Capa['capa'], Fibra[]>();
  let capaActual: Capa['capa'] = 'sin_especificar';

  for (const linea of lineas) {
    const marcada = capaDe(linea);
    const fibras = fibrasDeLinea(linea);
    // Una línea puede nombrar la capa y su composición a la vez
    // ("FORRO: 100% POLIESTER") o sólo abrir la sección.
    if (marcada) capaActual = marcada;
    if (!fibras.length) continue;
    const destino = porCapa.get(capaActual) ?? [];
    for (const f of fibras) {
      // La misma fibra repetida en la misma capa (el mismo dato en dos
      // idiomas) se cuenta una vez.
      const ya = destino.find((d) => d.fibra === f.fibra);
      if (ya) { if (ya.porcentaje === null) ya.porcentaje = f.porcentaje; continue; }
      destino.push(f);
    }
    porCapa.set(capaActual, destino);
    if (!marcada && capaActual !== 'sin_especificar') {
      // Tras una línea con composición, la capa deja de arrastrarse:
      // evita que todo lo que sigue quede colgado del último "FORRO:".
      capaActual = 'sin_especificar';
    }
  }

  const capas: Capa[] = Array.from(porCapa.entries()).map(([capa, fibras]: [Capa['capa'], Fibra[]]) => ({
    capa,
    fibras,
    suma: fibras.reduce((t: number, f: Fibra) => t + (f.porcentaje ?? 0), 0),
  }));

  // Para clasificar manda la tela exterior. Si la etiqueta no separa
  // capas, lo que haya es el exterior.
  const exterior =
    capas.find((c) => c.capa === 'exterior') ??
    capas.find((c) => c.capa === 'sin_especificar') ??
    null;
  const fibras = exterior?.fibras ?? [];

  const conPorcentaje = fibras.filter((f) => f.porcentaje !== null);
  const fibraPrincipal =
    conPorcentaje.length
      ? conPorcentaje.reduce((a, b) => (b.porcentaje! > a.porcentaje! ? b : a))
      : fibras.length === 1
        ? fibras[0]
        : null;

  const advertencias: string[] = [];
  for (const c of capas) {
    const declarados = c.fibras.filter((f) => f.porcentaje !== null);
    if (declarados.length && c.suma !== 100) {
      advertencias.push(
        c.suma < 100
          ? `Los porcentajes de la capa "${c.capa}" suman ${c.suma}%: falta leer una fibra.`
          : `Los porcentajes de la capa "${c.capa}" suman ${c.suma}%: hay algo mal leído.`
      );
    }
  }
  if (conPorcentaje.length > 1) {
    const empate = conPorcentaje.filter((f) => f.porcentaje === fibraPrincipal?.porcentaje);
    if (empate.length > 1) {
      advertencias.push('Dos fibras empatan en porcentaje: la partida depende de cuál pesa más, hay que confirmarlo.');
    }
  }

  const origen = ORIGEN.exec(texto);
  const talla = TALLA.exec(texto);
  const rn = RN.exec(texto);
  const ca = CA.exec(texto);

  const sinAcentos = normalizar(texto);
  const cuidados = CUIDADOS.filter((c) => c.patrones.some((p) => p.test(sinAcentos))).map((c) => c.clave);

  const faltante: Faltante[] = [];
  if (!fibras.length) faltante.push('composicion');
  else if (!conPorcentaje.length) faltante.push('porcentajes');
  if (capas.length > 1 && !capas.some((c) => c.capa === 'exterior')) faltante.push('tela_exterior');
  if (!origen) faltante.push('origen');
  if (!talla) faltante.push('talla');

  return {
    capas,
    fibras,
    fibraPrincipal,
    talla: talla ? talla[1].toUpperCase() : null,
    origen: origen ? origen[1].trim().replace(/[.\s]+$/, '') : null,
    cuidados,
    rn: rn ? rn[1] : null,
    ca: ca ? ca[1] : null,
    advertencias,
    faltante,
  };
}

/** La pregunta que se le hace a la persona por cada dato que falta. */
export const PREGUNTA: Record<Faltante, string> = {
  composicion: '¿Qué dice la etiqueta sobre la composición? (por ejemplo: 95% algodón, 5% elastano)',
  porcentajes: '¿Qué porcentaje tiene cada fibra? La partida cambia según cuál pese más.',
  tela_exterior: '¿Cuál de las composiciones es la de la tela exterior? Esa es la que clasifica.',
  origen: '¿En qué país se fabricó la prenda?',
  talla: '¿Qué talla es? (no cambia el arancel, pero sí la declaración)',
};
