import { parseTasa, limpiar, type Tasa } from '../../client/src/lib/tasaArancel';

// Los aranceles del Reino Unido y de la Unión Europea, leídos del servicio
// oficial "Trade Tariff" del gobierno británico (HMRC).
//
// Ese servicio publica dos aranceles con la misma API pública y gratuita:
//   - /api/v2/...     el arancel del Reino Unido (UK Global Tariff).
//   - /xi/api/v2/...  el arancel común de la UE (TARIC), el que se aplica
//                     en Irlanda del Norte. Es uno solo para los 27: vale
//                     igual para Alemania, Francia, Italia y España.
//
// Todo número que sale de acá es una medida que la API devolvió. La regla
// es la misma que con el HTS: lo que no se entiende no se inventa. Una
// tarifa con partes en libras o euros por kilo, o con varias medidas que
// dependen de condiciones, vuelve como "no calculable" con su texto
// original, nunca como un 0.
//
// La forma de las respuestas (JSON:API: `data` + `included`) está leída
// con tolerancia: si un campo no está donde se espera, la consulta falla
// con nombre y el cálculo sigue con lo que tenía, sin números a medias.

export type Servicio = 'uk' | 'xi';

const BASE = 'https://www.trade-tariff.service.gov.uk';
const RUTA: Record<Servicio, string> = { uk: '/api/v2', xi: '/xi/api/v2' };
const ESPERA_MS = 12_000;

/** Tipos de medida del TARIC (los mismos códigos en el Reino Unido). */
const TERCER_PAIS = '103';
const PREFERENCIA = '142';
/** Antidumping y compensatorios, definitivos y provisionales. */
const DEFENSA_COMERCIAL = new Set(['551', '552', '553', '554', '555', '561', '562', '564', '565', '566', '570']);
/** "Erga omnes": todos los países. */
const TODOS = '1011';

export class FalloArancelDestino extends Error {
  constructor(
    public causa: 'no_existe' | 'no_disponible' | 'respuesta_rara',
    public detalle: string,
    public publico: string
  ) {
    super(detalle);
  }
}

// ---- Leer JSON:API ------------------------------------------------------

interface Recurso {
  id: string;
  type: string;
  attributes?: Record<string, unknown>;
  relationships?: Record<string, { data?: { id: string; type: string } | Array<{ id: string; type: string }> | null }>;
}

function incluidos(cuerpo: unknown): Map<string, Recurso> {
  const mapa = new Map<string, Recurso>();
  const lista = (cuerpo as { included?: unknown })?.included;
  if (!Array.isArray(lista)) return mapa;
  for (const r of lista) {
    if (r && typeof r === 'object' && typeof (r as Recurso).id === 'string' && typeof (r as Recurso).type === 'string') {
      mapa.set(`${(r as Recurso).type}:${(r as Recurso).id}`, r as Recurso);
    }
  }
  return mapa;
}

function refs(r: Recurso | undefined, nombre: string): Array<{ id: string; type: string }> {
  const d = r?.relationships?.[nombre]?.data;
  if (!d) return [];
  return Array.isArray(d) ? d : [d];
}

