import { consultar, fallo, FalloUsps, leerConfiguracion, type Configuracion } from './cliente';

// El envío dentro de EE. UU., del depósito al comprador: la última milla
// de un pedido de Shopify o de TikTok Shop que despacha la propia marca.
// (En Amazon FBA el envío lo hace Amazon y esto no aplica.)
//
// La calculadora ROI necesita UN número por unidad, pero el comprador
// puede estar en cualquier parte del país y la tarifa depende de la
// distancia (la "zona"). Así que se cotiza hacia cuatro ciudades que
// cubren las zonas cercanas y lejanas, y se usa el promedio. El detalle
// por ciudad viaja también, para que nadie tome el promedio por exacto.
//
// Todo lo que sale de acá es un precio que USPS devolvió. Si no hay
// respuesta, no hay número: la calculadora sigue con su valor fijo y lo
// dice.

export type Clase = 'USPS_GROUND_ADVANTAGE' | 'PRIORITY_MAIL';

export const NOMBRE_DE_CLASE: Record<Clase, string> = {
  USPS_GROUND_ADVANTAGE: 'USPS Ground Advantage',
  PRIORITY_MAIL: 'USPS Priority Mail',
};

export const DESTINOS_DE_REFERENCIA = [
  { ciudad: 'Nueva York, NY', zip: '10001' },
  { ciudad: 'Chicago, IL', zip: '60601' },
  { ciudad: 'Dallas, TX', zip: '75201' },
  { ciudad: 'Los Ángeles, CA', zip: '90012' },
] as const;

export interface Paquete {
  /** Peso empacado, gramos. */
  pesoG: number;
  /** Caja, centímetros. */
  largoCm: number;
  anchoCm: number;
  altoCm: number;
}

const GRAMOS_POR_ONZA = 28.349523125;
const CM_POR_PULGADA = 2.54;

/**
 * USPS cobra por onza (hasta 15.99 oz) y por libra: se redondea hacia
 * arriba a la onza entera, como hace la balanza del correo. Las medidas,
 * a la pulgada entera.
 */
export function aUnidadesUsps(p: Paquete): { libras: number; largo: number; ancho: number; alto: number } {
  const onzas = Math.max(1, Math.ceil(p.pesoG / GRAMOS_POR_ONZA));
  const pulgadas = (cm: number) => Math.max(1, Math.ceil(cm / CM_POR_PULGADA));
  return {
    libras: Math.round((onzas / 16) * 10000) / 10000,
    largo: pulgadas(p.largoCm),
    ancho: pulgadas(p.anchoCm),
    alto: pulgadas(p.altoCm),
  };
}

export function pedidoDeTarifa(
  p: Paquete,
  origen: string,
  destino: string,
  clase: Clase,
  fecha: string
): Record<string, unknown> {
  const u = aUnidadesUsps(p);
  return {
    originZIPCode: origen,
    destinationZIPCode: destino,
    weight: u.libras,
    length: u.largo,
    width: u.ancho,
    height: u.alto,
    mailClass: clase,
    processingCategory: 'MACHINABLE',
    destinationEntryFacilityType: 'NONE',
    rateIndicator: 'SP',
    // La tarifa comercial es la que paga quien imprime la guía en línea
    // (Shopify, Pirate Ship, la propia cuenta de USPS): la de ventanilla
    // es más cara y nadie que venda en serie la paga.
    priceType: 'COMMERCIAL',
    mailingDate: fecha,
  };
}

export interface Tarifa {
  usd: number;
  zona: string | null;
  descripcion: string | null;
}

/**
 * `{ totalBasePrice, rates: [{ price, zone, description }] }`. Un precio
 * que no es un número positivo no es un precio: se descarta en vez de
 * volverse un cero que abarata el envío.
 */
export function leerTarifa(cuerpo: unknown): Tarifa | null {
  const c = cuerpo as { totalBasePrice?: unknown; rates?: unknown } | null;
  if (!c || typeof c !== 'object') return null;
  const rates = Array.isArray(c.rates) ? (c.rates as Array<Record<string, unknown>>) : [];
  const primera = rates.find((r) => r && typeof r === 'object') ?? null;
  const precioDe = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);

  let usd = precioDe(c.totalBasePrice);
  if (usd === null) {
    const precios = rates.map((r) => precioDe(r?.price)).filter((v): v is number => v !== null);
    usd = precios.length ? Math.min(...precios) : null;
  }
  if (usd === null) return null;
  return {
    usd,
    zona: primera && typeof primera.zone === 'string' ? primera.zone : null,
    descripcion: primera && typeof primera.description === 'string' ? primera.description : null,
  };
}

