import express from 'express';
import { randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { JSON_BODY_LIMIT, makeLimiter } from '../security';
import { getSupabaseAdmin } from '../supabaseAdmin';
import { requireRole, requireUser } from '../auth';
import { logSecurityEvent } from '../log';
import { captureException } from '../monitoring';
import { appUrl } from '../email';
import { cifrar, cifradoDisponible, hashLlave, nuevaLlaveApi } from './crypto';
import { normalizarDominioShopify, urlTiendaPublica, type Resolver } from './seguridad';
import * as shopify from './shopify';
import * as woo from './woocommerce';
import {
  aplicarPedido, cargarIntegracion, credencialesDe, diagnosticar, empujarProductoSiCorresponde, empujarStock, importarCatalogo, repararAvisos,
  type Credenciales,
} from './sincronizacion';
import { anotarEvento } from './eventos';
import { registrarMovimiento, type TipoMov } from './movimientos';

// Inventario del casillero + integraciones con Shopify y WordPress
// (WooCommerce). Lo que el cliente ve y edita lo lee del navegador con RLS
// (supabase/casillero.sql); aquí viven las cosas que no pueden depender
// del navegador: las llaves de las tiendas, los webhooks firmados y la API
// con llave para sistemas propios.

export interface Dependencias {
  admin: () => SupabaseClient | null;
  fetchFn: typeof fetch;
  resolver?: Resolver;
  /** URL pública https de la app, o null si no la hay. */
  urlPublica: (req: express.Request) => string | null;
}

const dependenciasReales: Dependencias = {
  admin: getSupabaseAdmin,
  fetchFn: (...a) => fetch(...a),
  urlPublica: (req) => {
    const base = appUrl(req.get('host') ?? undefined);
    return base.startsWith('https://') ? base : null;
  },
};

const sinConfigurar = (res: express.Response) =>
  res.status(503).json({ error: 'cifrado_sin_configurar', message: 'Falta INTEGRATIONS_ENC_KEY en el servidor: sin ella no se pueden guardar llaves de tiendas.' });

const shopifySchema = z.object({ dominio: z.string().min(3).max(120), token: z.string().min(10).max(200), secretoApi: z.string().min(8).max(200) });
const wooSchema = z.object({ url: z.string().min(4).max(200), clave: z.string().regex(/^ck_[A-Za-z0-9]{10,80}$/), secreto: z.string().regex(/^cs_[A-Za-z0-9]{10,80}$/) });
const idSchema = z.string().uuid();
const movSchema = z.object({
  codigo: z.string().trim().toUpperCase().min(3).max(20),
  sku: z.string().trim().min(1).max(80),
  tipo: z.enum(['ingreso', 'venta', 'ajuste', 'devolucion']),
  cantidad: z.number().int().min(-100000).max(100000),
  referencia: z.string().trim().max(200).optional(),
});
const ventaApiSchema = z.object({ sku: z.string().trim().min(1).max(80), cantidad: z.number().int().min(1).max(100000), referencia: z.string().trim().min(1).max(120) });

export function crearInventarioRouter(deps: Dependencias = dependenciasReales) {
  const router = express.Router();
  const f = deps.fetchFn;
  const limAcciones = makeLimiter('inventario_acciones', 60);
  const limWebhooks = makeLimiter('inventario_webhooks', 1200);
  const limApi = makeLimiter('inventario_api', 600);
  const json = express.json({ limit: JSON_BODY_LIMIT });
  const jsonGrande = express.json({ limit: '256kb' });
  const crudo = express.raw({ type: () => true, limit: '1mb' });

  const urlAvisos = (base: string, plataforma: string, id: string) => `${base}/api/inventario/webhooks/${plataforma}/${id}`;

  // ---------------------------------------------------------------------
  // Conectar una tienda
  // ---------------------------------------------------------------------
  router.post('/inventario/integraciones/shopify', limAcciones, json, requireUser(), async (req, res) => {
    if (!cifradoDisponible()) return sinConfigurar(res);
    const admin = deps.admin();
    if (!admin) return res.status(503).json({ error: 'sin_registro' });
    const base = deps.urlPublica(req);
    if (!base) return res.status(503).json({ error: 'sin_url_publica', message: 'Falta PUBLIC_APP_URL (https) para que Shopify pueda avisarnos de las ventas.' });
    const p = shopifySchema.safeParse(req.body);
    const dominio = p.success ? normalizarDominioShopify(p.data.dominio) : null;
    if (!p.success || !dominio) return res.status(400).json({ error: 'datos_invalidos', message: 'El dominio debe ser tu-tienda.myshopify.com.' });

    const { user } = res.locals.auth!;
    const cred = { dominio, token: p.data.token.trim(), secretoApi: p.data.secretoApi.trim() };
    try {
      const tienda = await shopify.datosTienda(f, cred);
      const { data: fila, error } = await admin.from('casillero_integraciones')
        .insert({ user_id: user.id, plataforma: 'shopify', dominio, ubicacion_id: tienda.ubicacionId })
        .select('*').single();
      if (error) return res.status(error.code === '23505' ? 409 : 500).json({ error: error.code === '23505' ? 'ya_conectada' : 'no_guardado', message: error.code === '23505' ? 'Esa tienda ya está conectada.' : undefined });
      await admin.from('casillero_integraciones_secretos').insert({ integracion_id: fila.id, secretos_cifrados: cifrar(JSON.stringify({ token: cred.token, secretoApi: cred.secretoApi })), webhook_secret: cred.secretoApi });
      try {
        const hooks = await shopify.registrarWebhooks(f, cred, urlAvisos(base, 'shopify', fila.id));
        await admin.from('casillero_integraciones').update({ webhooks: hooks }).eq('id', fila.id);
      } catch (e) {
        await admin.from('casillero_integraciones').delete().eq('id', fila.id);
        throw e;
      }
      await anotarEvento(admin, { integracionId: fila.id, userId: user.id, tipo: 'conexion', resumen: `Shopify conectado: ${tienda.nombre}` });
      res.json({ id: fila.id, nombre: tienda.nombre });
    } catch (e) {
      res.status(422).json({ error: 'no_se_pudo_conectar', message: (e as Error).message });
    }
  });

  router.post('/inventario/integraciones/woocommerce', limAcciones, json, requireUser(), async (req, res) => {
    if (!cifradoDisponible()) return sinConfigurar(res);
    const admin = deps.admin();
    if (!admin) return res.status(503).json({ error: 'sin_registro' });
    const base = deps.urlPublica(req);
    if (!base) return res.status(503).json({ error: 'sin_url_publica', message: 'Falta PUBLIC_APP_URL (https) para que tu tienda pueda avisarnos de las ventas.' });
    const p = wooSchema.safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: 'datos_invalidos', message: 'Revisa la dirección y las llaves (ck_… y cs_…).' });

    const { user } = res.locals.auth!;
    try {
      const url = await urlTiendaPublica(p.data.url, deps.resolver);
      const cred = { url, clave: p.data.clave, secreto: p.data.secreto };
      await woo.verificarCredenciales(f, cred);
      const { data: fila, error } = await admin.from('casillero_integraciones').insert({ user_id: user.id, plataforma: 'woocommerce', dominio: url }).select('*').single();
      if (error) return res.status(error.code === '23505' ? 409 : 500).json({ error: error.code === '23505' ? 'ya_conectada' : 'no_guardado', message: error.code === '23505' ? 'Esa tienda ya está conectada.' : undefined });
      const secretoWebhook = randomBytes(24).toString('hex');
      await admin.from('casillero_integraciones_secretos').insert({ integracion_id: fila.id, secretos_cifrados: cifrar(JSON.stringify({ clave: cred.clave, secreto: cred.secreto })), webhook_secret: secretoWebhook });
      try {
        const ids = await woo.registrarWebhooks(f, cred, urlAvisos(base, 'woocommerce', fila.id), secretoWebhook);
        await admin.from('casillero_integraciones').update({ webhooks: ids }).eq('id', fila.id);
      } catch (e) {
        await admin.from('casillero_integraciones').delete().eq('id', fila.id);
        throw e;
      }
      await anotarEvento(admin, { integracionId: fila.id, userId: user.id, tipo: 'conexion', resumen: `WooCommerce conectado: ${url}` });
      res.json({ id: fila.id, nombre: url });
    } catch (e) {
      res.status(422).json({ error: 'no_se_pudo_conectar', message: (e as Error).message });
    }
  });

  // ---------------------------------------------------------------------
  // Acciones sobre una integración
  // ---------------------------------------------------------------------
  async function integracionDelUsuario(req: express.Request, res: express.Response) {
    const id = idSchema.safeParse(req.params.id);
    if (!id.success) { res.status(400).json({ error: 'id_invalido' }); return null; }
    const admin = deps.admin();
    if (!admin) { res.status(503).json({ error: 'sin_registro' }); return null; }
    const ci = await cargarIntegracion(admin, id.data);
    const { user, profile } = res.locals.auth!;
    if (!ci || (ci.fila.user_id !== user.id && profile.role !== 'vendedor')) { res.status(404).json({ error: 'no_encontrada' }); return null; }
    return { admin, ...ci, cred: credencialesDe(ci.fila, ci.secretos.json) as Credenciales };
  }

  router.post('/inventario/integraciones/:id/importar', limAcciones, requireUser(), async (req, res) => {
    const c = await integracionDelUsuario(req, res);
    if (!c) return;
    try {
      res.json(await importarCatalogo(c.admin, f, c.fila, c.cred));
    } catch (e) {
      captureException(e, { route: 'inventario.importar' });
      res.status(422).json({ error: 'importacion_fallida', message: (e as Error).message });
    }
  });

  router.post('/inventario/integraciones/:id/sincronizar', limAcciones, requireUser(), async (req, res) => {
    const c = await integracionDelUsuario(req, res);
    if (!c) return;
    try {
      res.json(await empujarStock(c.admin, f, c.fila, c.cred));
    } catch (e) {
      res.status(422).json({ error: 'sincronizacion_fallida', message: (e as Error).message });
    }
  });

  router.post('/inventario/integraciones/:id/diagnostico', limAcciones, requireUser(), async (req, res) => {
    const c = await integracionDelUsuario(req, res);
    const base = deps.urlPublica(req);
    if (!c) return;
    if (!base) return res.status(503).json({ error: 'sin_url_publica', message: 'Falta PUBLIC_APP_URL (https).' });
    res.json({ chequeos: await diagnosticar(c.admin, f, c.fila, c.cred, urlAvisos(base, c.fila.plataforma, c.fila.id)) });
  });

  router.post('/inventario/integraciones/:id/reparar', limAcciones, requireUser(), async (req, res) => {
    const c = await integracionDelUsuario(req, res);
    const base = deps.urlPublica(req);
    if (!c) return;
    if (!base) return res.status(503).json({ error: 'sin_url_publica', message: 'Falta PUBLIC_APP_URL (https).' });
    try {
      res.json(await repararAvisos(c.admin, f, c.fila, c.cred, c.secretos, urlAvisos(base, c.fila.plataforma, c.fila.id)));
    } catch (e) {
      res.status(422).json({ error: 'reparacion_fallida', message: (e as Error).message });
    }
  });

  router.post('/inventario/integraciones/:id/opciones', limAcciones, json, requireUser(), async (req, res) => {
    const c = await integracionDelUsuario(req, res);
    if (!c) return;
    const p = z.object({ syncStock: z.boolean() }).safeParse(req.body);
    if (!p.success) return res.status(400).json({ error: 'datos_invalidos' });
    await c.admin.from('casillero_integraciones').update({ sync_stock: p.data.syncStock }).eq('id', c.fila.id);
    res.json({ ok: true });
  });

  router.delete('/inventario/integraciones/:id', limAcciones, requireUser(), async (req, res) => {
    const c = await integracionDelUsuario(req, res);
    if (!c) return;
    // Se intenta quitar los webhooks de la tienda; si ya no responde, se borra igual.
    try {
      const ids = ((c.fila.webhooks as unknown[]) ?? []).map((w) => (typeof w === 'object' && w ? (w as { id: number }).id : Number(w)));
      if (c.cred.plataforma === 'shopify') await shopify.borrarWebhooks(f, c.cred.cred, ids);
      else await woo.borrarWebhooks(f, c.cred.cred, ids);
    } catch { /* la tienda ya no responde */ }
    await c.admin.from('casillero_integraciones').delete().eq('id', c.fila.id);
    res.json({ ok: true });
  });

  // ---------------------------------------------------------------------
  // Webhooks de las tiendas (firmados, cuerpo crudo)
  // ---------------------------------------------------------------------
  router.post('/inventario/webhooks/shopify/:id', limWebhooks, crudo, async (req, res) => {
    const admin = deps.admin();
    const id = idSchema.safeParse(req.params.id);
    if (!admin || !id.success || !Buffer.isBuffer(req.body)) return res.status(400).json({ error: 'bad_request' });
    const ci = await cargarIntegracion(admin, id.data);
    if (!ci || ci.fila.plataforma !== 'shopify') return res.status(404).json({ error: 'no_encontrada' });
    if (!shopify.verificarWebhook(req.body, req.header('x-shopify-hmac-sha256'), ci.secretos.webhookSecret)) {
      logSecurityEvent('webhook_signature_failed', req, { source: 'shopify' });
      return res.status(401).json({ error: 'bad_signature' });
    }
    if ((req.header('x-shopify-shop-domain') ?? '').toLowerCase() !== ci.fila.dominio) return res.status(200).json({ ignorado: 'otra_tienda' });
    try {
      const cuerpo = JSON.parse(req.body.toString('utf8'));
      const tema = req.header('x-shopify-topic');
      let r;
      if (tema === 'refunds/create') {
        const { pedidoId, reembolsoId, lineas } = shopify.lineasDeReembolso(cuerpo);
        r = await aplicarPedido(admin, { userId: ci.fila.user_id, integracionId: ci.fila.id, origen: 'shopify', prefijo: 'shopify', pedidoId, lineas, modo: 'reembolso', reembolsoId });
      } else if (tema === 'orders/paid' || tema === 'orders/cancelled') {
        const { pedidoId, lineas } = shopify.lineasDePedido(cuerpo);
        r = await aplicarPedido(admin, { userId: ci.fila.user_id, integracionId: ci.fila.id, origen: 'shopify', prefijo: 'shopify', pedidoId, lineas, modo: tema === 'orders/paid' ? 'venta' : 'anular' });
      } else {
        return res.json({ ignorado: tema });
      }
      for (const pid of r.productos) await empujarProductoSiCorresponde(admin, f, ci.fila.user_id, pid);
      res.json({ aplicadas: r.aplicadas, sin_producto: r.sinProducto });
    } catch (e) {
      captureException(e, { route: 'inventario.webhook.shopify' });
      await anotarEvento(admin, { integracionId: ci.fila.id, userId: ci.fila.user_id, tipo: 'error', resumen: `No se pudo procesar un aviso de Shopify: ${(e as Error).message}` });
      res.status(500).json({ error: 'internal' }); // Shopify reintenta; los pedidos son idempotentes
    }
  });

  router.post('/inventario/webhooks/woocommerce/:id', limWebhooks, crudo, async (req, res) => {
    const admin = deps.admin();
    const id = idSchema.safeParse(req.params.id);
    if (!admin || !id.success || !Buffer.isBuffer(req.body)) return res.status(400).json({ error: 'bad_request' });
    const ci = await cargarIntegracion(admin, id.data);
    if (!ci || ci.fila.plataforma !== 'woocommerce') return res.status(404).json({ error: 'no_encontrada' });
    if (!woo.verificarWebhook(req.body, req.header('x-wc-webhook-signature'), ci.secretos.webhookSecret)) {
      logSecurityEvent('webhook_signature_failed', req, { source: 'woocommerce' });
      return res.status(401).json({ error: 'bad_signature' });
    }
    let pedido: Parameters<typeof woo.lineasDePedido>[0];
    try { pedido = JSON.parse(req.body.toString('utf8')); } catch { return res.json({ ping: true }); } // el aviso de prueba al crear el webhook no es JSON
    try {
      const { pedidoId, estado, lineas } = woo.lineasDePedido(pedido);
      const anula = woo.ESTADOS_ANULADO.has(estado);
      if (!woo.ESTADOS_VENTA.has(estado) && !anula) return res.json({ ignorado: estado });
      const r = await aplicarPedido(admin, { userId: ci.fila.user_id, integracionId: ci.fila.id, origen: 'woocommerce', prefijo: 'woo', pedidoId, lineas, modo: anula ? 'anular' : 'venta' });
      for (const pid of r.productos) await empujarProductoSiCorresponde(admin, f, ci.fila.user_id, pid);
      res.json({ aplicadas: r.aplicadas, sin_producto: r.sinProducto });
    } catch (e) {
      captureException(e, { route: 'inventario.webhook.woo' });
      await anotarEvento(admin, { integracionId: ci.fila.id, userId: ci.fila.user_id, tipo: 'error', resumen: `No se pudo procesar un aviso de WooCommerce: ${(e as Error).message}` });
      res.status(500).json({ error: 'internal' });
    }
  });

  // ---------------------------------------------------------------------
  // Movimientos del equipo: uno, o en lote (ingreso masivo desde un CSV)
  // ---------------------------------------------------------------------
  router.post('/inventario/movimiento', limAcciones, json, requireRole('vendedor'), async (req, res) => {
    const p = movSchema.safeParse(req.body);
    const admin = deps.admin();
    if (!p.success || !p.data.cantidad) return res.status(400).json({ error: 'datos_invalidos' });
    if (!admin) return res.status(503).json({ error: 'sin_registro' });
    const { data: cliente } = await admin.from('profiles').select('id').eq('casillero_codigo', p.data.codigo).maybeSingle();
    if (!cliente) return res.status(404).json({ error: 'cliente_no_encontrado', message: 'No existe un cliente con ese código.' });
    const r = await registrarMovimiento(admin, { userId: cliente.id, sku: p.data.sku, tipo: p.data.tipo as TipoMov, cantidad: p.data.cantidad, origen: p.data.tipo === 'ingreso' ? 'bodega' : 'manual', referencia: p.data.referencia });
    if (!r.ok) return res.status(r.motivo === 'sin_producto' ? 404 : 500).json({ error: r.motivo === 'sin_producto' ? 'producto_no_encontrado' : 'no_guardado', message: r.motivo === 'sin_producto' ? 'Ese cliente no tiene un producto con ese SKU.' : r.detalle });
    await empujarProductoSiCorresponde(admin, f, cliente.id, r.productoId);
    res.json({ ok: true });
  });

  router.post('/inventario/movimientos', limAcciones, jsonGrande, requireRole('vendedor'), async (req, res) => {
    const p = z.object({ items: z.array(movSchema).min(1).max(500) }).safeParse(req.body);
    const admin = deps.admin();
    if (!p.success) return res.status(400).json({ error: 'datos_invalidos', message: 'Máximo 500 filas, cada una con código, SKU, tipo y cantidad entera.' });
    if (!admin) return res.status(503).json({ error: 'sin_registro' });

    const clientes = new Map<string, string | null>();
    const resultados: { fila: number; ok: boolean; error?: string }[] = [];
    const tocados = new Map<string, Set<string>>(); // cliente -> productos
    for (const [i, it] of Array.from(p.data.items.entries())) {
      if (!it.cantidad) { resultados.push({ fila: i + 1, ok: false, error: 'La cantidad no puede ser cero' }); continue; }
      if (!clientes.has(it.codigo)) {
        const { data } = await admin.from('profiles').select('id').eq('casillero_codigo', it.codigo).maybeSingle();
        clientes.set(it.codigo, data?.id ?? null);
      }
      const userId = clientes.get(it.codigo);
      if (!userId) { resultados.push({ fila: i + 1, ok: false, error: `No existe el cliente ${it.codigo}` }); continue; }
      const r = await registrarMovimiento(admin, { userId, sku: it.sku, tipo: it.tipo as TipoMov, cantidad: it.cantidad, origen: it.tipo === 'ingreso' ? 'bodega' : 'manual', referencia: it.referencia });
      if (!r.ok) { resultados.push({ fila: i + 1, ok: false, error: r.motivo === 'sin_producto' ? `${it.codigo} no tiene el SKU ${it.sku}` : (r.detalle ?? 'No se pudo guardar') }); continue; }
      resultados.push({ fila: i + 1, ok: true });
      (tocados.get(userId) ?? tocados.set(userId, new Set()).get(userId)!).add(r.productoId);
    }
    for (const [userId, productos] of Array.from(tocados.entries())) for (const pid of Array.from(productos)) await empujarProductoSiCorresponde(admin, f, userId, pid);
    res.json({ aplicados: resultados.filter((r) => r.ok).length, resultados });
  });

  // ---------------------------------------------------------------------
  // Llaves de API (para el plugin de WordPress, un ERP, etc.)
  // ---------------------------------------------------------------------
  router.post('/inventario/llaves', limAcciones, json, requireUser(), async (req, res) => {
    const p = z.object({ nombre: z.string().trim().min(1).max(60) }).safeParse(req.body);
    const admin = deps.admin();
    if (!p.success) return res.status(400).json({ error: 'datos_invalidos' });
    if (!admin) return res.status(503).json({ error: 'sin_registro' });
    const { user } = res.locals.auth!;
    const { count } = await admin.from('casillero_api_keys').select('id', { count: 'exact', head: true }).eq('user_id', user.id);
    if ((count ?? 0) >= 10) return res.status(409).json({ error: 'demasiadas', message: 'Máximo 10 llaves. Borra alguna.' });
    const k = nuevaLlaveApi();
    const { error } = await admin.from('casillero_api_keys').insert({ user_id: user.id, nombre: p.data.nombre, prefijo: k.prefijo, hash: k.hash });
    if (error) return res.status(500).json({ error: 'no_guardado' });
    res.json({ llave: k.llave, aviso: 'Guárdala ahora: no se vuelve a mostrar.' }); // solo se guarda el hash
  });

  router.delete('/inventario/llaves/:id', limAcciones, requireUser(), async (req, res) => {
    const id = idSchema.safeParse(req.params.id);
    const admin = deps.admin();
    if (!id.success) return res.status(400).json({ error: 'id_invalido' });
    if (!admin) return res.status(503).json({ error: 'sin_registro' });
    await admin.from('casillero_api_keys').delete().eq('id', id.data).eq('user_id', res.locals.auth!.user.id);
    res.json({ ok: true });
  });

  /** Autenticación de la API v1: Authorization: Bearer ecx_… */
  const conLlave: express.RequestHandler = async (req, res, next) => {
    const admin = deps.admin();
    const token = (req.header('authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
    if (!admin) return res.status(503).json({ error: 'sin_registro' });
    if (!/^ecx_[0-9a-f]{64}$/.test(token)) return res.status(401).json({ error: 'llave_invalida' });
    const { data } = await admin.from('casillero_api_keys').select('id, user_id').eq('hash', hashLlave(token)).maybeSingle();
    if (!data) {
      logSecurityEvent('unauthenticated', req, { reason: 'llave_api_invalida' });
      return res.status(401).json({ error: 'llave_invalida' });
    }
    res.locals.llave = data;
    void admin.from('casillero_api_keys').update({ ultimo_uso: new Date().toISOString() }).eq('id', data.id);
    next();
  };

  router.get('/v1/inventario', limApi, conLlave, async (_req, res) => {
    const admin = deps.admin()!;
    const { data } = await admin.from('casillero_inventario').select('sku, nombre, total_unidades, disponibles, vendidos').eq('user_id', res.locals.llave.user_id).order('sku').limit(5000);
    res.json({ productos: data ?? [] });
  });

  router.get('/v1/inventario/:sku', limApi, conLlave, async (req, res) => {
    const admin = deps.admin()!;
    const { data } = await admin.from('casillero_inventario').select('sku, nombre, total_unidades, disponibles, vendidos').eq('user_id', res.locals.llave.user_id).eq('sku', req.params.sku).maybeSingle();
    if (!data) return res.status(404).json({ error: 'producto_no_encontrado' });
    res.json(data);
  });

  // Un sistema propio avisa de una venta o devolución. `referencia` debe ser
  // única por pedido: repetirla no descuenta dos veces.
  for (const [ruta, tipo] of [['ventas', 'venta'], ['devoluciones', 'devolucion']] as const) {
    router.post(`/v1/inventario/${ruta}`, limApi, json, conLlave, async (req, res) => {
      const p = ventaApiSchema.safeParse(req.body);
      if (!p.success) return res.status(400).json({ error: 'datos_invalidos', message: 'Se espera { sku, cantidad (entero > 0), referencia }.' });
      const admin = deps.admin()!;
      const userId = res.locals.llave.user_id as string;
      const r = await registrarMovimiento(admin, { userId, sku: p.data.sku, tipo, cantidad: p.data.cantidad, origen: 'api', referencia: p.data.referencia, refExterna: `api:${userId}:${tipo}:${p.data.referencia}` });
      if (!r.ok) return res.status(r.motivo === 'sin_producto' ? 404 : 500).json({ error: r.motivo === 'sin_producto' ? 'producto_no_encontrado' : 'no_guardado' });
      if (!r.duplicado) await empujarProductoSiCorresponde(admin, f, userId, r.productoId);
      res.json({ ok: true, duplicado: r.duplicado });
    });
  }

  return router;
}

export const inventarioRouter = crearInventarioRouter();
