import { afterEach, describe, expect, it } from 'vitest';
import { indiceDePrueba } from '../hts/store';
import { analizar, CAMPO_DESCRIPCION } from '../etiqueta/analisis';
import { armarPedido, codigoDePais, cruzarConArancel, leerRespuesta, sugerirPartidas } from './partidas';
import { FalloFedex, leerConfiguracion, obtenerToken, olvidarToken, type Configuracion } from './cliente';

// Las partidas sugeridas por el proveedor. Lo que se prueba acá es la
// regla del proyecto: ningún código llega a la pantalla sin existir en
// el arancel cargado, y ninguno sale descrito o tarifado por otro que no
// sea ese arancel.

const ARANCEL = indiceDePrueba([
  { htsno: '9102', indent: '0', description: 'Wrist watches, pocket watches and other watches' },
  { htsno: '9102.11', indent: '1', description: 'Wrist watches, electrically operated: With mechanical display only:' },
  { htsno: '9102.11.10', indent: '2', description: 'Having no jewels or only one jewel', general: '6.4%', special: 'Free (A,AU,CO)' },
  { htsno: '9102.11.10.00', indent: '3', description: '<i>Other</i>' },
  { htsno: '9102.19', indent: '1', description: 'Other', general: '9.8%' },
]);

const RESPUESTA = {
  transactionId: 'x',
  output: {
    hsClassifications: [
      {
        countryCode: 'US',
        countryType: 'DESTINATION',
        subheadingOptions: [
          { hsCode: '9999.99.99', customsDescription: 'no existe', confidenceScore: 0.4 },
          {
            hsCode: '9102.11.10.00',
            customsDescription: 'Wrist watch',
            confidenceScore: 0.9,
            tarriffAlternates: [{ hsCode: '9102.19' }],
          },
        ],
      },
      { countryCode: 'CO', countryType: 'ORIGIN', subheadingOptions: [{ hsCode: '9102.12' }] },
    ],
  },
};

describe('leer lo que devuelve el proveedor', () => {
  it('toma el país de destino, ordena por confianza y deja las alternativas al final', () => {
    const s = leerRespuesta(RESPUESTA);
    expect(s.map((x) => x.digitos)).toEqual(['9102111000', '99999999', '910219']);
    expect(s[2].alterna).toBe(true);
  });

  it('acepta las dos grafías de las alternativas y otros nombres del código', () => {
    const s = leerRespuesta({
      output: { hsClassifications: [{ subheadingOptions: [{ harmonizedCode: '910211', tariffAlternates: [{ code: '9102.19' }] }] }] },
    });
    expect(s.map((x) => x.digitos)).toEqual(['910211', '910219']);
  });

  it('una respuesta rara no rompe nada: devuelve cero candidatos', () => {
    expect(leerRespuesta(null)).toEqual([]);
    expect(leerRespuesta({ output: {} })).toEqual([]);
    expect(leerRespuesta({ output: { hsClassifications: [{ subheadingOptions: [{ hsCode: 'abc' }] }] } })).toEqual([]);
  });
});

describe('el cruce con el arancel cargado', () => {
  it('lo que no existe no sale, y queda anotado', () => {
    const { partidas, descartadas } = cruzarConArancel(leerRespuesta(RESPUESTA), ARANCEL);
    expect(partidas.map((p) => p.codigo)).toEqual(['9102.11.10.00', '9102.19']);
    expect(descartadas).toEqual(['9999.99.99']);
  });

  it('describe y tarifa con el arancel, no con lo que dijo el proveedor', () => {
    const [reloj] = cruzarConArancel(leerRespuesta(RESPUESTA), ARANCEL).partidas;
    expect(reloj.descripcion).toBe('Having no jewels or only one jewel › Other');
    expect(reloj.descripcion).not.toContain('Wrist watch,');
    // La línea de diez dígitos no trae tarifa: se hereda del padre y se dice de cuál.
    expect(reloj.tarifa).toBe('6.4%');
    expect(reloj.tarifaSegun).toBe('9102.11.10');
  });

  it('no recorta un código inexistente para hacerlo entrar', () => {
    // 9102.11.10.99 no existe; su padre 9102.11.10 sí. No se ofrece el padre.
    const { partidas, descartadas } = cruzarConArancel([{ digitos: '9102111099', nombre: '', alterna: false }], ARANCEL);
    expect(partidas).toEqual([]);
    expect(descartadas).toEqual(['9102.11.10.99']);
  });
});