// ---- Cotizar, con memoria ---------------------------------------------

const HORAS_12 = 12 * 60 * 60 * 1000;
const MAXIMO_GUARDADO = 500;
const guardadas = new Map<string, { tarifa: Tarifa; vence: number }>();

/** Sólo para las pruebas. */
export function olvidarTarifas(): void {
  guardadas.clear();
}

function hoy(ahora: number): string {
  return new Date(ahora).toISOString().slice(0, 10);
}

async function tarifaHacia(
  cuerpo: Record<string, unknown>,
  config: Configuracion,
  hacer: typeof fetch,
  ahora: number
): Promise<Tarifa> {
  // La fecha no entra en la clave: la tarifa del día siguiente es la misma
  // salvo el día que USPS cambia precios, y para eso están las 12 horas.
  const { mailingDate: _fecha, ...sinFecha } = cuerpo;
  const clave = `${config.entorno}:${JSON.stringify(sinFecha)}`;
  const guardada = guardadas.get(clave);
  if (guardada && guardada.vence > ahora) return guardada.tarifa;

  const respuesta = await consultar('/prices/v3/base-rates/search', { method: 'POST', cuerpo }, config, hacer);
  const tarifa = leerTarifa(respuesta);
  if (!tarifa) throw fallo('no_disponible', `usps base-rates respondió sin precio para ${String(cuerpo.destinationZIPCode)}`);

  if (guardadas.size >= MAXIMO_GUARDADO) {
    const masVieja = guardadas.keys().next().value;
    if (masVieja !== undefined) guardadas.delete(masVieja);
  }
  guardadas.set(clave, { tarifa, vence: ahora + HORAS_12 });
  return tarifa;
}

export interface CotizacionNacional {
  servicio: string;
  clase: Clase;
  origen: string;
  /** Promedio de los destinos que respondieron, USD por paquete. */
  promedio: number;
  minimo: number;
  maximo: number;
  destinos: Array<{ ciudad: string; zip: string; usd: number; zona: string | null }>;
  pesoFacturable: { libras: number; onzas: number };
}

/**
 * La tarifa promedio desde el depósito hacia las ciudades de referencia.
 * Se pide de a una (la cuota es por minuto y por hora). Si alguna ciudad
 * falla y otras no, el promedio sale de las que respondieron; si no
 * responde ninguna, se lanza el error de la primera.
 */
export async function cotizarNacional(
  paquete: Paquete,
  origen: string,
  opciones: { clase?: Clase; env?: NodeJS.ProcessEnv; hacer?: typeof fetch; ahora?: number } = {}
): Promise<CotizacionNacional> {
  const config = leerConfiguracion(opciones.env);
  if (!config) throw fallo('no_configurado', 'USPS_CLIENT_ID / USPS_CLIENT_SECRET sin configurar');
  const clase = opciones.clase ?? 'USPS_GROUND_ADVANTAGE';
  const ahora = opciones.ahora ?? Date.now();
  const hacer = opciones.hacer ?? fetch;

  const destinos: CotizacionNacional['destinos'] = [];
  let primerError: FalloUsps | null = null;
  for (const d of DESTINOS_DE_REFERENCIA) {
    try {
      const t = await tarifaHacia(pedidoDeTarifa(paquete, origen, d.zip, clase, hoy(ahora)), config, hacer, ahora);
      destinos.push({ ciudad: d.ciudad, zip: d.zip, usd: t.usd, zona: t.zona });
    } catch (err) {
      if (!(err instanceof FalloUsps)) throw err;
      primerError ??= err;
      // Credenciales, permisos, cuota o datos inválidos van a fallar igual
      // hacia las otras ciudades: no se gasta cuota en comprobarlo.
      if (err.causa !== 'no_disponible') throw err;
    }
  }
  if (!destinos.length) throw primerError ?? fallo('no_disponible', 'usps no devolvió ninguna tarifa');

  const precios = destinos.map((d) => d.usd);
  const u = aUnidadesUsps(paquete);
  return {
    servicio: NOMBRE_DE_CLASE[clase],
    clase,
    origen,
    promedio: Math.round((precios.reduce((a, b) => a + b, 0) / precios.length) * 100) / 100,
    minimo: Math.min(...precios),
    maximo: Math.max(...precios),
    destinos,
    pesoFacturable: { libras: u.libras, onzas: Math.round(u.libras * 16) },
  };
}
