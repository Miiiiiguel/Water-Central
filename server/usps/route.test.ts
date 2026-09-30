import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { enviosRouter } from './route';

// La ruta de verdad, montada en un servidor de prueba: lee el cuerpo
// JSON, valida, y sin credenciales responde que no está activada sin
// llamar a nadie.

let server: Server;
let base = '';
const guardado = { id: process.env.USPS_CLIENT_ID, secreto: process.env.USPS_CLIENT_SECRET };

beforeAll(async () => {
  delete process.env.USPS_CLIENT_ID;
  delete process.env.USPS_CLIENT_SECRET;
  const app = express();
  app.use('/api', enviosRouter);
  await new Promise<void>((listo) => {
    server = app.listen(0, '127.0.0.1', () => listo());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server?.close();
  if (guardado.id !== undefined) process.env.USPS_CLIENT_ID = guardado.id;
  if (guardado.secreto !== undefined) process.env.USPS_CLIENT_SECRET = guardado.secreto;
});

const pedir = (cuerpo: unknown) =>
  fetch(`${base}/api/envios/eeuu/tarifa`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });

describe('POST /api/envios/eeuu/tarifa', () => {
  it('un pedido válido pasa la validación y, sin credenciales, dice que no está activado', async () => {
    const res = await pedir({ origen: '33166', pesoG: 350, largoCm: 23, anchoCm: 15, altoCm: 8 });
    expect(res.status).toBe(503);
    const cuerpo = await res.json();
    expect(cuerpo).toMatchObject({ ok: false, causa: 'no_configurado' });
    expect(cuerpo.mensaje).toContain('valor fijo');
  });

  it('un ZIP que no tiene 5 dígitos se rechaza antes de llamar al correo', async () => {
    const res = await pedir({ origen: '331', pesoG: 350, largoCm: 23, anchoCm: 15, altoCm: 8 });
    expect(res.status).toBe(400);
    expect((await res.json()).causa).toBe('pedido_invalido');
  });

  it('un peso por encima de lo que el correo acepta se rechaza', async () => {
    const res = await pedir({ origen: '33166', pesoG: 40_000, largoCm: 23, anchoCm: 15, altoCm: 8 });
    expect(res.status).toBe(400);
  });
});
