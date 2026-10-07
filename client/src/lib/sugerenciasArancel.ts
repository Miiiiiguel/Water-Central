import { UNION_EUROPEA } from './paises';

// Lo que se sabe del arancel de un país de destino sin consultarlo en
// vivo, para la calculadora ROI. En esos destinos la tarifa la escribe el
// cliente (ver lib/destinos); estas reglas la llenan solas en los casos
// que se conocen con certeza, citando la norma, y el cliente la puede
// cambiar. Lo que no está acá no se adivina: la página pide la tarifa.
//
// Cada regla dice de qué norma sale. Cuando una norma cambie, se cambia
// su regla y su prueba (sugerenciasArancel.test.ts).
//
// Hoy:
//   Colombia
//     - Ropa (capítulos 61 y 62): 40 % desde países sin TLC
//       (Decreto 2598 de 2022, sin importar el precio).
//     - Calzado (partidas 6401 a 6405): 35 % desde países sin TLC cuando
//       el precio FOB por par es igual o menor al umbral de su partida
//       (Decreto 0594 de 2026). Por encima del umbral, la tarifa general
//       de la subpartida, que se escribe.
//   México (decreto publicado el 29 de diciembre de 2025, vigente desde
//   el 1 de enero de 2026; sólo para países sin TLC con México)
//     - Ropa (61 y 62): 35 %.
//     - Calzado (64): 20 % el básico, hasta 35 % el de más valor.
//     - Juguetes (9503): 30 %.
//   Chile
//     - Todo: 6 % sobre el valor CIF (arancel general único); con TLC,
//       0 % con certificado de origen.
// En todos: con un TLC la tarifa preferencial (casi siempre 0 %) aplica
// si el producto cumple el origen y trae el certificado; sin él, la plena.

export type Sugerencia =
  /** Se sabe la tarifa: se llena sola. */
  | { tipo: 'fija'; pct: number; norma: string; nota?: string }
  /** Depende del certificado de origen: se ofrecen las dos. */
  | { tipo: 'segun_origen'; acuerdo: string; preferencial: number; sinCertificado: number; norma: string }
  /** Depende del tipo exacto de producto: se ofrecen las opciones. */
  | { tipo: 'opciones'; opciones: Array<{ pct: number; texto: string }>; porDefecto: number; norma: string }
  /** Se sabe que la regla no aplica y la tarifa es la general, que hay que escribir. */
  | { tipo: 'escribir'; nota: string; norma: string };

const UE = Object.fromEntries(UNION_EUROPEA.map((c) => [c, 'Acuerdo con la Unión Europea']));
const AELC = { CH: 'TLC con la AELC', NO: 'TLC con la AELC', IS: 'TLC con la AELC', LI: 'TLC con la AELC' };

/** TLC vigentes de Colombia que cubren estos productos. */
export const TLC_COLOMBIA: Record<string, string> = {
  PE: 'Comunidad Andina', EC: 'Comunidad Andina', BO: 'Comunidad Andina',
  US: 'TLC con Estados Unidos', CA: 'TLC con Canadá', MX: 'TLC con México', CL: 'TLC con Chile',
  KR: 'TLC con Corea', CR: 'TLC con Costa Rica', IL: 'TLC con Israel', GB: 'Acuerdo con el Reino Unido',
  AR: 'Acuerdo con el Mercosur', BR: 'Acuerdo con el Mercosur', PY: 'Acuerdo con el Mercosur', UY: 'Acuerdo con el Mercosur',
  GT: 'TLC con el Triángulo del Norte', HN: 'TLC con el Triángulo del Norte', SV: 'TLC con el Triángulo del Norte',
  ...AELC,
  ...UE,
};

/** TLC vigentes de México (T-MEC, UE, AELC, Reino Unido, Japón, Israel, Panamá, Uruguay, Centroamérica, Alianza del Pacífico, CPTPP). */
export const TLC_MEXICO: Record<string, string> = {
  US: 'T-MEC', CA: 'T-MEC',
  GB: 'Acuerdo con el Reino Unido', JP: 'Acuerdo con Japón', IL: 'TLC con Israel', PA: 'TLC con Panamá', UY: 'TLC con Uruguay',
  CR: 'TLC con Centroamérica', SV: 'TLC con Centroamérica', GT: 'TLC con Centroamérica', HN: 'TLC con Centroamérica', NI: 'TLC con Centroamérica',
  CO: 'Alianza del Pacífico', CL: 'Alianza del Pacífico', PE: 'Alianza del Pacífico',
  AU: 'CPTPP', NZ: 'CPTPP', SG: 'CPTPP', VN: 'CPTPP', MY: 'CPTPP', BN: 'CPTPP',
  ...AELC,
  ...UE,
};

