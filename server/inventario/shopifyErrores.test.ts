import { describe, expect, it } from 'vitest';
import { datosTienda, mensajeRechazo, registrarWebhooks } from './shopify';

// Lo que Shopify devuelve cuando rechaza una llamada, y lo que se le dice a la persona.
const resp = (estado: number, cuerpo: unknown = {}) => new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'content-type': 'application/json' } });
const cred = { dominio: 'mi-tienda.myshopify.com', token: 'shpat_x', secretoApi: 'sec' };

describe('rechazos de Shopify explicados', () => {
  it('sin el permiso de ubicaciones dice cuál falta (el fallo real de la primera conexión)', async () => {
    const f = (async (u: string) => (u.endsWith('/shop.json') ? resp(200, { shop: { name: 'T' } }) : resp(403, { errors: '[API] This action requires merchant approval for read_locations scope.' }))) as unknown as typeof fetch;
    await expect(datosTienda(f, cred)).rejects.toThrow(/falta el permiso read_locations/);
  });
  it('si no deja crear avisos por datos protegidos de clientes, lo explica y dice qué hacer', async () => {
    const f = (async () => resp(403, { errors: 'This app is not approved to subscribe to webhook topics containing protected customer data.' })) as unknown as typeof fetch;
    await expect(registrarWebhooks(f, cred, 'https://x.co/h')).rejects.toThrow(/datos protegidos de clientes/);
  });
  it('en cualquier otro 401/403 nombra la llamada y lo que respondió Shopify', () => {
    const m = mensajeRechazo(401, '/products.json?limit=250', 'Invalid API key or access token');
    expect(m).toContain('/products.json');
    expect(m).toContain('(401)');
    expect(m).toContain('Invalid API key or access token');
    expect(m).not.toContain('limit=250');
    expect(mensajeRechazo(403, '/shop.json', '')).not.toContain('Detalle de Shopify');
  });
});
