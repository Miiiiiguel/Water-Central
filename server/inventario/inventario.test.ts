import { describe, expect, it } from 'vitest';
import { randomBytes } from 'node:crypto';
import { cifrar, descifrar, claveDeCifrado, hashLlave, nuevaLlaveApi } from './crypto';
import { esIpPrivada, normalizarDominioShopify, urlTiendaPublica } from './seguridad';
import * as shopify from './shopify';
import * as woo from './woocommerce';
import { cantidadConSigno } from './movimientos';

describe('cifrado de llaves', () => {
  const clave = randomBytes(32);
  it('cifra y descifra, y cada cifrado es distinto', () => {
    const a = cifrar('shpat_secreto', clave);
    expect(a).not.toContain('shpat_secreto');
    expect(descifrar(a, clave)).toBe('shpat_secreto');
    expect(cifrar('shpat_secreto', clave)).not.toBe(a);
  });
  it('un valor alterado o con otra clave no se descifra', () => {
    const a = cifrar('x', clave);
    expect(() => descifrar(a.slice(0, -2) + 'AA', clave)).toThrow();
    expect(() => descifrar(a, randomBytes(32))).toThrow();
  });
  it('acepta la clave en base64 o hex y rechaza tamaños raros', () => {
    const k = randomBytes(32);
    expect(claveDeCifrado({ INTEGRATIONS_ENC_KEY: k.toString('base64') } as never)?.equals(k)).toBe(true);
    expect(claveDeCifrado({ INTEGRATIONS_ENC_KEY: k.toString('hex') } as never)?.equals(k)).toBe(true);
    expect(claveDeCifrado({ INTEGRATIONS_ENC_KEY: 'corta' } as never)).toBeNull();
    expect(claveDeCifrado({} as never)).toBeNull();
  });
  it('la llave de API solo se guarda como hash', () => {
    const k = nuevaLlaveApi();
    expect(k.llave).toMatch(/^ecx_[0-9a-f]{64}$/);
    expect(k.hash).toBe(hashLlave(k.llave));
    expect(k.hash).not.toContain(k.llave);
  });
});

describe('seguridad de la dirección de la tienda (SSRF)', () => {
  const publica = async () => ['93.184.216.34'];
  it('acepta un dominio público por https', async () => {
    expect(await urlTiendaPublica('https://Mitienda.com/wp-admin', publica)).toBe('https://mitienda.com');
    expect(await urlTiendaPublica('mitienda.com', publica)).toBe('https://mitienda.com');
  });
  it.each([
    'http://mitienda.com', 'https://localhost', 'https://127.0.0.1', 'https://169.254.169.254/latest/meta-data',
    'https://user:pass@mitienda.com', 'https://mitienda.com:8443', 'https://interno', 'https://[::1]',
  ])('rechaza %s', async (u) => {
    await expect(urlTiendaPublica(u, publica)).rejects.toThrow();
  });
  it('rechaza un nombre público que resuelve a una IP interna (rebinding)', async () => {
    await expect(urlTiendaPublica('https://malo.example.com', async () => ['10.0.0.5'])).rejects.toThrow();
    await expect(urlTiendaPublica('https://malo.example.com', async () => ['93.184.216.34', '192.168.1.1'])).rejects.toThrow();
  });
  it('reconoce rangos privados IPv4 e IPv6', () => {
    for (const ip of ['10.1.1.1', '172.16.0.1', '172.31.255.255', '192.168.0.1', '127.0.0.1', '169.254.1.1', '100.64.0.1', '::1', 'fd00::1', 'fe80::1', '::ffff:10.0.0.1']) expect(esIpPrivada(ip)).toBe(true);
    for (const ip of ['8.8.8.8', '172.32.0.1', '93.184.216.34', '2606:4700::1111']) expect(esIpPrivada(ip)).toBe(false);
  });
  it('solo acepta dominios *.myshopify.com', () => {
    expect(normalizarDominioShopify('https://Mi-Tienda.myshopify.com/admin')).toBe('mi-tienda.myshopify.com');
    expect(normalizarDominioShopify('evil.com')).toBeNull();
    expect(normalizarDominioShopify('mi-tienda.myshopify.com.evil.com')).toBeNull();
    expect(normalizarDominioShopify('127.0.0.1')).toBeNull();
  });
});

describe('firma de los webhooks', () => {
  const cuerpo = Buffer.from('{"id":1}');
  it('Shopify: acepta la firma buena y rechaza la mala, otra clave o ausente', () => {
    const f = shopify.firmaWebhook(cuerpo, 'secreto');
    expect(shopify.verificarWebhook(cuerpo, f, 'secreto')).toBe(true);
    expect(shopify.verificarWebhook(Buffer.from('{"id":2}'), f, 'secreto')).toBe(false);
    expect(shopify.verificarWebhook(cuerpo, f, 'otro')).toBe(false);
    expect(shopify.verificarWebhook(cuerpo, undefined, 'secreto')).toBe(false);
    expect(shopify.verificarWebhook(cuerpo, 'x', 'secreto')).toBe(false);
  });
  it('Woo: igual', () => {
    const f = woo.firmaWebhook(cuerpo, 's');
    expect(woo.verificarWebhook(cuerpo, f, 's')).toBe(true);
    expect(woo.verificarWebhook(cuerpo, f, 'z')).toBe(false);
  });
});

