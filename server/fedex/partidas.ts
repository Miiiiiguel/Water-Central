import type { Analisis } from '../etiqueta/analisis';
import { CAMPO_DESCRIPCION } from '../etiqueta/analisis';
import { arancelDe, cargar, formatearCodigo, normalizarCodigo, registro } from '../hts/store';
import { buscarCodigos, fallo, leerConfiguracion, type Configuracion } from './cliente';

// De un análisis de etiqueta a partidas sugeridas, y de ahí sólo a las
// que existen en el arancel cargado.
//
// La regla que manda acá es la del proyecto: ninguna IA pone un código
// que no esté vinculado a un registro del HTS que cargamos. El servicio
// de FedEx es una IA (lo dicen ellos), así que lo que devuelve es una
// lista de candidatos, no una respuesta. Cada código pasa por
// `registro()`: si existe, sale con NUESTRA descripción y NUESTRA
// tarifa; si no existe, se descarta y queda en el log. No se recorta un
// código de diez dígitos para que "entre" como uno de ocho: eso sería
// fabricar una partida.
//
// Todo lo de este archivo es puro salvo `sugerirPartidas`, que es la
// única que sale a la red.

type Indice = ReturnType<typeof cargar>;

/** A dónde exportan los clientes de Easycomex. */
export const DESTINO = 'US';

// El país de origen tal como aparece en una etiqueta ("HECHO EN
// COLOMBIA", "MADE IN VIET NAM") o como lo escribe la persona, a su
// código ISO. Son los orígenes de los clientes y de sus proveedores; uno
// que no esté acá no se manda, porque con el destino alcanza.
const PAISES: Record<string, string> = {
  COLOMBIA: 'CO', MEXICO: 'MX', PERU: 'PE', ECUADOR: 'EC', CHILE: 'CL', ARGENTINA: 'AR',
  BRASIL: 'BR', BRAZIL: 'BR', GUATEMALA: 'GT', 'COSTA RICA': 'CR', PANAMA: 'PA', HONDURAS: 'HN',
  'EL SALVADOR': 'SV', NICARAGUA: 'NI', 'REPUBLICA DOMINICANA': 'DO', 'DOMINICAN REPUBLIC': 'DO',
  BOLIVIA: 'BO', PARAGUAY: 'PY', URUGUAY: 'UY', VENEZUELA: 'VE',
  CHINA: 'CN', PRC: 'CN', 'P R C': 'CN', VIETNAM: 'VN', 'VIET NAM': 'VN', INDIA: 'IN', BANGLADESH: 'BD',
  PAKISTAN: 'PK', CAMBOYA: 'KH', CAMBODIA: 'KH', INDONESIA: 'ID', TAILANDIA: 'TH', THAILAND: 'TH',
  TAIWAN: 'TW', COREA: 'KR', 'COREA DEL SUR': 'KR', KOREA: 'KR', 'SOUTH KOREA': 'KR', JAPON: 'JP', JAPAN: 'JP',
  TURQUIA: 'TR', TURKEY: 'TR', ESPANA: 'ES', SPAIN: 'ES', ITALIA: 'IT', ITALY: 'IT', PORTUGAL: 'PT',
  FRANCIA: 'FR', FRANCE: 'FR', ALEMANIA: 'DE', GERMANY: 'DE', CANADA: 'CA',
  'ESTADOS UNIDOS': 'US', 'UNITED STATES': 'US', USA: 'US', 'U S A': 'US', EEUU: 'US', 'EE UU': 'US',
};

