// El proveedor de partidas sugeridas: la API de código armonizado de
// FedEx. Este archivo es lo único que sabe hablar con ellos.
//
// Dos llamadas, tal como las documentan:
//   1. POST /oauth/token (form-urlencoded, client_credentials) → un
//      token que dura `expires_in` segundos (hoy, una hora).
//   2. POST /commodity/v2/hscodes/search (JSON, Bearer) con un arreglo
//      `hsClassify` → hasta cuatro subpartidas por mercancía, cada una
//      con hasta cuatro alternativas.
//
// Lo que FedEx mismo dice de este servicio, y que gobierna cómo se usa:
// "La búsqueda funciona con inteligencia artificial. Sus resultados son
// solo sugerencias." Por eso nada de lo que devuelve llega a la pantalla
// sin pasar antes por el arancel cargado (ver partidas.ts).
//
// El nombre del proveedor no sale de acá hacia el cliente: los mensajes
// públicos dicen "el servicio de partidas", y el nombre real vive sólo
// en los logs y en el panel del equipo.

export type Entorno = 'sandbox' | 'production';

const BASES: Record<Entorno, string> = {
  sandbox: 'https://apis-sandbox.fedex.com',
  production: 'https://apis.fedex.com',
};

/** Cuánto se espera una respuesta antes de darla por perdida. */
const ESPERA_MS = 12_000;

export interface Configuracion {
  clientId: string;
  clientSecret: string;
  entorno: Entorno;
}

export function leerConfiguracion(env: NodeJS.ProcessEnv = process.env): Configuracion | null {
  const clientId = env.FEDEX_CLIENT_ID?.trim();
  const clientSecret = env.FEDEX_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  // Sandbox salvo que se pida producción con todas las letras: un
  // valor mal escrito no puede terminar mandando pedidos reales.
  const entorno: Entorno = env.FEDEX_ENV?.trim().toLowerCase() === 'production' ? 'production' : 'sandbox';
  return { clientId, clientSecret, entorno };
}

export function configurado(env: NodeJS.ProcessEnv = process.env): boolean {
  return leerConfiguracion(env) !== null;
}

/** Qué hay que poner en el servidor, para decirlo en el panel. */
export function queFalta(env: NodeJS.ProcessEnv = process.env): string[] {
  const falta: string[] = [];
  if (!env.FEDEX_CLIENT_ID?.trim()) falta.push('FEDEX_CLIENT_ID');
  if (!env.FEDEX_CLIENT_SECRET?.trim()) falta.push('FEDEX_CLIENT_SECRET');
  return falta;
}

export type CausaFedex =
  | 'no_configurado'
  | 'credenciales'
  | 'sin_permiso'
  | 'pedido_invalido'
  | 'demasiadas_peticiones'
  | 'no_disponible';

/**
 * Una falla con nombre. `detalle` va al log y dice todo; `publico` va a
 * la pantalla, dice qué hacer y no nombra al proveedor.
 */
export class FalloFedex extends Error {
  constructor(
    public causa: CausaFedex,
    public detalle: string,
    public publico: string,
    /** ¿Lo arreglamos nosotros (configuración) o es pasajero? */
    public nuestro: boolean
  ) {
    super(detalle);
  }
}

const PUBLICO: Record<CausaFedex, { texto: string; nuestro: boolean }> = {
  no_configurado: {
    texto: 'Las partidas sugeridas todavía no están activadas en el servidor.',
    nuestro: true,
  },
  credenciales: {
    texto: 'El servicio de partidas no aceptó nuestras credenciales. Es configuración nuestra, no tuya: avisale al equipo.',
    nuestro: true,
  },
  sin_permiso: {
    texto: 'Nuestra cuenta del servicio de partidas no tiene habilitada esta consulta. Es configuración nuestra: avisale al equipo.',
    nuestro: true,
  },
  pedido_invalido: {
    texto: 'El servicio de partidas no entendió la consulta. Ya quedó registrado para revisarlo.',
    nuestro: true,
  },
  demasiadas_peticiones: {
    texto: 'El servicio de partidas está recibiendo demasiadas consultas. Probá de nuevo en unos minutos.',
    nuestro: false,
  },
  no_disponible: {
    texto: 'El servicio de partidas no respondió. Probá de nuevo en unos minutos.',
    nuestro: false,
  },
};

export function fallo(causa: CausaFedex, detalle: string): FalloFedex {
  const p = PUBLICO[causa];
  return new FalloFedex(causa, detalle, p.texto, p.nuestro);
}

