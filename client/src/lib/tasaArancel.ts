// Leer una tarifa del arancel de EE. UU. y convertirla en dólares por
// unidad.
//
// La USITC escribe las tarifas de 109 maneras distintas. Casi todo el
// arancel son tres: un porcentaje ("6.4%"), "Free", o centavos por kilo
// ("13.6¢/kg"), a veces sumados ("13.6¢/kg + 6%"). Después vienen por
// litro, por unidad, por par, por docena. Y unas pocas —relojes, sobre
// todo— cobran distinto por cada pieza ("+ 6% on the case + 5.3% on the
// strap"), que no se puede calcular sin saber cuánto vale cada pieza.
//
// La regla de este archivo: lo que no se entiende, no se inventa. Una
// tarifa que no se puede calcular vuelve con `calculable: false` y el
// texto original, para mostrarla tal cual y decir que hay que
// confirmarla. Nunca se convierte en un 0 silencioso.
//
// Es puro (sin red, sin DOM) y lo usan los dos lados: el servidor para
// describir una partida, la calculadora ROI para sumar el arancel.

export type Base = 'valor' | 'kg' | 'unidad' | 'par' | 'docena' | 'gruesa' | 'litro';

export type Componente =
  | { tipo: 'advalorem'; pct: number }
  | { tipo: 'especifico'; usd: number; por: Exclude<Base, 'valor'> };

export interface Tasa {
  /** Tal cual la publica la USITC, sin el HTML. */
  texto: string;
  libre: boolean;
  componentes: Componente[];
  calculable: boolean;
  /** Por qué no se puede calcular, para decirlo en pantalla. */
  motivo?: string;
  /** Qué dato del producto hace falta además del valor. */
  necesita: Array<'peso' | 'volumen'>;
}

const UNIDADES: Record<string, Exclude<Base, 'valor'>> = {
  kg: 'kg',
  'clean kg': 'kg',
  liter: 'litro',
  liters: 'litro',
  l: 'litro',
  each: 'unidad',
  'no.': 'unidad',
  'pr.': 'par',
  pr: 'par',
  'prs.': 'par',
  'doz.': 'docena',
  doz: 'docena',
  gross: 'gruesa',
};

const LITROS_POR_BARRIL = 158.987294928;

