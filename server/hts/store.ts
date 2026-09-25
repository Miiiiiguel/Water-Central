import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// El arancel de Estados Unidos, tal como lo publica la USITC.
//
// El archivo (hts.ndjson.gz) es una copia literal del export oficial: no
// se corrige, no se completa, no se borra una fila porque parezca
// redundante. Todo lo que este módulo agrega —quién es el padre de una
// partida, la descripción completa, qué arancel le aplica— se calcula al
// leerlo y vive aparte del registro original, en `derivado`.
//
// Por qué importa: una partida de diez dígitos casi nunca trae tarifa.
// En el export, 6101.20.00.10 ("Men's (334)") tiene la columna del
// arancel VACÍA; el 15.9% está en su padre, 6101.20.00 ("Of cotton").
// Quien lea la fila sola concluye que no paga arancel. Por eso
// `arancelDe()` sube por el árbol hasta encontrar la tarifa que manda, y
// dice de qué partida la sacó.

/** Una fila del export, con sus nueve columnas intactas. */
export interface HtsFila {
  htsno: string;
  indent: string;
  description: string;
  units: string;
  general: string;
  special: string;
  other: string;
  quota: string;
  additional: string;
}

/** Lo que calculamos nosotros. Nunca pisa una columna del original. */
export interface HtsRegistro {
  /** La fila del export, sin tocar. */
  fila: HtsFila;
  /** Posición en el archivo: es la identidad estable de una fila sin número. */
  linea: number;
  nivel: number;
  /** Línea del padre, o null en la raíz del capítulo. */
  padre: number | null;
  /**
   * La descripción completa, de la partida raíz hasta esta fila.
   * "Other" no significa nada solo; "Live horses... > Horses: > Other" sí.
   */
  rutaDescripcion: string[];
  /** Los dígitos sin puntos: 4, 6, 8 o 10. Vacío si la fila no tiene número. */
  digitos: string;
}

export interface ArancelResuelto {
  /** El texto tal cual lo publica la USITC: "15.9%", "Free", "13.6¢/kg + 6%". */
  texto: string;
  /** De qué partida salió. Si no es la consultada, fue heredado del padre. */
  segun: string;
  heredado: boolean;
  /** Tarifas preferenciales por acuerdo, tal cual las publica la USITC. */
  especial: string;
}

interface Indice {
  registros: HtsRegistro[];
  porCodigo: Map<string, HtsRegistro>;
  meta: { filas: number; cargadoEl: string; fuente: string };
}

let indice: Indice | null = null;

/** Quita puntos y espacios: 6101.20.00.10 y 6101200010 son la misma partida. */
export function normalizarCodigo(codigo: string): string {
  return (codigo || '').replace(/[^0-9]/g, '');
}

/** Cómo se escribe un código: 6101200010 -> 6101.20.00.10 */
export function formatearCodigo(digitos: string): string {
  const d = normalizarCodigo(digitos);
  const partes = [d.slice(0, 4), d.slice(4, 6), d.slice(6, 8), d.slice(8, 10)].filter(Boolean);
  return partes.join('.');
}

/**
 * El indent del export viene como texto y a veces con cero adelante
 * ("03"). Se lee como número; lo que no sea número queda en 0.
 */
function nivelDe(indent: string): number {
  const n = parseInt(indent, 10);
  return Number.isFinite(n) ? n : 0;
}

function rutaDelArchivo(nombre: string): string {
  // En desarrollo corre desde server/hts/. Compilado con esbuild, el
  // bundle queda en dist/ y los datos se copian al lado.
  const aqui = dirname(fileURLToPath(import.meta.url));
  return join(aqui, nombre);
}