describe('el pedido', () => {
  const reloj = analizar('ACERO INOXIDABLE\nHECHO EN JAPON\nPRODUCTO_VISTO: reloj de pulsera');

  it('sin saber qué producto es, no se pide nada', () => {
    expect(armarPedido(analizar('SKU 8891'))).toBeNull();
  });

  it('va a Estados Unidos, con el origen en ISO y lo que se vio en la foto', () => {
    const item = armarPedido(reloj)!.hsClassify[0];
    expect(item.destinationCountryCodes).toEqual(['US']);
    expect(item.originCountryCode).toBe('JP');
    expect(item.countryOfManufacture).toBe('JP');
    expect(item.commodityName).toBe('reloj de pulsera');
    expect(String(item.commodityDescription)).toContain('watches');
  });

  it('lo que la persona contó también viaja', () => {
    const a = analizar('SKU 8891', { familia: 'otro', [CAMPO_DESCRIPCION]: 'reloj de pulsera para buceo' });
    const item = armarPedido(a, { [CAMPO_DESCRIPCION]: 'reloj de pulsera para buceo' })!.hsClassify[0];
    expect(item.commodityName).toBe('reloj de pulsera para buceo');
  });

  it('un origen que no se reconoce no se manda: con el destino alcanza', () => {
    const item = armarPedido(analizar('HECHO EN NARNIA\nPRODUCTO_VISTO: reloj de pulsera'))!.hsClassify[0];
    expect(item.originCountryCode).toBeUndefined();
  });
});

describe('el país de origen', () => {
  it('se reconoce como lo escribe una etiqueta o una persona', () => {
    expect(codigoDePais('Colombia')).toBe('CO');
    expect(codigoDePais('VIET NAM')).toBe('VN');
    expect(codigoDePais('Japón')).toBe('JP');
    expect(codigoDePais('CHINA 2024')).toBe('CN');
    expect(codigoDePais('Narnia')).toBeNull();
    expect(codigoDePais(null)).toBeNull();
  });
});

// Un servidor falso: cada llamada responde lo que le toque de la lista.
function falso(respuestas: { status: number; cuerpo: unknown }[]) {
  const llamadas: string[] = [];
  const hacer = (async (url: string) => {
    llamadas.push(new URL(url).pathname);
    const r = respuestas.shift();
    if (!r) throw new Error('llamada de más');
    return new Response(JSON.stringify(r.cuerpo), { status: r.status });
  }) as unknown as typeof fetch;
  return { hacer, llamadas };
}

const CONFIG: Configuracion = { clientId: 'id', clientSecret: 'secreto', entorno: 'sandbox' };
const TOKEN = { status: 200, cuerpo: { access_token: 't1', token_type: 'bearer', expires_in: 3600 } };

