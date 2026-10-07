import { UNION_EUROPEA } from './paises';

// Lo que se sabe del arancel de Colombia sin consultarlo en vivo, para
// sugerir la tarifa cuando el destino de la calculadora ROI es Colombia
// (ahí la tarifa la escribe el cliente; ver lib/destinos).
//
// Hoy es una sola regla, la que más pesa en lo que importan los clientes:
// la ropa. El Decreto 2598 de 2022 fija 40 % ad valorem para todo lo de
// los capítulos 61 y 62 que venga de un país sin TLC con Colombia (China,
// India, Vietnam, Bangladés, Turquía…), sin importar el precio. Con TLC
// la tarifa preferencial (casi siempre 0 %) aplica si la prenda cumple
// las reglas de origen y trae su certificado; si no, también paga 40 %.
// El comité de aranceles la revisa cada año: si cambia, se cambia acá.

/** Países con un TLC vigente con Colombia que cubre la ropa (capítulos 61 y 62). */
const CON_TLC: Record<string, string> = {
  PE: 'Comunidad Andina',
  EC: 'Comunidad Andina',
  BO: 'Comunidad Andina',
  US: 'TLC con Estados Unidos',
  CA: 'TLC con Canadá',
  MX: 'TLC con México',
  CL: 'TLC con Chile',
  KR: 'TLC con Corea',
  CR: 'TLC con Costa Rica',
  IL: 'TLC con Israel',
  GB: 'Acuerdo con el Reino Unido',
  CH: 'TLC con la AELC',
  NO: 'TLC con la AELC',
  IS: 'TLC con la AELC',
  LI: 'TLC con la AELC',
  AR: 'Acuerdo con el Mercosur',
  BR: 'Acuerdo con el Mercosur',
  PY: 'Acuerdo con el Mercosur',
  UY: 'Acuerdo con el Mercosur',
  GT: 'TLC con el Triángulo del Norte',
  HN: 'TLC con el Triángulo del Norte',
  SV: 'TLC con el Triángulo del Norte',
  ...Object.fromEntries(UNION_EUROPEA.map((c) => [c, 'Acuerdo con la Unión Europea'])),
};

export const ARANCEL_CONFECCIONES = 40;
export const NORMA_CONFECCIONES = 'Decreto 2598 de 2022';

export type Sugerencia =
  /** Se sabe la tarifa: se llena sola. */
  | { tipo: 'fija'; pct: number; norma: string }
  /** Depende del certificado de origen: se ofrecen las dos. */
  | { tipo: 'segun_origen'; acuerdo: string; preferencial: number; sinCertificado: number; norma: string };

/** La tarifa de Colombia para una subpartida y un origen, si se conoce. */
export function sugerenciaColombia(origen: string, codigo: string): Sugerencia | null {
  const capitulo = codigo.replace(/\D/g, '').slice(0, 2);
  if (capitulo !== '61' && capitulo !== '62') return null;
  if (origen === 'CO') return null;
  const acuerdo = CON_TLC[origen];
  if (!acuerdo) return { tipo: 'fija', pct: ARANCEL_CONFECCIONES, norma: NORMA_CONFECCIONES };
  return { tipo: 'segun_origen', acuerdo, preferencial: 0, sinCertificado: ARANCEL_CONFECCIONES, norma: NORMA_CONFECCIONES };
}
