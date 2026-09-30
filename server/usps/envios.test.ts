import { beforeEach, describe, expect, it } from 'vitest';
import { FalloUsps, leerConfiguracion, motivoDeError, olvidarToken } from './cliente';
import { aUnidadesUsps, cotizarNacional, leerTarifa, olvidarTarifas, pedidoDeTarifa } from './envios';

// El correo, simulado: cada prueba dice qué responde cada ruta y cuenta
// las llamadas, que en la cuenta real son cuota.

const env = { USPS_CLIENT_ID: 'id', USPS_CLIENT_SECRET: 'secreto' } as NodeJS.ProcessEnv;
const paquete = { pesoG: 350, largoCm: 23, anchoCm: 15, altoCm: 8 };

type Respuesta = { status: number; cuerpo: unknown };

function correoFalso(tarifas: (destino: string) => Respuesta, token: Respuesta = { status: 200, cuerpo: { access_token: 'tok', expires_in: 28800 } }) {
  const llamadas: Array<{ url: string; body: unknown; auth?: string }> = [];
  const hacer = (async (url: string, init?: RequestInit) => {
    const body = typeof init?.body === 'string' && init.body.startsWith('{') ? JSON.parse(init.body) : init?.body;
    llamadas.push({ url, body, auth: (init?.headers as Record<string, string> | undefined)?.authorization });
    const r = url.endsWith('/oauth2/v3/token') ? token : tarifas((body as { destinationZIPCode: string }).destinationZIPCode);
    return new Response(JSON.stringify(r.cuerpo), { status: r.status, headers: { 'content-type': 'application/json' } });
  }) as unknown as typeof fetch;
  return { hacer, llamadas };
}

const PRECIOS: Record<string, number> = { '10001': 9.1, '60601': 8.2, '75201': 7.4, '90012': 10.5 };
const tarifaOk = (destino: string): Respuesta => ({
  status: 200,
  cuerpo: { totalBasePrice: PRECIOS[destino], rates: [{ price: PRECIOS[destino], zone: '05', description: 'USPS Ground Advantage Machinable Single-piece' }] },
});

beforeEach(() => {
  olvidarToken();
  olvidarTarifas();
});

describe('configuración', () => {
  it('sin las dos variables no hay servicio', () => {
    expect(leerConfiguracion({} as NodeJS.ProcessEnv)).toBeNull();
    expect(leerConfiguracion({ USPS_CLIENT_ID: 'x' } as NodeJS.ProcessEnv)).toBeNull();
  });

  it('producción por defecto; prueba sólo si se pide', () => {
    expect(leerConfiguracion(env)?.entorno).toBe('produccion');
    expect(leerConfiguracion({ ...env, USPS_ENV: 'test' })?.entorno).toBe('prueba');
  });
});

describe('el paquete en las unidades del correo', () => {
  it('redondea el peso hacia arriba a la onza, y las medidas a la pulgada', () => {
    // 350 g = 12,35 oz → 13 oz → 0,8125 lb
    expect(aUnidadesUsps(paquete)).toEqual({ libras: 0.8125, largo: 10, ancho: 6, alto: 4 });
  });

  it('nunca pide menos de una onza ni de una pulgada', () => {
    expect(aUnidadesUsps({ pesoG: 1, largoCm: 0.5, anchoCm: 0.5, altoCm: 0.5 })).toEqual({ libras: 0.0625, largo: 1, ancho: 1, alto: 1 });
  });

  it('el pedido lleva tarifa comercial y paquete de una pieza', () => {
    const p = pedidoDeTarifa(paquete, '33166', '10001', 'USPS_GROUND_ADVANTAGE', '2026-09-30');
    expect(p).toMatchObject({
      originZIPCode: '33166',
      destinationZIPCode: '10001',
      weight: 0.8125,
      mailClass: 'USPS_GROUND_ADVANTAGE',
      priceType: 'COMMERCIAL',
      rateIndicator: 'SP',
      mailingDate: '2026-09-30',
    });
  });
});

describe('leer la tarifa', () => {
  it('toma el precio total y la zona', () => {
    expect(leerTarifa(tarifaOk('10001').cuerpo)).toEqual({ usd: 9.1, zona: '05', descripcion: 'USPS Ground Advantage Machinable Single-piece' });
  });

  it('sin total, el menor de los precios', () => {
    expect(leerTarifa({ rates: [{ price: 8 }, { price: 6.5 }] })?.usd).toBe(6.5);
  });

  it('un precio que no es un número positivo no es un precio', () => {
    expect(leerTarifa({ totalBasePrice: 0, rates: [] })).toBeNull();
    expect(leerTarifa({ totalBasePrice: '7.2' })).toBeNull();
    expect(leerTarifa(null)).toBeNull();
  });

  it('el motivo del error sale del cuerpo, recortado', () => {
    const m = motivoDeError({ error: { message: 'Bad Request', errors: [{ code: '010', title: 'Invalid ZIP', detail: 'originZIPCode' }] } });
    expect(m).toBe('Bad Request | 010 Invalid ZIP originZIPCode');
  });
});