/** De un código HTTP a una causa. Lo que no se reconoce, se trata como caída. */
export function causaDeEstado(status: number): CausaFedex {
  if (status === 401) return 'credenciales';
  if (status === 403) return 'sin_permiso';
  if (status === 400 || status === 404 || status === 422) return 'pedido_invalido';
  if (status === 429) return 'demasiadas_peticiones';
  return 'no_disponible';
}

/**
 * Los códigos de error que FedEx manda en el cuerpo ("HSCODESEARCH.
 * SEARCHTEXT.INVALID"). Van al log: son lo único que dice qué campo del
 * pedido no le gustó.
 */
export function codigosDeError(cuerpo: unknown): string[] {
  const errores = (cuerpo as { errors?: unknown })?.errors;
  if (!Array.isArray(errores)) return [];
  return errores
    .map((e) => (e && typeof e === 'object' ? String((e as { code?: unknown }).code ?? '') : ''))
    .filter(Boolean)
    .slice(0, 5);
}

type Fetch = typeof fetch;

interface TokenGuardado {
  valor: string;
  vence: number;
  /** Para no usar un token de sandbox contra producción si cambia la config. */
  clave: string;
}

let token: TokenGuardado | null = null;

/** Sólo para las pruebas. */
export function olvidarToken(): void {
  token = null;
}

async function conEspera(url: string, init: RequestInit, hacer: Fetch): Promise<Response> {
  const control = new AbortController();
  const reloj = setTimeout(() => control.abort(), ESPERA_MS);
  try {
    return await hacer(url, { ...init, signal: control.signal });
  } catch (err) {
    throw fallo('no_disponible', `sin respuesta de ${new URL(url).host}: ${(err as Error).name}`);
  } finally {
    clearTimeout(reloj);
  }
}

/**
 * El token, pedido una vez y reusado hasta un minuto antes de que
 * venza. Pedir uno por consulta duplicaría las llamadas y acercaría el
 * límite de la cuenta sin ganar nada.
 */
export async function obtenerToken(config: Configuracion, hacer: Fetch = fetch, ahora = Date.now()): Promise<string> {
  const clave = `${config.entorno}:${config.clientId}`;
  if (token && token.clave === clave && token.vence > ahora) return token.valor;

  const cuerpo = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });
  const res = await conEspera(`${BASES[config.entorno]}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: cuerpo.toString(),
  }, hacer);

  if (!res.ok) {
    const causa = res.status === 400 || res.status === 401 ? 'credenciales' : causaDeEstado(res.status);
    // El cuerpo de un error de login no trae nada que sirva y podría
    // traer eco de lo enviado: no se loguea.
    throw fallo(causa, `oauth ${config.entorno} respondió ${res.status}`);
  }

  const datos = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!datos.access_token) throw fallo('no_disponible', `oauth ${config.entorno} respondió sin access_token`);
  const segundos = typeof datos.expires_in === 'number' && datos.expires_in > 0 ? datos.expires_in : 3600;
  token = { valor: datos.access_token, vence: ahora + Math.max(0, segundos - 60) * 1000, clave };
  return token.valor;
}

/**
 * La búsqueda. Devuelve el JSON tal cual: leerlo es trabajo de
 * partidas.ts, que es puro y se prueba sin red.
 */
export async function buscarCodigos(
  pedido: { hsClassify: Record<string, unknown>[] },
  config: Configuracion,
  hacer: Fetch = fetch
): Promise<unknown> {
  const enviar = async (valor: string) =>
    conEspera(`${BASES[config.entorno]}/commodity/v2/hscodes/search`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${valor}`,
        'content-type': 'application/json',
        'x-content-type': 'application/json',
        'x-locale': 'en_US',
        'x-customer-transaction-id': `easycomex-${Date.now().toString(36)}`,
      },
      body: JSON.stringify(pedido),
    }, hacer);

  let res = await enviar(await obtenerToken(config, hacer));
  // Un token que vence justo entre que se pidió y se usó: se pide otro
  // una sola vez. Un segundo 401 ya es un problema de credenciales.
  if (res.status === 401) {
    olvidarToken();
    res = await enviar(await obtenerToken(config, hacer));
  }

  const cuerpo = await res.json().catch(() => null);
  if (!res.ok) {
    const codigos = codigosDeError(cuerpo);
    throw fallo(
      causaDeEstado(res.status),
      `búsqueda ${config.entorno} respondió ${res.status}${codigos.length ? ` (${codigos.join(', ')})` : ''}`
    );
  }
  return cuerpo;
}