function plano(texto: string): string {
  return texto
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** "Colombia", "HECHO EN COLOMBIA.", "Viet Nam" → código ISO, o null. */
export function codigoDePais(nombre: string | null | undefined): string | null {
  if (!nombre) return null;
  const limpio = plano(nombre);
  if (PAISES[limpio]) return PAISES[limpio];
  // "COLOMBIA S A S", "CHINA 2024": se prueba desde el principio.
  const palabras = limpio.split(' ');
  for (let n = Math.min(3, palabras.length); n >= 1; n--) {
    const inicio = palabras.slice(0, n).join(' ');
    if (PAISES[inicio]) return PAISES[inicio];
  }
  return null;
}

/** El material que más pesa, si la etiqueta o la persona lo dijeron. */
function materialDe(a: Analisis): string | null {
  const fibra = a.textil?.etiqueta.fibraPrincipal?.fibra;
  if (fibra) return fibra;
  const atributo = a.atributos.find((at) => /material|fibra/.test(at.id) && at.valor);
  if (atributo) return (atributo.etiqueta ?? atributo.valor)?.toLowerCase() ?? null;
  return a.generico.materiales[0] ?? null;
}

/**
 * El pedido, armado con lo que ya se sabe. FedEx pide al menos una
 * descripción y un país; cuanto más detalle, mejor clasifica. Se manda
 * sólo lo que se sabe: un campo inventado empeora la sugerencia.
 */
export function armarPedido(
  a: Analisis,
  respuestas: Record<string, string> = {}
): { hsClassify: Record<string, unknown>[] } | null {
  if (!a.familia) return null;

  const contada = (respuestas[CAMPO_DESCRIPCION] || '').trim();
  const atributos = a.atributos
    .filter((at) => at.valor)
    .map((at) => (at.etiqueta ?? at.valor ?? '').toLowerCase());
  // Las primeras líneas de la etiqueta suelen ser el nombre del producto.
  const etiqueta = a.etiqueta.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 4).join(', ');

  const descripcion = [a.pista, contada, a.familia.nombre, atributos.join(', '), etiqueta, a.terminos]
    .map((p) => (p || '').trim())
    .filter(Boolean)
    .join('. ')
    .slice(0, 450);

  const item: Record<string, unknown> = {
    commodityName: (a.pista || contada || a.familia.nombre).slice(0, 80),
    commodityDescription: descripcion,
    destinationCountryCodes: [DESTINO],
  };

  const origen = codigoDePais(a.generico.origen);
  if (origen && origen !== DESTINO) {
    item.originCountryCode = origen;
    item.countryOfManufacture = origen;
  }
  const material = materialDe(a);
  if (material) item.material = material;
  if (a.generico.codigoDeBarras) item.productId = a.generico.codigoDeBarras;

  return { hsClassify: [item] };
}

export interface Sugerencia {
  /** Sólo dígitos. */
  digitos: string;
  nombre: string;
  /** Una alternativa de arancel, no una de las subpartidas principales. */
  alterna: boolean;
}

/** Dónde puede venir el código dentro de una opción. */
const CLAVES_CODIGO = ['hsCode', 'harmonizedCode', 'hsNumber', 'subheading', 'subheadingCode', 'code', 'tariffCode', 'classificationCode'];
const CLAVES_NOMBRE = ['customsDescription', 'description', 'name', 'subheadingName'];

function comoCodigo(valor: unknown): string | null {
  if (typeof valor !== 'string' && typeof valor !== 'number') return null;
  const digitos = normalizarCodigo(String(valor));
  return [4, 6, 8, 10].indexOf(digitos.length) !== -1 ? digitos : null;
}

function codigoDeOpcion(opcion: Record<string, unknown>): string | null {
  for (const clave of CLAVES_CODIGO) {
    const d = comoCodigo(opcion[clave]);
    if (d) return d;
  }
  return null;
}

