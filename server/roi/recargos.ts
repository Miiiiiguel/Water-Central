// Recargos adicionales de EE. UU. según el país de origen, encima del
// arancel de la partida. Viven en el servidor como el resto de los
// supuestos del modelo: el cliente no los ve por separado (en el desglose
// pagado van sumados a "aranceles").
//
// Hay dos capas:
//
// 1. Sección 301 por trabajo forzoso (USTR, acción final del 23 de julio
//    de 2026, en vigor desde el 24 de julio de 2026, partidas 9903.05.20
//    a 9903.06.21). 10 % o 12,5 % según la economía, encima de todo lo
//    demás. Un TLC NO lo exime: las únicas excepciones por acuerdo son
//    los productos que califican por el T-MEC (México) y los textiles y
//    prendas que califican por CAFTA-DR. Hay productos excluidos para
//    todos los orígenes (anexos I y II de la acción final).
//
// 2. Sección 301 a China (listas 1 a 4A de 2018–2019 y alzas de la
//    revisión de 2024). Va además de la capa 1.
//
// Cuando USTR o la USITC cambien algo, se actualiza acá y en las pruebas
// (server/roi/recargos.test.ts). Las tablas de abajo se escribieron a
// mano desde los anuncios oficiales: el arancel cargado (htsdata.csv) no
// trae las notas del capítulo 99 que dicen qué partida va en qué lista.

/** Sección 301 por trabajo forzoso, por país de origen (ISO). Los que no están, 0. */
export const TRABAJO_FORZOSO: Record<string, number> = {
  // 12,5 %
  CO: 0.125,
  PE: 0.125,
  CL: 0.125,
  BR: 0.125,
  CR: 0.125,
  DO: 0.125,
  NI: 0.125,
  UY: 0.125,
  VE: 0.125,
  CN: 0.125,
  // 10 %
  MX: 0.1,
  EC: 0.1,
  AR: 0.1,
  SV: 0.1,
  GT: 0.1,
  HN: 0.1,
  // Panamá, Paraguay y Bolivia no están entre las 60 economías.
};

/** CAFTA-DR: sus textiles y prendas que califican no pagan el recargo. */
const CAFTA = new Set(['CR', 'DO', 'SV', 'GT', 'HN', 'NI']);

/**
 * Productos excluidos del recargo por trabajo forzoso, para cualquier
 * origen, por prefijo de la partida (sin puntos). Es lo que nombra la
 * acción final: café, cacao, banano y frutas, pescados y mariscos,
 * petróleo, gas, carbón, oro, cobre, minerales críticos, fármacos y
 * aeronaves civiles. La lista oficial tiene además cientos de
 * subpartidas sueltas que acá no están: en esas el cálculo cobra el
 * recargo de más, nunca de menos.
 */
export const EXCLUIDOS_TRABAJO_FORZOSO = [
  '03', // pescados y mariscos
  '08', // frutas y nueces, banano incluido
  '0901', // café
  '1604', '1605', // preparaciones de pescado y mariscos
  '18', // cacao y sus preparaciones
  '2602', '2603', '2604', '2605', '2608', // minerales de manganeso, cobre, níquel, cobalto, zinc
  '2701', '2702', '2703', '2704', // carbón y coque
  '2709', '2710', '2711', // petróleo y gas
  '280530', '2846', // tierras raras
  '282520', '283691', // litio
  '30', // productos farmacéuticos
  '7108', // oro
  '74', '75', '79', // cobre, níquel, zinc
  '8105', '8111', // cobalto, manganeso
  '88', // aeronaves civiles y sus partes
];

/** Sección 301 a China: lo que no está en la tabla paga el 25 % de las listas 1 a 3. */
export const CHINA_301_GENERAL = 0.25;

/** Por prefijo; gana el más largo. */
export const CHINA_301: Array<[string, number]> = [
  // Lista 4A (7,5 %): la ropa y el calzado.
  ['61', 0.075],
  ['62', 0.075],
  ['64', 0.075],
  // Lista 4B (suspendida): juguetes, portátiles, celulares y consolas.
  ['9503', 0],
  ['8471', 0],
  ['851713', 0],
  ['950450', 0],
  // Revisión de 2024: semiconductores y celdas solares, vehículos eléctricos.
  ['8541', 0.5],
  ['8542', 0.5],
  ['870380', 1],
];

const digitos = (codigo: string) => codigo.replace(/\D/g, '');
const empiezaCon = (d: string, prefijos: string[]) => prefijos.some((p) => d.startsWith(p));

export function esTextil(codigo: string): boolean {
  const cap = Number(digitos(codigo).slice(0, 2));
  return cap >= 50 && cap <= 63;
}

export function china301(codigo: string | null): number {
  if (!codigo) return CHINA_301_GENERAL;
  const d = digitos(codigo);
  let mejor: [string, number] | null = null;
  for (const fila of CHINA_301) if (d.startsWith(fila[0]) && (!mejor || fila[0].length > mejor[0].length)) mejor = fila;
  return mejor ? mejor[1] : CHINA_301_GENERAL;
}

export interface Caso {
  destino: string;
  origen: string;
  /** La partida elegida, si hay. Sin partida no se aplican exclusiones por producto. */
  codigo: string | null;
  /** El producto cumple las reglas de origen del acuerdo con EE. UU. */
  califica: boolean;
}

/** Fracción sobre el valor del producto (FOB) que se suma al arancel de la partida. */
export function recargoAdicional({ destino, origen, codigo, califica }: Caso): number {
  if (destino !== 'US') return 0;

  let forzoso = TRABAJO_FORZOSO[origen] ?? 0;
  if (codigo && empiezaCon(digitos(codigo), EXCLUIDOS_TRABAJO_FORZOSO)) forzoso = 0;
  if (califica && origen === 'MX') forzoso = 0;
  if (califica && CAFTA.has(origen) && codigo && esTextil(codigo)) forzoso = 0;

  const deChina = origen === 'CN' ? china301(codigo) : 0;
  return forzoso + deChina;
}