describe('la conexión', () => {
  afterEach(() => olvidarToken());

  it('sin llaves no se sale a la red', async () => {
    const { hacer, llamadas } = falso([]);
    await expect(sugerirPartidas(analizar('PRODUCTO_VISTO: reloj de pulsera'), {}, { config: null, hacer })).rejects.toMatchObject({
      causa: 'no_configurado',
    });
    expect(llamadas).toEqual([]);
  });

  it('usa sandbox salvo que se pida producción con todas las letras', () => {
    expect(leerConfiguracion({ FEDEX_CLIENT_ID: 'a', FEDEX_CLIENT_SECRET: 'b' })?.entorno).toBe('sandbox');
    expect(leerConfiguracion({ FEDEX_CLIENT_ID: 'a', FEDEX_CLIENT_SECRET: 'b', FEDEX_ENV: 'prod' })?.entorno).toBe('sandbox');
    expect(leerConfiguracion({ FEDEX_CLIENT_ID: 'a', FEDEX_CLIENT_SECRET: 'b', FEDEX_ENV: 'production' })?.entorno).toBe('production');
    expect(leerConfiguracion({ FEDEX_CLIENT_ID: 'a' })).toBeNull();
  });

  it('el token se pide una vez y se reusa hasta poco antes de vencer', async () => {
    const { hacer, llamadas } = falso([TOKEN, { status: 200, cuerpo: { access_token: 't2', expires_in: 3600 } }]);
    const ahora = Date.now();
    expect(await obtenerToken(CONFIG, hacer, ahora)).toBe('t1');
    expect(await obtenerToken(CONFIG, hacer, ahora + 30 * 60_000)).toBe('t1');
    expect(llamadas).toHaveLength(1);
    // A 59 minutos ya se pide otro: no se usa uno que vence en el camino.
    expect(await obtenerToken(CONFIG, hacer, ahora + 59.5 * 60_000)).toBe('t2');
  });

  it('la consulta completa devuelve sólo lo que existe en el arancel', async () => {
    const { hacer, llamadas } = falso([TOKEN, { status: 200, cuerpo: RESPUESTA }]);
    const r = await sugerirPartidas(analizar('HECHO EN JAPON\nPRODUCTO_VISTO: reloj de pulsera'), {}, {
      config: CONFIG, hacer, idx: ARANCEL,
    });
    expect(llamadas).toEqual(['/oauth/token', '/commodity/v2/hscodes/search']);
    expect(r.sugeridas).toBe(3);
    expect(r.partidas.map((p) => p.codigo)).toEqual(['9102.11.10.00', '9102.19']);
    expect(r.descartadas).toEqual(['9999.99.99']);
  });

  it('un token vencido se renueva una sola vez; el segundo 401 es de credenciales', async () => {
    const { hacer } = falso([TOKEN, { status: 401, cuerpo: {} }, TOKEN, { status: 401, cuerpo: {} }]);
    await expect(sugerirPartidas(analizar('PRODUCTO_VISTO: reloj de pulsera'), {}, { config: CONFIG, hacer, idx: ARANCEL }))
      .rejects.toMatchObject({ causa: 'credenciales', nuestro: true });
  });

  it('un pedido rechazado deja en el log los códigos de error del proveedor', async () => {
    const { hacer } = falso([TOKEN, { status: 400, cuerpo: { errors: [{ code: 'HSCODESEARCH.SEARCHTEXT.INVALID' }] } }]);
    try {
      await sugerirPartidas(analizar('PRODUCTO_VISTO: reloj de pulsera'), {}, { config: CONFIG, hacer, idx: ARANCEL });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(FalloFedex);
      expect((err as FalloFedex).causa).toBe('pedido_invalido');
      expect((err as FalloFedex).detalle).toContain('HSCODESEARCH.SEARCHTEXT.INVALID');
    }
  });

  it('sin red, la falla dice que no respondió, no que la foto estaba mal', async () => {
    const hacer = (async () => { throw new TypeError('fetch failed'); }) as unknown as typeof fetch;
    await expect(sugerirPartidas(analizar('PRODUCTO_VISTO: reloj de pulsera'), {}, { config: CONFIG, hacer, idx: ARANCEL }))
      .rejects.toMatchObject({ causa: 'no_disponible', nuestro: false });
  });

  it('ningún mensaje para el cliente nombra al proveedor', async () => {
    const casos: { status: number; cuerpo: unknown }[][] = [
      [{ status: 401, cuerpo: {} }],
      [TOKEN, { status: 403, cuerpo: {} }],
      [TOKEN, { status: 429, cuerpo: {} }],
      [TOKEN, { status: 503, cuerpo: {} }],
      [TOKEN, { status: 400, cuerpo: {} }],
    ];
    for (const respuestas of casos) {
      olvidarToken();
      const { hacer } = falso(respuestas);
      try {
        await sugerirPartidas(analizar('PRODUCTO_VISTO: reloj de pulsera'), {}, { config: CONFIG, hacer, idx: ARANCEL });
        expect.unreachable();
      } catch (err) {
        expect((err as FalloFedex).publico).not.toMatch(/fedex/i);
      }
    }
  });
});
