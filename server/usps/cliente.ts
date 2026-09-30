// El correo de EE. UU. (USPS): tarifas de envío nacional, validación de
// direcciones y rastreo. Este archivo es lo único que habla con su API.
//
// Es la API nueva de developers.usps.com (la vieja, "Web Tools", se está
// retirando). Dos pasos, como toda API con OAuth:
//   1. POST /oauth2/v3/token (client_credentials) → un token de horas.
//   2. Cada consulta con `Authorization: Bearer <token>`.
//
// La cuota por defecto de una app nueva es baja (del orden de 60 consultas
// por hora). Por eso nadie llama a esto directo: envios.ts guarda en
// memoria cada tarifa que ya pidió, y la calculadora cotiza sólo cuando la
// persona aprieta el botón, nunca mientras escribe.

export type Entorno = 'prueba' | 'produccion';

const BASES: Record<Entorno, string> = {
  prueba: 'https://apis-tem.usps.com',
  produccion: 'https://apis.usps.com',
};

const ESPERA_MS = 12_000;

export interface Configuracion {
  clientId: string;
  clientSecret: string;
  entorno: Entorno;
}

export function leerConfiguracion(env: NodeJS.ProcessEnv = process.env): Configuracion | null {
  const clientId = env.USPS_CLIENT_ID?.trim();
  const clientSecret = env.USPS_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) return null;
  // Al revés que FedEx: acá sólo se lee (tarifas, direcciones, rastreo),
  // nada se compra. Producción es lo útil y es lo que viene por defecto;
  // el entorno de prueba se pide con USPS_ENV=test.
  const e = env.USPS_ENV?.trim().toLowerCase();
  const entorno: Entorno = e === 'test' || e === 'tem' || e === 'prueba' ? 'prueba' : 'produccion';
  return { clientId, clientSecret, entorno };
}

export function configurado(env: NodeJS.ProcessEnv = process.env): boolean {
  return leerConfiguracion(env) !== null;
}

export type CausaUsps =
  | 'no_configurado'
  | 'credenciales'
  | 'sin_permiso'
  | 'pedido_invalido'
  | 'demasiadas_peticiones'
  | 'no_disponible';

/** `detalle` va al log; `publico` a la pantalla y dice qué hacer. */
export class FalloUsps extends Error {
  constructor(
    public causa: CausaUsps,
    public detalle: string,
    public publico: string,
    public nuestro: boolean
  ) {
    super(detalle);
  }
}

const PUBLICO: Record<CausaUsps, { texto: string; nuestro: boolean }> = {
  no_configurado: {
    texto: 'Las tarifas reales de envío en EE. UU. todavía no están activadas. Se usa el valor fijo del modelo.',
    nuestro: true,
  },
  credenciales: {
    texto: 'El servicio de envíos no aceptó nuestras credenciales. Es configuración nuestra, no tuya: avisale al equipo.',
    nuestro: true,
  },
  sin_permiso: {
    texto: 'Nuestra cuenta del servicio de envíos no tiene habilitada esta consulta. Es configuración nuestra: avisale al equipo.',
    nuestro: true,
  },
  pedido_invalido: {
    texto: 'El servicio de envíos no aceptó los datos. Revisá el código postal y el peso.',
    nuestro: false,
  },
  demasiadas_peticiones: {
    texto: 'El servicio de envíos está recibiendo demasiadas consultas. Probá de nuevo en unos minutos.',
    nuestro: false,
  },
  no_disponible: {
    texto: 'El servicio de envíos no respondió. Probá de nuevo en unos minutos.',
    nuestro: false,
  },
};

export function fallo(causa: CausaUsps, detalle: string): FalloUsps {
  const p = PUBLICO[causa];
  return new FalloUsps(causa, detalle, p.texto, p.nuestro);
}

export function causaDeEstado(status: number): CausaUsps {
  if (status === 401) return 'credenciales';
  if (status === 403) return 'sin_permiso';
  if (status === 400 || status === 404 || status === 422) return 'pedido_invalido';
  if (status === 429) return 'demasiadas_peticiones';
  return 'no_disponible';
}

/**
 * Lo que USPS dice que estuvo mal: `{ error: { code, message, errors:
 * [{ code, title, detail }] } }`. Va al log, recortado.
 */
export function motivoDeError(cuerpo: unknown): string {
  const e = (cuerpo as { error?: { message?: unknown; errors?: unknown } })?.error;
  if (!e || typeof e !== 'object') return '';
  const partes: string[] = [];
  if (typeof e.message === 'string') partes.push(e.message);
  if (Array.isArray(e.errors)) {
    for (const x of e.errors.slice(0, 3)) {
      const t = x && typeof x === 'object' ? (x as { title?: unknown; detail?: unknown; code?: unknown }) : {};
      const txt = [t.code, t.title, t.detail].filter((v) => typeof v === 'string' && v).join(' ');
      if (txt) partes.push(txt);
    }
  }
  return partes.join(' | ').slice(0, 300);
}

type Fetch = typeof fetch;

let token: { valor: string; vence: number; clave: string } | null = null;

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

/** El token, reusado hasta un minuto antes de vencer: cada pedido de token gasta cuota. */
export async function obtenerToken(config: Configuracion, hacer: Fetch = fetch, ahora = Date.now()): Promise<string> {
  const clave = `${config.entorno}:${config.clientId}`;
  if (token && token.clave === clave && token.vence > ahora) return token.valor;

  const res = await conEspera(`${BASES[config.entorno]}/oauth2/v3/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }).toString(),
  }, hacer);

  if (!res.ok) {
    const causa = res.status === 400 || res.status === 401 ? 'credenciales' : causaDeEstado(res.status);
    // El cuerpo de un login fallido no se loguea: podría traer eco de lo enviado.
    throw fallo(causa, `oauth usps ${config.entorno} respondió ${res.status}`);
  }

  const datos = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!datos.access_token) throw fallo('no_disponible', `oauth usps ${config.entorno} respondió sin access_token`);
  const segundos = typeof datos.expires_in === 'number' && datos.expires_in > 0 ? datos.expires_in : 3600;
  token = { valor: datos.access_token, vence: ahora + Math.max(0, segundos - 60) * 1000, clave };
  return token.valor;
}

/**
 * Una consulta autenticada. Devuelve el JSON tal cual; leerlo es trabajo
 * de envios.ts, que es puro y se prueba sin red.
 */
export async function consultar(
  ruta: string,
  init: { method: 'GET' | 'POST'; cuerpo?: unknown },
  config: Configuracion,
  hacer: Fetch = fetch
): Promise<unknown> {
  const enviar = async (valor: string) =>
    conEspera(`${BASES[config.entorno]}${ruta}`, {
      method: init.method,
      headers: {
        authorization: `Bearer ${valor}`,
        accept: 'application/json',
        ...(init.cuerpo !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: init.cuerpo !== undefined ? JSON.stringify(init.cuerpo) : undefined,
    }, hacer);

  let res = await enviar(await obtenerToken(config, hacer));
  // Un token que venció entre que se pidió y se usó: otro, una sola vez.
  if (res.status === 401) {
    olvidarToken();
    res = await enviar(await obtenerToken(config, hacer));
  }

  const cuerpo = await res.json().catch(() => null);
  if (!res.ok) {
    const motivo = motivoDeError(cuerpo);
    throw fallo(causaDeEstado(res.status), `usps ${init.method} ${ruta.split('?')[0]} respondió ${res.status}${motivo ? ` (${motivo})` : ''}`);
  }
  return cuerpo;
}