describe('movimientos', () => {
  it('pone el signo que la base exige', () => {
    expect(cantidadConSigno('venta', 3)).toBe(-3);
    expect(cantidadConSigno('venta', -3)).toBe(-3);
    expect(cantidadConSigno('ingreso', 5)).toBe(5);
    expect(cantidadConSigno('devolucion', 2)).toBe(2);
    expect(cantidadConSigno('ajuste', -4)).toBe(-4);
    expect(() => cantidadConSigno('venta', 0)).toThrow();
  });
});

describe('pedidos de la tienda', () => {
  it('extrae las líneas con SKU de un pedido de Shopify y de WooCommerce', () => {
    expect(shopify.lineasDePedido({ id: 7, line_items: [{ id: 1, sku: ' A ', quantity: 2 }, { id: 2, sku: '', quantity: 1 }, { id: 3, sku: null, quantity: 1 }] }))
      .toEqual({ pedidoId: '7', lineas: [{ sku: 'A', cantidad: 2, lineaId: '1' }] });
    expect(woo.lineasDePedido({ id: 9, status: 'processing', line_items: [{ id: 5, sku: 'B', quantity: 3 }] }))
      .toEqual({ pedidoId: '9', estado: 'processing', lineas: [{ sku: 'B', cantidad: 3, lineaId: '5' }] });
    expect(woo.ESTADOS_VENTA.has('processing')).toBe(true);
    expect(woo.ESTADOS_ANULADO.has('cancelled')).toBe(true);
    expect(woo.ESTADOS_VENTA.has('pending')).toBe(false);
  });
});

describe('conectores con una tienda de mentira', () => {
  const respuesta = (cuerpo: unknown, extra: Record<string, string> = {}, status = 200) =>
    new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json', ...extra } });

  it('Shopify: pagina por Link, usa solo variantes con SKU y no manda el token en la URL', async () => {
    const urls: string[] = [];
    const f = (async (url: string, init: RequestInit) => {
      urls.push(url);
      expect((init.headers as Record<string, string>)['X-Shopify-Access-Token']).toBe('tok');
      return url.includes('page_info=2')
        ? respuesta({ products: [{ title: 'Gorra', body_html: null, image: null, variants: [{ sku: 'G-1', title: 'Default Title', inventory_item_id: 22 }] }] })
        : respuesta({ products: [{ title: 'Camiseta', body_html: '<p>Algodón <b>100%</b></p>', image: { src: 'https://x/i.png' }, variants: [{ sku: 'C-S', title: 'S', inventory_item_id: 11 }, { sku: '', title: 'M', inventory_item_id: 12 }] }] },
            { link: '<https://t.myshopify.com/admin/api/2024-10/products.json?limit=250&page_info=2>; rel="next"' });
    }) as unknown as typeof fetch;
    const r = await shopify.listarProductos(f, { dominio: 't.myshopify.com', token: 'tok', secretoApi: 's' });
    expect(r).toEqual([
      { sku: 'C-S', nombre: 'Camiseta — S', descripcion: 'Algodón 100%', imagen: 'https://x/i.png', externoId: '11' },
      { sku: 'G-1', nombre: 'Gorra', descripcion: '', imagen: null, externoId: '22' },
    ]);
    expect(urls.every((u) => !u.includes('tok'))).toBe(true);
  });

  it('Shopify: un 401 se explica en español y el stock nunca baja de 0', async () => {
    await expect(shopify.datosTienda((async () => respuesta({}, {}, 401)) as unknown as typeof fetch, { dominio: 't.myshopify.com', token: 'x', secretoApi: 's' })).rejects.toThrow(/rechazó el token/);
    let cuerpo: { available: number } | null = null;
    const f = (async (_u: string, init: RequestInit) => { cuerpo = JSON.parse(String(init.body)); return respuesta({}); }) as unknown as typeof fetch;
    await shopify.fijarStock(f, { dominio: 't.myshopify.com', token: 't', secretoApi: 's' }, '9', '11', -5);
    expect(cuerpo).toMatchObject({ available: 0, location_id: 9, inventory_item_id: 11 });
  });

  it('Woo: lista simples y variaciones, y fija el stock en la variación correcta', async () => {
    const llamadas: { url: string; metodo: string; cuerpo?: unknown }[] = [];
    const f = (async (url: string, init: RequestInit) => {
      llamadas.push({ url, metodo: init.method ?? 'GET', cuerpo: init.body ? JSON.parse(String(init.body)) : undefined });
      expect((init.headers as Record<string, string>).Authorization).toBe(`Basic ${Buffer.from('ck_abc:cs_def').toString('base64')}`);
      if (url.includes('/variations')) return respuesta([{ id: 501, sku: 'V-1', attributes: [{ option: 'Rojo' }], image: null }]);
      if (url.includes('/products?')) return respuesta([{ id: 10, name: 'Taza', sku: 'T-1', type: 'simple', description: '', images: [] }, { id: 20, name: 'Buzo', sku: '', type: 'variable', description: '', images: [{ src: 'https://x/b.png' }] }], { 'x-wp-totalpages': '1' });
      return respuesta({});
    }) as unknown as typeof fetch;
    const cred = { url: 'https://mitienda.com', clave: 'ck_abc', secreto: 'cs_def' };
    const r = await woo.listarProductos(f, cred);
    expect(r.map((x) => [x.sku, x.externoId, x.externoExtra])).toEqual([['T-1', '10', null], ['V-1', '20', '501']]);
    await woo.fijarStock(f, cred, '20', '501', 7);
    expect(llamadas.at(-1)).toMatchObject({ metodo: 'PUT', url: 'https://mitienda.com/wp-json/wc/v3/products/20/variations/501', cuerpo: { manage_stock: true, stock_quantity: 7 } });
  });
});