/** TLC vigentes de Chile (es de los países con más acuerdos del mundo). */
export const TLC_CHILE: Record<string, string> = {
  US: 'TLC con Estados Unidos', CA: 'TLC con Canadá', MX: 'TLC con México',
  CO: 'Alianza del Pacífico', PE: 'Alianza del Pacífico', EC: 'Acuerdo con Ecuador', BO: 'Acuerdo con Bolivia',
  AR: 'Acuerdo con el Mercosur', BR: 'Acuerdo con el Mercosur', PY: 'Acuerdo con el Mercosur', UY: 'Acuerdo con el Mercosur',
  CR: 'TLC con Centroamérica', SV: 'TLC con Centroamérica', GT: 'TLC con Centroamérica', HN: 'TLC con Centroamérica', NI: 'TLC con Centroamérica',
  PA: 'TLC con Panamá', CN: 'TLC con China', HK: 'TLC con Hong Kong', KR: 'TLC con Corea', JP: 'Acuerdo con Japón',
  AU: 'TLC con Australia', NZ: 'P4 / CPTPP', SG: 'P4 / CPTPP', BN: 'P4 / CPTPP', MY: 'TLC con Malasia',
  TH: 'TLC con Tailandia', VN: 'TLC con Vietnam', ID: 'Acuerdo con Indonesia', TR: 'TLC con Turquía',
  GB: 'Acuerdo con el Reino Unido',
  ...AELC,
  ...UE,
};

export const NORMAS = {
  ropaColombia: 'Decreto 2598 de 2022',
  calzadoColombia: 'Decreto 0594 de 2026',
  mexico2026: 'decreto de aranceles de México vigente desde el 1 de enero de 2026',
  chile: 'arancel general de Chile (6 % sobre el valor CIF)',
};

/** Umbral FOB por par del Decreto 0594 de 2026, por partida. */
export const UMBRAL_CALZADO_CO: Record<string, number> = { '6401': 7, '6402': 7, '6404': 7, '6403': 11, '6405': 8 };

const conTLC = (tlc: Record<string, string>, origen: string, plena: number, norma: string): Sugerencia | null => {
  const acuerdo = tlc[origen];
  return acuerdo ? { tipo: 'segun_origen', acuerdo, preferencial: 0, sinCertificado: plena, norma } : null;
};

export interface Caso {
  destino: string;
  origen: string;
  /** La partida, con o sin puntos. */
  codigo: string;
  /** Precio FOB por unidad (por par, en calzado), en dólares. */
  fobUnidad: number;
}

export function sugerenciaArancel({ destino, origen, codigo, fobUnidad }: Caso): Sugerencia | null {
  const d = codigo.replace(/\D/g, '');
  const cap = d.slice(0, 2);
  const partida = d.slice(0, 4);
  if (origen === destino) return null;

  if (destino === 'CO') {
    if (cap === '61' || cap === '62') {
      return conTLC(TLC_COLOMBIA, origen, 40, NORMAS.ropaColombia) ?? { tipo: 'fija', pct: 40, norma: NORMAS.ropaColombia };
    }
    const umbral = UMBRAL_CALZADO_CO[partida];
    if (umbral !== undefined) {
      // El decreto excluye lo que llega con TLC: ahí rige la preferencial.
      if (TLC_COLOMBIA[origen]) return null;
      if (fobUnidad > 0 && fobUnidad <= umbral) {
        return { tipo: 'fija', pct: 35, norma: NORMAS.calzadoColombia, nota: `precio FOB de US$ ${fobUnidad} por par, igual o menor al umbral de US$ ${umbral}` };
      }
      return {
        tipo: 'escribir',
        norma: NORMAS.calzadoColombia,
        nota: `Por encima de US$ ${umbral} por par no aplica el 35 % del decreto: paga la tarifa general de la subpartida.`,
      };
    }
    return null;
  }

  if (destino === 'MX') {
    if (cap === '61' || cap === '62') return conTLC(TLC_MEXICO, origen, 35, NORMAS.mexico2026) ?? { tipo: 'fija', pct: 35, norma: NORMAS.mexico2026 };
    if (cap === '64') {
      return (
        conTLC(TLC_MEXICO, origen, 35, NORMAS.mexico2026) ?? {
          tipo: 'opciones',
          opciones: [
            { pct: 20, texto: 'calzado básico' },
            { pct: 35, texto: 'calzado de más valor o especializado' },
          ],
          porDefecto: 35,
          norma: NORMAS.mexico2026,
        }
      );
    }
    if (partida === '9503') return conTLC(TLC_MEXICO, origen, 30, NORMAS.mexico2026) ?? { tipo: 'fija', pct: 30, norma: NORMAS.mexico2026 };
    return null;
  }

  if (destino === 'CL') {
    return conTLC(TLC_CHILE, origen, 6, NORMAS.chile) ?? { tipo: 'fija', pct: 6, norma: NORMAS.chile };
  }

  return null;
}

/** La tarifa con que arranca la casilla para una sugerencia (null: la escribe el cliente). */
export function tarifaInicial(s: Sugerencia | null): number | null {
  if (!s) return null;
  if (s.tipo === 'fija') return s.pct;
  if (s.tipo === 'segun_origen') return s.sinCertificado;
  if (s.tipo === 'opciones') return s.porDefecto;
  return null;
}
