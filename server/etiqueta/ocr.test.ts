import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { proveedorAnthropic } from './ocr';
import { analizar } from './analisis';

// El camino completo de una foto, sin la red: un servidor falso hace de
// proveedor de visión. Lo que se prueba es que la foto le llega entera y
// bien armada, y que lo que contesta termina en el producto correcto.
// Las transcripciones son como las devuelve el lector con etiquetas
// reales: con saltos de línea, mayúsculas y la línea PRODUCTO_VISTO.

let servidor: http.Server;
let pedidos: { ruta: string; cuerpo: any }[] = [];
let responder: (cuerpo: any) => { status: number; json: unknown } = () => ({ status: 500, json: {} });
const antes = { key: process.env.ANTHROPIC_API_KEY, base: process.env.ANTHROPIC_BASE_URL };

beforeAll(async () => {
  servidor = http.createServer((req, res) => {
    let datos = '';
    req.on('data', (c) => (datos += c));
    req.on('end', () => {
      const cuerpo = JSON.parse(datos || '{}');
      pedidos.push({ ruta: req.url ?? '', cuerpo });
      const r = responder(cuerpo);
      res.writeHead(r.status, { 'content-type': 'application/json' });
      res.end(JSON.stringify(r.json));
    });
  });
  await new Promise<void>((ok) => servidor.listen(0, '127.0.0.1', ok));
  process.env.ANTHROPIC_API_KEY = 'llave-de-prueba';
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});

afterAll(() => {
  servidor.close();
  if (antes.key === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = antes.key;
  if (antes.base === undefined) delete process.env.ANTHROPIC_BASE_URL; else process.env.ANTHROPIC_BASE_URL = antes.base;
});

const contesta = (texto: string) => () => ({
  status: 200,
  json: {
    id: 'msg_1', type: 'message', role: 'assistant', model: 'x', stop_reason: 'end_turn', stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 },
    content: [{ type: 'text', text: texto }],
  },
});

// Una "foto" cualquiera: lo que importa es que llegue byte por byte.
const FOTO = Buffer.from(Array.from({ length: 4096 }, (_, i) => i % 251)).toString('base64');

describe('la foto llega al lector', () => {
  it('entera, como imagen, con la instrucción y sin inventar temperatura', async () => {
    pedidos = [];
    responder = contesta('100% ALGODÓN\nHECHO EN COLOMBIA\nPRODUCTO_VISTO: camiseta');
    await proveedorAnthropic.leer(FOTO, 'image/jpeg');

    expect(pedidos).toHaveLength(1);
    expect(pedidos[0].ruta).toBe('/v1/messages');
    const { cuerpo } = pedidos[0];
    const [imagen, texto] = cuerpo.messages[0].content;
    expect(imagen.type).toBe('image');
    expect(imagen.source).toEqual({ type: 'base64', media_type: 'image/jpeg', data: FOTO });
    expect(texto.text).toContain('Transcribe literalmente');
    expect(texto.text).toContain('PRODUCTO_VISTO');
    expect(cuerpo.temperature).toBe(0);
    expect(cuerpo.model).toBeTruthy();
  });

  it('una foto sin texto pero con un producto reconocible no es "ilegible"', async () => {
    responder = contesta('SIN_TEXTO\nPRODUCTO_VISTO: taza de cerámica');
    const r = await proveedorAnthropic.leer(FOTO, 'image/jpeg');
    expect(r.ilegible).toBe(false);
    expect(r.texto).toBe('PRODUCTO_VISTO: taza de cerámica');
  });

  it('una foto donde no se ve nada sí es ilegible', async () => {
    responder = contesta('SIN_TEXTO\nPRODUCTO_VISTO: desconocido');
    const r = await proveedorAnthropic.leer(FOTO, 'image/jpeg');
    expect(r.ilegible).toBe(true);
  });

  it('si el proveedor rechaza el pedido, falla fuerte (la ruta dice por qué)', async () => {
    responder = () => ({ status: 404, json: { type: 'error', error: { type: 'not_found_error', message: 'model: x' } } });
    await expect(proveedorAnthropic.leer(FOTO, 'image/jpeg')).rejects.toThrow();
  });
});

describe('de la etiqueta leída al producto', () => {
  // [lo que devolvería el lector, capítulo esperado]
  const casos: Array<[string, string, string]> = [
    ['camiseta', 'RN 54321\n60% ALGODÓN\n40% POLIÉSTER\nHECHO EN COLOMBIA\nLAVAR A MÁQUINA AGUA FRÍA\nPRODUCTO_VISTO: camiseta de punto', '61'],
    ['atún en lata', 'ATÚN EN ACEITE DE GIRASOL\nPESO NETO 170 g\nPESO ESCURRIDO 120 g\nPRODUCTO DE ECUADOR\nLOTE A2317\nPRODUCTO_VISTO: lata de atún', '16'],
    ['champú', 'SHAMPOO REPARACIÓN TOTAL\nAQUA, SODIUM LAURETH SULFATE, COCAMIDOPROPYL BETAINE\n400 ml\nHECHO EN MÉXICO\nPRODUCTO_VISTO: botella de champú', '33'],
    ['reloj', 'STAINLESS STEEL BACK\nWATER RESISTANT 5 ATM\nJAPAN MOVT\nPRODUCTO_VISTO: reloj de pulsera', '91'],
    ['café', 'CAFÉ TOSTADO Y MOLIDO\n100% ARÁBICA\nCONTENIDO NETO 500 g\nPRODUCTO DE COLOMBIA\nPRODUCTO_VISTO: bolsa de café molido', '09'],
    ['foto sin texto', 'PRODUCTO_VISTO: sombrero de paja', '65'],
  ];

  for (const [nombre, leido, capitulo] of casos) {
    it(`${nombre} → capítulo ${capitulo}`, async () => {
      responder = contesta(leido);
      const t = await proveedorAnthropic.leer(FOTO, 'image/jpeg');
      const a = analizar(t.texto);
      expect(a.legible, nombre).toBe(true);
      expect(a.familia?.capitulos, `${nombre}: ${JSON.stringify(a.familia)} / ${JSON.stringify(a.candidatas)}`).toContain(capitulo);
    });
  }
});