function nombreDeOpcion(opcion: Record<string, unknown>): string {
  for (const clave of CLAVES_NOMBRE) {
    const v = opcion[clave];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

function comoLista(valor: unknown): Record<string, unknown>[] {
  return Array.isArray(valor) ? valor.filter((x): x is Record<string, unknown> => Boolean(x) && typeof x === 'object') : [];
}

/**
 * Lee la respuesta sin confiar en su forma exacta. La documentación
 * describe los campos pero no todos sus nombres, y el de las
 * alternativas viene escrito "tarriffAlternates", con doble r: se
 * aceptan las dos grafías. Si un campo no está, se sigue con el
 * siguiente; un nombre mal adivinado acá sólo puede perder candidatos,
 * nunca inventarlos, porque todos pasan después por el arancel.
 */
export function leerRespuesta(cuerpo: unknown): Sugerencia[] {
  const salida = (cuerpo as { output?: { hsClassifications?: unknown } })?.output;
  let clasificaciones = comoLista(salida?.hsClassifications);

  // Si vinieron varias (origen y destino), la que importa es la del
  // destino: es el arancel de EE. UU. el que se va a aplicar.
  const delDestino = clasificaciones.filter((c) => {
    const pais = c.countryCode ?? c.country;
    const tipo = String(c.countryType ?? '').toUpperCase();
    return pais === DESTINO || tipo.indexOf('DEST') !== -1;
  });
  if (delDestino.length) clasificaciones = delDestino;

  const vistas = new Set<string>();
  const principales: Sugerencia[] = [];
  const alternas: Sugerencia[] = [];
  const sumar = (lista: Sugerencia[], opcion: Record<string, unknown>, alterna: boolean) => {
    const digitos = codigoDeOpcion(opcion);
    if (!digitos || vistas.has(digitos)) return;
    vistas.add(digitos);
    lista.push({ digitos, nombre: nombreDeOpcion(opcion), alterna });
  };

  for (const c of clasificaciones) {
    const opciones = comoLista(c.subheadingOptions);
    // Vienen ordenadas por confianza; si trajeran el puntaje y no el
    // orden, se reordena, sin descartar ninguna.
    const puntaje = (o: Record<string, unknown>) =>
      typeof o.confidenceScore === 'number' ? o.confidenceScore : Number(o.confidenceScore) || 0;
    const ordenadas = opciones.slice().sort((x, y) => puntaje(y) - puntaje(x));
    for (const o of ordenadas) {
      sumar(principales, o, false);
      for (const alt of comoLista(o.tarriffAlternates ?? o.tariffAlternates)) sumar(alternas, alt, true);
    }
    for (const alt of comoLista(c.tarriffAlternates ?? c.tariffAlternates)) sumar(alternas, alt, true);
  }
  return principales.concat(alternas);
}

export interface Partida {
  /** Como se escribe: 9102.11.00.00 */
  codigo: string;
  /** La descripción del arancel cargado, no la del proveedor. */
  descripcion: string;
  /** La tarifa general, heredada del padre si la línea no la trae. */
  tarifa: string | null;
  /** De qué partida sale la tarifa, cuando es heredada. */
  tarifaSegun: string | null;
  alterna: boolean;
}

function sinHtml(texto: string): string {
  return texto.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * El cruce. Lo que no existe en el arancel cargado no sale; lo que sí,
 * sale descrito y tarifado por el arancel, no por quien lo sugirió.
 */
export function cruzarConArancel(
  sugerencias: Sugerencia[],
  idx?: Indice,
  maximo = 5
): { partidas: Partida[]; descartadas: string[] } {
  const partidas: Partida[] = [];
  const descartadas: string[] = [];
  for (const s of sugerencias) {
    const r = idx ? registro(s.digitos, idx) : registro(s.digitos);
    if (!r) {
      descartadas.push(formatearCodigo(s.digitos));
      continue;
    }
    if (partidas.length >= maximo) continue;
    const ruta = r.rutaDescripcion.map(sinHtml).filter(Boolean);
    const tarifa = idx ? arancelDe(s.digitos, idx) : arancelDe(s.digitos);
    partidas.push({
      codigo: r.fila.htsno || formatearCodigo(r.digitos),
      // Las dos últimas líneas: "Other" solo no dice nada.
      descripcion: ruta.slice(-2).join(' › '),
      tarifa: tarifa?.texto ?? null,
      tarifaSegun: tarifa?.heredado ? tarifa.segun : null,
      alterna: s.alterna,
    });
  }
  return { partidas, descartadas };
}

export interface ResultadoPartidas {
  partidas: Partida[];
  /** Cuántos códigos sugirió el proveedor en total. */
  sugeridas: number;
  /** Los que no existen en el arancel cargado. Sólo para el log. */
  descartadas: string[];
}

/**
 * La consulta completa. Sin configuración no sale a la red; sin familia
 * no hay nada que preguntar todavía.
 */
export async function sugerirPartidas(
  a: Analisis,
  respuestas: Record<string, string> = {},
  deps: { config?: Configuracion | null; hacer?: typeof fetch; idx?: Indice } = {}
): Promise<ResultadoPartidas> {
  const config = deps.config === undefined ? leerConfiguracion() : deps.config;
  if (!config) throw fallo('no_configurado', 'faltan FEDEX_CLIENT_ID / FEDEX_CLIENT_SECRET');

  const pedido = armarPedido(a, respuestas);
  if (!pedido) return { partidas: [], sugeridas: 0, descartadas: [] };

  const cuerpo = await buscarCodigos(pedido, config, deps.hacer ?? fetch);
  const sugerencias = leerRespuesta(cuerpo);
  const { partidas, descartadas } = cruzarConArancel(sugerencias, deps.idx);
  return { partidas, sugeridas: sugerencias.length, descartadas };
}