function texto(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

// ---- Las líneas de una subpartida --------------------------------------

export interface LineaDestino {
  /** 10 dígitos, como se declara en ese destino. */
  codigo: string;
  descripcion: string;
}

/**
 * Las líneas declarables de una subpartida de 6 dígitos, desde la partida
 * de 4 (`/headings/6109`). Los primeros 6 dígitos son del Sistema
 * Armonizado y son iguales en todo el mundo; de ahí en adelante cada país
 * divide a su manera, por eso la persona elige la línea del destino.
 */
export function leerLineas(cuerpo: unknown, hs6: string): LineaDestino[] {
  const data = (cuerpo as { data?: Recurso })?.data;
  if (!data || typeof data !== 'object') throw new FalloArancelDestino('respuesta_rara', 'heading sin data', 'El arancel del destino respondió algo que no se pudo leer.');

  // Una partida que ya es declarable (no se divide) es su propia línea.
  const attrs = data.attributes ?? {};
  if (attrs.declarable === true && texto(attrs.goods_nomenclature_item_id).startsWith(hs6)) {
    return [{ codigo: texto(attrs.goods_nomenclature_item_id), descripcion: limpiar(texto(attrs.description)) }];
  }

  const todos = incluidos(cuerpo);
  const porId = new Map<string, Recurso>();
  const lineas: LineaDestino[] = [];
  for (const r of Array.from(todos.values())) {
    if (r.type !== 'commodity') continue;
    const a = r.attributes ?? {};
    const codigo = texto(a.goods_nomenclature_item_id);
    porId.set(texto(a.goods_nomenclature_sid) || r.id, r);
    if (!/^\d{10}$/.test(codigo) || !codigo.startsWith(hs6)) continue;
    // Declarable: hoja del árbol y sufijo 80 (los otros sufijos son títulos).
    const hoja = a.leaf === true || a.declarable === true;
    const sufijo = texto(a.producline_suffix) || '80';
    if (!hoja || sufijo !== '80') continue;
    lineas.push({ codigo, descripcion: limpiar(texto(a.description_plain) || texto(a.description)) });
  }
  return lineas;
}

// ---- El arancel de una línea -------------------------------------------

export interface ArancelDestino {
  codigo: string;
  descripcion: string;
  /** La tarifa para cualquier país sin preferencia (medida 103). */
  general: Tasa | null;
  /** La preferencial que le toca al país de origen, si hay (medida 142). */
  preferencial: { tasa: Tasa; acuerdo: string } | null;
  avisos: string[];
}

/** "12.00 %" → 12%. Todo lo que no es un porcentaje simple no se calcula acá. */
export function tasaDeDestino(crudo: string, moneda: 'GBP' | 'EUR'): Tasa {
  const t = limpiar(crudo);
  const pct = /^(\d+(?:\.\d+)?)\s*%$/.exec(t);
  if (pct) return parseTasa(`${parseFloat(pct[1])}%`);
  const base = parseTasa('');
  return {
    ...base,
    texto: t,
    calculable: false,
    motivo: t
      ? `Tarifa con partes en ${moneda} por cantidad o condicionada: hay que confirmarla con el agente de aduanas.`
      : 'La medida no trae tarifa.',
  };
}

function miembros(geo: Recurso | undefined, todos: Map<string, Recurso>): Set<string> {
  const ids = new Set<string>();
  for (const h of refs(geo, 'children_geographical_areas')) {
    ids.add(h.id);
    const hijo = todos.get(`geographical_area:${h.id}`);
    const codigo = texto(hijo?.attributes?.geographical_area_id);
    if (codigo) ids.add(codigo);
  }
  return ids;
}

function alcanza(medida: Recurso, origen: string, todos: Map<string, Recurso>): { si: boolean; area: Recurso | undefined } {
  const ref = refs(medida, 'geographical_area')[0];
  const area = ref ? todos.get(`geographical_area:${ref.id}`) : undefined;
  const id = texto(area?.attributes?.geographical_area_id) || ref?.id || '';
  const excluidos = new Set(refs(medida, 'excluded_countries').map((x) => x.id));
  if (excluidos.has(origen)) return { si: false, area };
  if (id === origen) return { si: true, area };
  if (id === TODOS) return { si: true, area };
  return { si: miembros(area, todos).has(origen), area };
}

export function leerArancel(cuerpo: unknown, servicio: Servicio, origen: string): ArancelDestino {
  const data = (cuerpo as { data?: Recurso })?.data;
  if (!data || typeof data !== 'object') throw new FalloArancelDestino('respuesta_rara', 'commodity sin data', 'El arancel del destino respondió algo que no se pudo leer.');
  const todos = incluidos(cuerpo);
  const moneda = servicio === 'uk' ? 'GBP' : 'EUR';
  const propio = servicio === 'uk' ? 'uk' : 'eu';

  const medidas = refs(data, 'import_measures')
    .map((r) => todos.get(`measure:${r.id}`))
    .filter((m): m is Recurso => Boolean(m))
    // El servicio de Irlanda del Norte trae también medidas británicas:
    // sólo cuentan las del arancel que se está leyendo.
    .filter((m) => {
      const o = texto(m.attributes?.origin);
      return !o || o === propio;
    });

  const tipoDe = (m: Recurso) => refs(m, 'measure_type')[0]?.id ?? '';
  const derechoDe = (m: Recurso) => {
    const ref = refs(m, 'duty_expression')[0];
    const d = ref ? todos.get(`duty_expression:${ref.id}`) : undefined;
    return texto(d?.attributes?.base) || texto(d?.attributes?.formatted_base);
  };

  const avisos: string[] = [];

  // General: la medida 103 que alcanza a todos. Si hay varias con
  // distinta tarifa, depende de una condición que no sabemos: no se elige.
  const generales = medidas.filter((m) => tipoDe(m) === TERCER_PAIS);
  const textosGenerales = Array.from(new Set(generales.map(derechoDe).map(limpiar).filter(Boolean)));
  let general: Tasa | null = null;
  if (textosGenerales.length === 1) general = tasaDeDestino(textosGenerales[0], moneda);
  else if (textosGenerales.length > 1) {
    general = { ...parseTasa(''), texto: textosGenerales.map((t) => tasaDeDestino(t, moneda).texto).join(' / '), calculable: false, motivo: 'Esta línea tiene varias tarifas generales según condiciones: hay que confirmarla con el agente de aduanas.' };
  } else {
    const basica = texto(data.attributes?.basic_duty_rate);
    if (basica) general = tasaDeDestino(basica, moneda);
  }

  // Preferencial: una 142 cuyo país o grupo incluye al de origen.
  let preferencial: ArancelDestino['preferencial'] = null;
  for (const m of medidas) {
    if (tipoDe(m) !== PREFERENCIA) continue;
    const { si, area } = alcanza(m, origen, todos);
    if (!si) continue;
    const t = derechoDe(m);
    if (!t) continue;
    const acuerdo = limpiar(texto(area?.attributes?.description)) || 'Preferencia arancelaria';
    const tasa = tasaDeDestino(t, moneda);
    // Si hay más de una, la más baja que se pueda calcular.
    if (!preferencial || (tasa.calculable && (!preferencial.tasa.calculable || porcentaje(tasa) < porcentaje(preferencial.tasa)))) {
      preferencial = { tasa, acuerdo };
    }
  }

  if (medidas.some((m) => DEFENSA_COMERCIAL.has(tipoDe(m)) && alcanza(m, origen, todos).si)) {
    avisos.push('Hay derechos antidumping o compensatorios para este origen en esta línea: no están en el cálculo. Confírmalo con tu agente de aduanas.');
  }
  avisos.push(
    servicio === 'uk'
      ? 'El Reino Unido cobra el arancel sobre el valor CIF (producto + flete + seguro) y además IVA de importación (20 %), que se recupera si tu importador está registrado.'
      : 'La UE cobra el arancel sobre el valor CIF (producto + flete + seguro) y además el IVA de importación del país de llegada, que se recupera si tu importador está registrado.'
  );

  return {
    codigo: texto(data.attributes?.goods_nomenclature_item_id),
    descripcion: limpiar(texto(data.attributes?.description_plain) || texto(data.attributes?.description)),
    general,
    preferencial,
    avisos,
  };
}

function porcentaje(t: Tasa): number {
  return t.componentes.reduce((s, c) => s + (c.tipo === 'advalorem' ? c.pct : 0), 0);
}

// ---- Consultar, con memoria --------------------------------------------

type Fetch = typeof fetch;
const HORAS_12 = 12 * 60 * 60 * 1000;
const guardado = new Map<string, { cuerpo: unknown; vence: number }>();

/** Sólo para las pruebas. */
export function olvidarConsultas(): void {
  guardado.clear();
}

async function pedir(servicio: Servicio, ruta: string, hacer: Fetch, ahora: number): Promise<unknown> {
  const url = `${BASE}${RUTA[servicio]}${ruta}`;
  const g = guardado.get(url);
  if (g && g.vence > ahora) return g.cuerpo;

  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), ESPERA_MS);
  let res: Response;
  try {
    res = await hacer(url, { headers: { accept: 'application/json' }, signal: control.signal });
  } catch (err) {
    throw new FalloArancelDestino('no_disponible', `sin respuesta de trade-tariff (${servicio}${ruta}): ${(err as Error).name}`, 'El arancel del destino no respondió. Probá de nuevo en unos minutos.');
  } finally {
    clearTimeout(reloj);
  }
  if (res.status === 404) {
    throw new FalloArancelDestino('no_existe', `trade-tariff ${servicio}${ruta} 404`, 'Ese código no existe en el arancel del destino.');
  }
  if (!res.ok) {
    throw new FalloArancelDestino('no_disponible', `trade-tariff ${servicio}${ruta} respondió ${res.status}`, 'El arancel del destino no respondió. Probá de nuevo en unos minutos.');
  }
  const cuerpo = await res.json().catch(() => null);
  if (!cuerpo) throw new FalloArancelDestino('respuesta_rara', `trade-tariff ${servicio}${ruta} sin JSON`, 'El arancel del destino respondió algo que no se pudo leer.');
  if (guardado.size >= 1000) {
    const viejo = guardado.keys().next().value;
    if (viejo !== undefined) guardado.delete(viejo);
  }
  guardado.set(url, { cuerpo, vence: ahora + HORAS_12 });
  return cuerpo;
}

export async function lineasDe(servicio: Servicio, hs6: string, hacer: Fetch = fetch, ahora = Date.now()): Promise<LineaDestino[]> {
  if (!/^\d{6}$/.test(hs6)) throw new FalloArancelDestino('no_existe', `hs6 inválido ${hs6}`, 'Subpartida inválida.');
  const cuerpo = await pedir(servicio, `/headings/${hs6.slice(0, 4)}`, hacer, ahora);
  return leerLineas(cuerpo, hs6);
}

export async function arancelDe(servicio: Servicio, codigo: string, origen: string, hacer: Fetch = fetch, ahora = Date.now()): Promise<ArancelDestino> {
  if (!/^\d{10}$/.test(codigo)) throw new FalloArancelDestino('no_existe', `código inválido ${codigo}`, 'Ese código no existe en el arancel del destino.');
  const cuerpo = await pedir(servicio, `/commodities/${codigo}`, hacer, ahora);
  return leerArancel(cuerpo, servicio, origen);
}