function construir(cuerpo: string, meta: Indice['meta']): Indice {
  const registros: HtsRegistro[] = [];
  const porCodigo = new Map<string, HtsRegistro>();
  // Pila de ancestros por nivel: en la posición N está la última fila
  // vista de nivel N, que es el padre de la próxima de nivel N+1.
  const ancestros: HtsRegistro[] = [];

  let linea = 0;
  for (const texto of cuerpo.split('\n')) {
    if (!texto) continue;
    const fila = JSON.parse(texto) as HtsFila;
    const nivel = nivelDe(fila.indent);
    const padre = nivel > 0 ? (ancestros[nivel - 1] ?? null) : null;

    const registro: HtsRegistro = {
      fila,
      linea,
      nivel,
      padre: padre ? padre.linea : null,
      rutaDescripcion: [...(padre?.rutaDescripcion ?? []), fila.description].filter(Boolean),
      digitos: normalizarCodigo(fila.htsno),
    };

    registros.push(registro);
    ancestros[nivel] = registro;
    ancestros.length = nivel + 1;

    // Si un código apareciera dos veces gana el primero: el export los
    // trae en orden y el primero es la partida, no una nota al pie.
    if (registro.digitos && !porCodigo.has(registro.digitos)) porCodigo.set(registro.digitos, registro);
    linea++;
  }

  return { registros, porCodigo, meta };
}

/** Carga el arancel en memoria la primera vez que alguien lo consulta. */
export function cargar(): Indice {
  if (indice) return indice;
  const cuerpo = gunzipSync(readFileSync(rutaDelArchivo('hts.ndjson.gz'))).toString('utf8');
  let meta = { filas: 0, cargadoEl: 'desconocido', fuente: 'USITC' };
  try {
    meta = { ...meta, ...JSON.parse(readFileSync(rutaDelArchivo('hts.meta.json'), 'utf8')) };
  } catch {
    // El arancel se puede consultar sin la ficha de procedencia.
  }
  indice = construir(cuerpo, meta);
  return indice;
}

/** Sólo para las pruebas: arma un índice con filas escritas a mano. */
export function indiceDePrueba(filas: Partial<HtsFila>[]): Indice {
  const cuerpo = filas
    .map((f) =>
      JSON.stringify({
        htsno: '', indent: '0', description: '', units: '',
        general: '', special: '', other: '', quota: '', additional: '', ...f,
      })
    )
    .join('\n');
  return construir(cuerpo, { filas: filas.length, cargadoEl: 'prueba', fuente: 'prueba' });
}

export function ficha(): Indice['meta'] {
  return cargar().meta;
}

/** ¿Existe esta partida en el arancel cargado? */
export function existe(codigo: string, idx: Indice = cargar()): boolean {
  return idx.porCodigo.has(normalizarCodigo(codigo));
}

export function registro(codigo: string, idx: Indice = cargar()): HtsRegistro | null {
  return idx.porCodigo.get(normalizarCodigo(codigo)) ?? null;
}

/** La partida y todos sus ancestros, de la raíz hacia abajo. */
export function linaje(codigo: string, idx: Indice = cargar()): HtsRegistro[] {
  const r = registro(codigo, idx);
  if (!r) return [];
  const cadena: HtsRegistro[] = [r];
  let actual = r;
  while (actual.padre !== null) {
    actual = idx.registros[actual.padre];
    cadena.unshift(actual);
  }
  return cadena;
}

/**
 * El arancel que realmente aplica, subiendo por el árbol hasta
 * encontrarlo. Devuelve null sólo si ni la partida ni ninguno de sus
 * padres publica tarifa — y entonces se dice, no se asume "Free".
 */
export function arancelDe(codigo: string, idx: Indice = cargar()): ArancelResuelto | null {
  const cadena = linaje(codigo, idx);
  if (!cadena.length) return null;
  for (let i = cadena.length - 1; i >= 0; i--) {
    const r = cadena[i];
    if (r.fila.general.trim()) {
      return {
        texto: r.fila.general.trim(),
        segun: r.fila.htsno || formatearCodigo(r.digitos),
        heredado: i !== cadena.length - 1,
        especial: r.fila.special.trim(),
      };
    }
  }
  return null;
}