describe('cotizar hacia las ciudades de referencia', () => {
  it('promedia las cuatro ciudades con un solo token', async () => {
    const { hacer, llamadas } = correoFalso(tarifaOk);
    const c = await cotizarNacional(paquete, '33166', { env, hacer, ahora: Date.UTC(2026, 8, 30) });
    expect(c.promedio).toBe(8.8);
    expect(c.minimo).toBe(7.4);
    expect(c.maximo).toBe(10.5);
    expect(c.destinos.map((d) => d.zip)).toEqual(['10001', '60601', '75201', '90012']);
    expect(c.servicio).toBe('USPS Ground Advantage');
    expect(c.pesoFacturable).toEqual({ libras: 0.8125, onzas: 13 });
    expect(llamadas.filter((l) => l.url.endsWith('/oauth2/v3/token'))).toHaveLength(1);
    expect(llamadas.filter((l) => l.url.endsWith('/prices/v3/base-rates/search'))).toHaveLength(4);
    expect(llamadas[1].auth).toBe('Bearer tok');
    expect(llamadas[1].url.startsWith('https://apis.usps.com/')).toBe(true);
  });

  it('la misma cotización otra vez no gasta cuota, aunque sea otro día', async () => {
    const { hacer, llamadas } = correoFalso(tarifaOk);
    await cotizarNacional(paquete, '33166', { env, hacer, ahora: Date.UTC(2026, 8, 30, 10) });
    const antes = llamadas.length;
    await cotizarNacional(paquete, '33166', { env, hacer, ahora: Date.UTC(2026, 8, 30, 20) });
    expect(llamadas.length).toBe(antes);
  });

  it('otro peso sí se cotiza de nuevo', async () => {
    const { hacer, llamadas } = correoFalso(tarifaOk);
    await cotizarNacional(paquete, '33166', { env, hacer });
    const antes = llamadas.length;
    await cotizarNacional({ ...paquete, pesoG: 900 }, '33166', { env, hacer });
    expect(llamadas.length).toBe(antes + 4);
  });

  it('si una ciudad no responde, promedia las que sí', async () => {
    const { hacer } = correoFalso((d) => (d === '90012' ? { status: 503, cuerpo: {} } : tarifaOk(d)));
    const c = await cotizarNacional(paquete, '33166', { env, hacer });
    expect(c.destinos).toHaveLength(3);
    expect(c.promedio).toBeCloseTo((9.1 + 8.2 + 7.4) / 3, 2);
  });

  it('un ZIP inválido corta en la primera ciudad: no gasta cuota en las otras', async () => {
    const { hacer, llamadas } = correoFalso(() => ({ status: 400, cuerpo: { error: { message: 'Invalid originZIPCode' } } }));
    const err = await cotizarNacional(paquete, '00000', { env, hacer }).catch((e) => e);
    expect(err).toBeInstanceOf(FalloUsps);
    expect((err as FalloUsps).causa).toBe('pedido_invalido');
    expect((err as FalloUsps).detalle).toContain('Invalid originZIPCode');
    expect(llamadas.filter((l) => l.url.endsWith('/prices/v3/base-rates/search'))).toHaveLength(1);
  });

  it('credenciales rechazadas: es configuración nuestra, y el mensaje no nombra secretos', async () => {
    const { hacer } = correoFalso(tarifaOk, { status: 401, cuerpo: { error: 'invalid_client' } });
    const err = (await cotizarNacional(paquete, '33166', { env, hacer }).catch((e) => e)) as FalloUsps;
    expect(err.causa).toBe('credenciales');
    expect(err.nuestro).toBe(true);
    expect(`${err.detalle} ${err.publico}`).not.toContain('secreto');
  });

  it('cuota agotada se dice como tal', async () => {
    const { hacer } = correoFalso(() => ({ status: 429, cuerpo: {} }));
    const err = (await cotizarNacional(paquete, '33166', { env, hacer }).catch((e) => e)) as FalloUsps;
    expect(err.causa).toBe('demasiadas_peticiones');
  });

  it('una respuesta sin precio no se vuelve un cero', async () => {
    const { hacer } = correoFalso(() => ({ status: 200, cuerpo: { rates: [] } }));
    const err = (await cotizarNacional(paquete, '33166', { env, hacer }).catch((e) => e)) as FalloUsps;
    expect(err).toBeInstanceOf(FalloUsps);
    expect(err.causa).toBe('no_disponible');
  });

  it('un token vencido a mitad de camino se renueva una vez', async () => {
    let primera = true;
    const { hacer, llamadas } = correoFalso((d) => {
      if (primera) {
        primera = false;
        return { status: 401, cuerpo: {} };
      }
      return tarifaOk(d);
    });
    const c = await cotizarNacional(paquete, '33166', { env, hacer });
    expect(c.destinos).toHaveLength(4);
    expect(llamadas.filter((l) => l.url.endsWith('/oauth2/v3/token'))).toHaveLength(2);
  });

  it('sin configurar, lo dice sin llamar a nadie', async () => {
    const { hacer, llamadas } = correoFalso(tarifaOk);
    const err = (await cotizarNacional(paquete, '33166', { env: {} as NodeJS.ProcessEnv, hacer }).catch((e) => e)) as FalloUsps;
    expect(err.causa).toBe('no_configurado');
    expect(llamadas).toHaveLength(0);
  });

  it('en el entorno de prueba va al servidor de prueba', async () => {
    const { hacer, llamadas } = correoFalso(tarifaOk);
    await cotizarNacional(paquete, '33166', { env: { ...env, USPS_ENV: 'test' }, hacer });
    expect(llamadas.every((l) => l.url.startsWith('https://apis-tem.usps.com/'))).toBe(true);
  });
});