export function limpiar(texto: string): string {
  return (texto || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function componente(parte: string): Componente | null {
  const p = parte.trim().toLowerCase();

  const pct = /^(\d+(?:\.\d+)?)\s*%$/.exec(p);
  if (pct) return { tipo: 'advalorem', pct: parseFloat(pct[1]) };

  // "13.6¢/kg", "$1.035/kg", "5¢ each", "$2 each", "16¢/pr."
  const esp = /^(\$)?(\d+(?:\.\d+)?)\s*(¢)?\s*(?:\/\s*|\s+)([a-z. ]+)$/.exec(p);
  if (esp) {
    const [, dolar, numero, centavo, unidadCruda] = esp;
    const unidad = unidadCruda.trim();
    if (Boolean(dolar) === Boolean(centavo)) return null;
    const usd = parseFloat(numero) / (centavo ? 100 : 1);
    // El barril de petróleo: 42 galones, 158,987 litros.
    if (unidad === 'bbl') return { tipo: 'especifico', usd: usd / LITROS_POR_BARRIL, por: 'litro' };
    const por = UNIDADES[unidad];
    if (!por) return null;
    return { tipo: 'especifico', usd, por };
  }
  return null;
}

/** Lee una tarifa de la columna "General" (o una de la "Special"). */
export function parseTasa(crudo: string): Tasa {
  const texto = limpiar(crudo);
  const base = { texto, componentes: [] as Componente[], necesita: [] as Tasa['necesita'] };

  if (!texto) return { ...base, libre: false, calculable: false, motivo: 'La partida no trae tarifa.' };
  if (/^free$/i.test(texto)) return { ...base, libre: true, calculable: true };

  const componentes: Componente[] = [];
  for (const parte of texto.split(/\s+\+\s+/)) {
    const c = componente(parte);
    if (!c) {
      return {
        ...base,
        libre: false,
        calculable: false,
        motivo: 'Tarifa compuesta o condicionada: hay que confirmarla con el agente de aduanas.',
      };
    }
    componentes.push(c);
  }

  const necesita: Tasa['necesita'] = [];
  if (componentes.some((c) => c.tipo === 'especifico' && c.por === 'kg')) necesita.push('peso');
  if (componentes.some((c) => c.tipo === 'especifico' && c.por === 'litro')) necesita.push('volumen');
  const libre = componentes.every((c) => (c.tipo === 'advalorem' ? c.pct === 0 : c.usd === 0));
  return { texto, libre, componentes, calculable: true, necesita };
}

export interface DatosDelProducto {
  /** Valor en aduana por unidad, USD. En el ROI, el costo de producción. */
  valor: number;
  pesoKg?: number;
  litros?: number;
}

export interface Derecho {
  usd: number;
  calculable: boolean;
  /** El dato que falta para calcularlo. */
  falta?: 'peso' | 'volumen';
}

/** El arancel de una unidad del producto, en dólares. */
export function derechoPorUnidad(tasa: Tasa, p: DatosDelProducto): Derecho {
  if (!tasa.calculable) return { usd: 0, calculable: false };
  let usd = 0;
  for (const c of tasa.componentes) {
    if (c.tipo === 'advalorem') {
      usd += (c.pct / 100) * p.valor;
      continue;
    }
    switch (c.por) {
      case 'kg':
        if (!(p.pesoKg! > 0)) return { usd: 0, calculable: false, falta: 'peso' };
        usd += c.usd * p.pesoKg!;
        break;
      case 'litro':
        if (!(p.litros! > 0)) return { usd: 0, calculable: false, falta: 'volumen' };
        usd += c.usd * p.litros!;
        break;
      // Una unidad vendida es una pieza; en calzado, un par.
      case 'unidad':
      case 'par':
        usd += c.usd;
        break;
      case 'docena':
        usd += c.usd / 12;
        break;
      case 'gruesa':
        usd += c.usd / 144;
        break;
    }
  }
  return { usd, calculable: true };
}

// ---- Tarifas preferenciales ---------------------------------------------

export interface GrupoEspecial {
  tasa: Tasa;
  programas: string[];
}

/**
 * La columna "Special": "Free (A+,AU,BH,CL,CO,...) 3.2% (KR)". Cada tarifa
 * va seguida, entre paréntesis, de los programas que la dan.
 */
export function parseEspecial(crudo: string): GrupoEspecial[] {
  const texto = limpiar(crudo);
  const grupos: GrupoEspecial[] = [];
  const patron = /([^()]+?)\s*\(([^)]*)\)/g;
  let m: RegExpExecArray | null;
  while ((m = patron.exec(texto))) {
    const tasa = parseTasa(m[1].replace(/^[\s,;]+/, ''));
    const programas = m[2].split(',').map((s) => s.trim()).filter(Boolean);
    if (programas.length) grupos.push({ tasa, programas });
  }
  return grupos;
}

export interface PaisDeOrigen {
  iso: string;
  nombre: string;
  /** El acuerdo con EE. UU., si hay. */
  acuerdo: string | null;
  /** Las siglas con que la USITC marca ese acuerdo en la columna Special. */
  programas: string[];
}

// Sólo acuerdos vigentes. El SGP ("A", "A+", "A*") venció en 2020 y no se
// ha renovado: aunque la columna lo siga listando, no se aplica.
const CAFTA = ['P', 'P+'];

export const PAISES_DE_ORIGEN: PaisDeOrigen[] = [
  { iso: 'CO', nombre: 'Colombia', acuerdo: 'TPA Colombia – EE. UU.', programas: ['CO'] },
  { iso: 'MX', nombre: 'México', acuerdo: 'T-MEC (USMCA)', programas: ['S', 'S+', 'MX'] },
  { iso: 'PE', nombre: 'Perú', acuerdo: 'TPA Perú – EE. UU.', programas: ['PE'] },
  { iso: 'CL', nombre: 'Chile', acuerdo: 'TLC Chile – EE. UU.', programas: ['CL'] },
  { iso: 'PA', nombre: 'Panamá', acuerdo: 'TPA Panamá – EE. UU.', programas: ['PA'] },
  { iso: 'CR', nombre: 'Costa Rica', acuerdo: 'CAFTA-DR', programas: CAFTA },
  { iso: 'DO', nombre: 'República Dominicana', acuerdo: 'CAFTA-DR', programas: CAFTA },
  { iso: 'SV', nombre: 'El Salvador', acuerdo: 'CAFTA-DR', programas: CAFTA },
  { iso: 'GT', nombre: 'Guatemala', acuerdo: 'CAFTA-DR', programas: CAFTA },
  { iso: 'HN', nombre: 'Honduras', acuerdo: 'CAFTA-DR', programas: CAFTA },
  { iso: 'NI', nombre: 'Nicaragua', acuerdo: 'CAFTA-DR', programas: CAFTA },
  { iso: 'EC', nombre: 'Ecuador', acuerdo: null, programas: [] },
  { iso: 'BR', nombre: 'Brasil', acuerdo: null, programas: [] },
  { iso: 'AR', nombre: 'Argentina', acuerdo: null, programas: [] },
  { iso: 'UY', nombre: 'Uruguay', acuerdo: null, programas: [] },
  { iso: 'PY', nombre: 'Paraguay', acuerdo: null, programas: [] },
  { iso: 'BO', nombre: 'Bolivia', acuerdo: null, programas: [] },
  { iso: 'VE', nombre: 'Venezuela', acuerdo: null, programas: [] },
];

export function paisDeOrigen(iso: string): PaisDeOrigen | null {
  return PAISES_DE_ORIGEN.find((p) => p.iso === iso) ?? null;
}

/**
 * La tarifa preferencial que le toca a un país en esta partida, si su
 * acuerdo aparece en la columna Special. Null si no hay acuerdo o si la
 * partida no lo lista (entonces paga la general).
 */
export function tasaPreferencial(especial: string, iso: string): { tasa: Tasa; programa: string; acuerdo: string } | null {
  const pais = paisDeOrigen(iso);
  if (!pais || !pais.acuerdo) return null;
  for (const grupo of parseEspecial(especial)) {
    const programa = grupo.programas.find((p) => pais.programas.includes(p));
    if (programa) return { tasa: grupo.tasa, programa, acuerdo: pais.acuerdo };
  }
  return null;
}