/**
 * La unidad en que se declara la cantidad ("doz.", "kg"). También se
 * hereda: el export la pone en la línea estadística y a veces arriba.
 */
export function unidadesDe(codigo: string, idx: Indice = cargar()): string[] {
  const cadena = linaje(codigo, idx);
  for (let i = cadena.length - 1; i >= 0; i--) {
    const crudo = cadena[i].fila.units.trim();
    if (!crudo) continue;
    try {
      const lista = JSON.parse(crudo) as string[];
      // El export subraya la unidad principal con HTML: "<u>kg</u>".
      return lista.map((u) => u.replace(/<\/?u>/g, '').trim()).filter(Boolean);
    } catch {
      return [crudo];
    }
  }
  return [];
}

export interface Coincidencia {
  registro: HtsRegistro;
  puntaje: number;
}

const VACIAS = new Set([
  'of', 'the', 'and', 'or', 'other', 'with', 'for', 'to', 'in', 'a', 'an',
  'not', 'than', 'nesoi', 'containing', 'whether', 'parts', 'articles',
]);

function tokens(texto: string): string[] {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9%]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !VACIAS.has(t));
}

// Las palabras de cada fila se sacan una sola vez. Antes se volvían a
// sacar de las 35.000 filas en cada búsqueda: tres cuartos de segundo
// por letra escrita en la calculadora.
const tokensCache = new WeakMap<Indice, Array<{ heno: string[]; conjunto: Set<string>; final: Set<string> }>>();

function tokensDe(r: HtsRegistro, idx: Indice) {
  let lista = tokensCache.get(idx);
  if (!lista) {
    lista = [];
    tokensCache.set(idx, lista);
  }
  let t = lista[r.linea];
  if (!t) {
    const heno = tokens(r.rutaDescripcion.join(' '));
    t = { heno, conjunto: new Set(heno), final: new Set(tokens(r.fila.description)) };
    lista[r.linea] = t;
  }
  return t;
}

/**
 * Busca partidas por palabras, sobre la descripción completa (la ruta),
 * no sólo sobre la última línea. Es la única puerta por la que puede
 * salir un código: el motor de clasificación elige entre estos
 * resultados y no puede escribir uno que no haya salido de acá.
 */
export function buscar(
  consulta: string,
  opciones: { capitulo?: string; soloEstadisticas?: boolean; limite?: number } = {},
  idx: Indice = cargar()
): Coincidencia[] {
  const palabras = tokens(consulta);
  if (!palabras.length) return [];
  const capitulo = opciones.capitulo ? normalizarCodigo(opciones.capitulo) : '';
  const limite = opciones.limite ?? 20;

  const resultados: Coincidencia[] = [];
  for (const r of idx.registros) {
    if (!r.digitos) continue;
    if (capitulo && !r.digitos.startsWith(capitulo)) continue;
    if (opciones.soloEstadisticas && r.digitos.length !== 10) continue;

    const { heno, conjunto, final } = tokensDe(r, idx);
    if (!heno.length) continue;

    let aciertos = 0;
    for (const p of palabras) {
      if (conjunto.has(p)) { aciertos += 2; continue; }
      if (heno.some((h) => h.startsWith(p) || p.startsWith(h))) aciertos += 1;
    }
    if (!aciertos) continue;

    // Una partida específica vale más que una genérica con las mismas
    // palabras, y la coincidencia en la línea final más que en el título
    // del capítulo.
    const enHoja = palabras.filter((p) => final.has(p)).length;
    resultados.push({ registro: r, puntaje: aciertos * 10 + enHoja * 3 + r.digitos.length });
  }

  resultados.sort((a, b) => b.puntaje - a.puntaje || a.registro.linea - b.registro.linea);
  return resultados.slice(0, limite);
}
