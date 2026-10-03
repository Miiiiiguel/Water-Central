import express from 'express';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { makeLimiter, JSON_BODY_LIMIT } from '../security';
import { requireUser } from '../auth';
import { getSupabaseAdmin, getUserFromRequest } from '../supabaseAdmin';
import { logSecurityEvent } from '../log';
import { esCuentaMaestra } from '../maestros';
import { escapeHtml, sendEmail, teamAddress } from '../email';
import { copDisplay } from '../catalog';
import { checkoutUrl, integritySignature, wompiConfigured } from '../wompi';
import { newRef, orderId } from '../ordenes';
import { MESES_PAUTA, PLAN_PAUTA, esSuyo, hoyColombia, porLugar, precioPauta, serieDiaria, topBusquedas, type Evento } from './portal';
import { directorio, metricas, pautaVigente, publico, sugeridos, terminos, type FabricanteFila } from './match';

// Fabricantes patrocinados: marcas, laboratorios y maquiladores que pagan
// una pauta para aparecer de primeros cuando alguien investiga un
// producto que ellos pueden fabricar. Ver match.ts (quién sale) y la
// sección de supabase/schema.sql (las tablas).
//
// Lo público: los sugeridos para una búsqueda, el directorio, el
// formulario de contacto (que se cuenta: es lo que se le muestra al
// fabricante para renovar) y la solicitud para aparecer. Lo demás, sólo
// las cuentas maestras.

export const fabricantesRouter = express.Router();

const lecturaLimiter = makeLimiter('fabricantes_lectura', 300);
const contactoLimiter = makeLimiter('fabricantes_contacto', 10);
const adminLimiter = makeLimiter('fabricantes_admin', 200);

export { hoyColombia };

const COLUMNAS =
  'id, nombre, descripcion, pais, ciudad, categorias, palabras, pedido_minimo, certificaciones, contacto_nombre, contacto_email, contacto_whatsapp, sitio_web, acceso_email, estado, activo, pauta_hasta, prioridad, plan, precio_mensual_usd, notas, created_at';

const aFila = (r: Record<string, unknown>): FabricanteFila =>
  ({
    ...r,
    categorias: (r.categorias as string[] | null) ?? [],
    palabras: (r.palabras as string[] | null) ?? [],
    prioridad: Number(r.prioridad) || 0,
    precio_mensual_usd: r.precio_mensual_usd === null || r.precio_mensual_usd === undefined ? null : Number(r.precio_mensual_usd),
  }) as FabricanteFila;

/** Los que pueden salir hoy (el resto del filtro lo hace match.ts). */
async function vigentes(admin: SupabaseClient, hoy: string): Promise<FabricanteFila[]> {
  const { data, error } = await admin
    .from('manufacturers')
    .select(COLUMNAS)
    .eq('estado', 'aprobado')
    .eq('activo', true)
    .gte('pauta_hasta', hoy);
  if (error) {
    console.error('[fabricantes] lectura falló:', error.message);
    return [];
  }
  return (data ?? []).map((r) => aFila(r as Record<string, unknown>));
}

const LUGARES = ['chat', 'roi', 'directorio', 'etiqueta'] as const;

/** Cuenta que se mostraron. No frena la respuesta ni la tumba si falla. */
function contarImpresiones(admin: SupabaseClient, ids: string[], lugar: string, contexto: string | null) {
  if (!ids.length) return;
  void admin
    .from('manufacturer_events')
    .insert(ids.map((id) => ({ manufacturer_id: id, tipo: 'impresion', lugar, contexto: contexto?.slice(0, 200) ?? null })))
    .then(({ error }) => error && console.error('[fabricantes] no se contaron impresiones:', error.message));
}

// ---------------------------------------------------------------------
// Público
// ---------------------------------------------------------------------

const busquedaSchema = z.object({
  q: z.string().trim().max(200).optional(),
  codigo: z.string().trim().regex(/^[\d.]{2,14}$/).optional(),
  lugar: z.enum(LUGARES).optional(),
});

fabricantesRouter.get('/fabricantes/sugeridos', lecturaLimiter, async (req, res) => {
  const p = busquedaSchema.safeParse(req.query);
  if (!p.success) return res.status(400).json({ error: 'busqueda_invalida' });
  const { q, codigo, lugar } = p.data;
  res.setHeader('Cache-Control', 'no-store');
  const admin = getSupabaseAdmin();
  if (!admin || (!codigo && !terminos(q ?? '').length)) return res.json({ fabricantes: [] });

  const lista = sugeridos(await vigentes(admin, hoyColombia()), { q, codigo }, hoyColombia());
  contarImpresiones(admin, lista.map((f) => f.id), lugar ?? 'chat', q || codigo || null);
  res.json({ fabricantes: lista.map(publico) });
});

fabricantesRouter.get('/fabricantes', lecturaLimiter, async (req, res) => {
  const p = busquedaSchema.safeParse(req.query);
  if (!p.success) return res.status(400).json({ error: 'busqueda_invalida' });
  res.setHeader('Cache-Control', 'no-store');
  const admin = getSupabaseAdmin();
  if (!admin) return res.json({ fabricantes: [] });
  const lista = directorio(await vigentes(admin, hoyColombia()), p.data.q ?? null, hoyColombia());
  contarImpresiones(admin, lista.map((f) => f.id), 'directorio', p.data.q || null);
  res.json({ fabricantes: lista.map(publico) });
});

const contactoSchema = z.object({
  nombre: z.string().trim().min(2).max(120),
  correo: z.string().trim().email().max(200),
  telefono: z.string().trim().max(40).optional().default(''),
  mensaje: z.string().trim().min(5).max(1500),
  contexto: z.string().trim().max(200).optional().default(''),
  lugar: z.enum(LUGARES).optional().default('directorio'),
});

/** wa.me sólo acepta dígitos con el indicativo del país. */
export const enlaceWhatsapp = (numero: string | null) => {
  const d = (numero ?? '').replace(/\D/g, '');
  return d.length >= 8 ? `https://wa.me/${d}` : null;
};

function correoDeContacto(f: FabricanteFila, c: z.infer<typeof contactoSchema>) {
  const filas: Array<[string, string]> = [
    ['Nombre', c.nombre],
    ['Correo', c.correo],
    ['Teléfono', c.telefono || '—'],
    ['Producto que busca', c.contexto || '—'],
    ['Mensaje', c.mensaje],
  ];
  const text = `${f.nombre}: tienes un cliente interesado en fabricar con ustedes, que te llega desde Easycomex.\n\n${filas.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\nRespóndele a este correo para escribirle directamente.`;
  const html = `<p><b>${escapeHtml(f.nombre)}</b>: tienes un cliente interesado en fabricar con ustedes, que te llega desde Easycomex.</p><table style="border-collapse:collapse">${filas
    .map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#8b8a9c">${escapeHtml(k)}</td><td style="padding:4px 0;font-weight:600">${escapeHtml(v)}</td></tr>`)
    .join('')}</table><p>Respóndele a este correo para escribirle directamente.</p>`;
  return { text, html };
}

fabricantesRouter.post('/fabricantes/:id/contacto', contactoLimiter, express.json({ limit: JSON_BODY_LIMIT }), async (req, res) => {
  const id = String(req.params.id);
  const p = contactoSchema.safeParse(req.body);
  if (!z.string().uuid().safeParse(id).success || !p.success) {
    logSecurityEvent('invalid_input', req, { form: 'fabricante_contacto' });
    return res.status(400).json({ error: 'datos_invalidos', message: 'Revisa tu nombre, tu correo y el mensaje.' });
  }
  const admin = getSupabaseAdmin();
  if (!admin) return res.status(503).json({ error: 'sin_base', message: 'Los contactos todavía no están disponibles.' });

  const { data } = await admin.from('manufacturers').select(COLUMNAS).eq('id', id).maybeSingle();
  const f = data ? aFila(data as Record<string, unknown>) : null;
  if (!f || !pautaVigente(f, hoyColombia())) return res.status(404).json({ error: 'no_disponible', message: 'Este fabricante ya no está disponible.' });

  const user = await getUserFromRequest(req);
  const c = p.data;
  const { error } = await admin.from('manufacturer_events').insert({
    manufacturer_id: f.id,
    tipo: 'contacto',
    lugar: c.lugar,
    contexto: c.contexto || null,
    user_id: user?.id ?? null,
    nombre: c.nombre,
    correo: c.correo,
    telefono: c.telefono || null,
    mensaje: c.mensaje,
  });
  if (error) {
    console.error('[fabricantes] no se guardó el contacto:', error.message);
    return res.status(500).json({ error: 'base', message: 'No pudimos enviar tu mensaje. Intenta de nuevo.' });
  }

  const correo = correoDeContacto(f, c);
  const asunto = `Nuevo cliente para ${f.nombre} desde Easycomex`;
  if (f.contacto_email) void sendEmail({ to: f.contacto_email, subject: asunto, ...correo, replyTo: c.correo });
  const equipo = teamAddress();
  if (equipo) void sendEmail({ to: equipo, subject: `[Fabricantes] ${asunto}`, ...correo, replyTo: c.correo });

  res.json({ ok: true, whatsapp: enlaceWhatsapp(f.contacto_whatsapp) });
});

const solicitudSchema = z.object({
  empresa: z.string().trim().min(2).max(120),
  contacto_nombre: z.string().trim().min(2).max(120),
  correo: z.string().trim().email().max(200),
  telefono: z.string().trim().max(40).optional().default(''),
  pais: z.string().trim().regex(/^[A-Z]{2}$/).optional().default('CO'),
  ciudad: z.string().trim().max(80).optional().default(''),
  que_fabrica: z.string().trim().min(5).max(1000),
});

// Un fabricante pide aparecer: queda 'pendiente' y le llega al equipo.
fabricantesRouter.post('/fabricantes/solicitud', contactoLimiter, express.json({ limit: JSON_BODY_LIMIT }), async (req, res) => {
  const p = solicitudSchema.safeParse(req.body);
  if (!p.success) {
    logSecurityEvent('invalid_input', req, { form: 'fabricante_solicitud' });
    return res.status(400).json({ error: 'datos_invalidos', message: 'Revisa los datos: empresa, nombre, correo y qué fabrican.' });
  }
  const admin = getSupabaseAdmin();
  if (!admin) return res.status(503).json({ error: 'sin_base', message: 'Las solicitudes todavía no están disponibles.' });
  const s = p.data;
  const { error } = await admin.from('manufacturers').insert({
    nombre: s.empresa,
    descripcion: s.que_fabrica,
    pais: s.pais,
    ciudad: s.ciudad || null,
    contacto_nombre: s.contacto_nombre,
    contacto_email: s.correo,
    contacto_whatsapp: s.telefono || null,
    estado: 'pendiente',
    activo: false,
  });
  if (error) {
    console.error('[fabricantes] no se guardó la solicitud:', error.message);
    return res.status(500).json({ error: 'base', message: 'No pudimos guardar tu solicitud. Intenta de nuevo.' });
  }
  const equipo = teamAddress();
  if (equipo) {
    const text = `${s.empresa} quiere aparecer como fabricante.\n\nContacto: ${s.contacto_nombre} · ${s.correo} · ${s.telefono || '—'}\nUbicación: ${s.ciudad || '—'}, ${s.pais}\nQué fabrican: ${s.que_fabrica}\n\nRevísala en /admin/fabricantes.`;
    void sendEmail({
      to: equipo,
      subject: `[Fabricantes] Solicitud de ${s.empresa}`,
      text,
      html: `<pre style="font-family:inherit;white-space:pre-wrap">${escapeHtml(text)}</pre>`,
      replyTo: s.correo,
    });
  }
  res.json({ ok: true });
});

// ---------------------------------------------------------------------
// Administración (sólo cuentas maestras)
// ---------------------------------------------------------------------

const soloMaestras: express.RequestHandler = (req, res, next) => {
  if (!esCuentaMaestra(res.locals.auth?.user)) {
    logSecurityEvent('forbidden', req, { need: 'cuenta_maestra' });
    return res.status(403).json({ error: 'solo_maestras', message: 'Esto sólo lo pueden hacer las cuentas maestras.' });
  }
  next();
};

const conAdmin = (res: express.Response): SupabaseClient | null => {
  const admin = getSupabaseAdmin();
  if (!admin) res.status(503).json({ error: 'sin_base', message: 'Falta SUPABASE_SERVICE_ROLE_KEY en el servidor.' });
  return admin;
};

const conDetalle = (mensaje: string, error: { message?: string; code?: string } | null | undefined) =>
  error?.message ? `${mensaje} Detalle: ${error.message}${error.code ? ` (${error.code})` : ''}` : mensaje;

const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null));

export const fabricanteSchema = z.object({
  nombre: z.string().trim().min(2).max(120),
  descripcion: textoOpcional(600),
  pais: z.string().trim().regex(/^[A-Z]{2}$/).default('CO'),
  ciudad: textoOpcional(80),
  // Capítulos o partidas: sólo los dígitos ('33', '3304', '610910').
  categorias: z
    .array(z.string().trim())
    .max(40)
    .default([])
    .transform((xs) => Array.from(new Set(xs.map((x) => x.replace(/\D/g, '')).filter((x) => x.length >= 2 && x.length <= 10)))),
  palabras: z
    .array(z.string().trim().max(60))
    .max(40)
    .default([])
    .transform((xs) => Array.from(new Set(xs.map((x) => x.toLowerCase()).filter(Boolean)))),
  pedido_minimo: textoOpcional(120),
  certificaciones: textoOpcional(300),
  contacto_nombre: textoOpcional(120),
  contacto_email: z
    .string()
    .trim()
    .max(200)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || z.string().email().safeParse(v).success, 'correo inválido'),
  contacto_whatsapp: textoOpcional(40),
  acceso_email: z
    .string()
    .trim()
    .max(200)
    .nullable()
    .optional()
    .transform((v) => (v ? v.toLowerCase() : null))
    .refine((v) => v === null || z.string().email().safeParse(v).success, 'correo de acceso inválido'),
  sitio_web: z
    .string()
    .trim()
    .max(300)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null))
    .refine((v) => v === null || /^https?:\/\/\S+$/i.test(v), 'el sitio web tiene que empezar con https://'),
  estado: z.enum(['pendiente', 'aprobado']).default('aprobado'),
  activo: z.boolean().default(true),
  pauta_hasta: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  prioridad: z.number().int().min(0).max(100).default(0),
  plan: textoOpcional(60),
  precio_mensual_usd: z.number().min(0).max(1_000_000).nullable().optional().transform((v) => v ?? null),
  notas: textoOpcional(1000),
});

const esId = (v: string) => z.string().uuid().safeParse(v).success;

fabricantesRouter.get('/fabricantes/admin', adminLimiter, requireUser(), soloMaestras, async (_req, res) => {
  const admin = conAdmin(res);
  if (!admin) return;
  const { data: filas, error } = await admin.from('manufacturers').select(COLUMNAS).order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: 'base', message: conDetalle('No se pudo leer la tabla de fabricantes.', error) });

  const hace30 = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const [{ data: recientes }, { data: contactos }] = await Promise.all([
    admin.from('manufacturer_events').select('manufacturer_id, tipo, created_at').gte('created_at', hace30).limit(50000),
    admin
      .from('manufacturer_events')
      .select('id, manufacturer_id, tipo, lugar, contexto, nombre, correo, telefono, mensaje, created_at')
      .eq('tipo', 'contacto')
      .order('created_at', { ascending: false })
      .limit(1000),
  ]);

  const ahora = new Date();
  const hoy = hoyColombia(ahora);
  const lista = (filas ?? []).map((r) => {
    const f = aFila(r as Record<string, unknown>);
    const suyos = (contactos ?? []).filter((c) => c.manufacturer_id === f.id);
    // Las impresiones de 30 días salen de 'recientes'; los contactos de
    // siempre, de la lista completa.
    const eventos = [
      ...(recientes ?? []).filter((e) => e.manufacturer_id === f.id && e.tipo === 'impresion'),
      ...suyos,
    ] as Array<{ tipo: string; created_at: string }>;
    return { ...f, vigente: pautaVigente(f, hoy), metricas: metricas(eventos, ahora), contactos: suyos.slice(0, 20) };
  });
  res.setHeader('Cache-Control', 'no-store');
  res.json({ fabricantes: lista, hoy });
});

fabricantesRouter.post('/fabricantes/admin', adminLimiter, requireUser(), soloMaestras, express.json({ limit: JSON_BODY_LIMIT }), async (req, res) => {
  const p = fabricanteSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'datos_invalidos', message: p.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' · ') });
  const admin = conAdmin(res);
  if (!admin) return;
  const { data, error } = await admin.from('manufacturers').insert(p.data).select('id').single();
  if (error) return res.status(500).json({ error: 'base', message: conDetalle('No se pudo crear el fabricante.', error) });
  res.json({ id: data.id });
});

// La API sólo acepta GET, POST y DELETE (security.ts): editar es un POST.
fabricantesRouter.post('/fabricantes/admin/:id', adminLimiter, requireUser(), soloMaestras, express.json({ limit: JSON_BODY_LIMIT }), async (req, res) => {
  const id = String(req.params.id);
  const p = fabricanteSchema.safeParse(req.body);
  if (!esId(id) || !p.success) {
    return res.status(400).json({ error: 'datos_invalidos', message: p.success ? 'Id inválido.' : p.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(' · ') });
  }
  const admin = conAdmin(res);
  if (!admin) return;
  const { error } = await admin.from('manufacturers').update(p.data).eq('id', id);
  if (error) return res.status(500).json({ error: 'base', message: conDetalle('No se pudo guardar.', error) });
  res.json({ ok: true });
});

fabricantesRouter.delete('/fabricantes/admin/:id', adminLimiter, requireUser(), soloMaestras, async (req, res) => {
  const id = String(req.params.id);
  if (!esId(id)) return res.status(400).json({ error: 'id_invalido' });
  const admin = conAdmin(res);
  if (!admin) return;
  const { error } = await admin.from('manufacturers').delete().eq('id', id);
  if (error) return res.status(500).json({ error: 'base', message: conDetalle('No se pudo borrar.', error) });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------
// El portal del fabricante (/fabricante)
//
// Entra con una cuenta normal de Easycomex cuyo correo confirmado sea el
// de acceso que le puso el equipo (o el de contacto). Ve su pauta, sus
// métricas, sus contactos y sus pagos, y paga la pauta en línea.
// ---------------------------------------------------------------------

const portalLimiter = makeLimiter('fabricantes_portal', 120);

/** Los fabricantes de quien llama (casi siempre uno). La tabla es chica: se filtra acá. */
async function suyos(admin: SupabaseClient, user: Parameters<typeof esSuyo>[1]): Promise<FabricanteFila[]> {
  if (!user?.email || !user.email_confirmed_at) return [];
  const { data, error } = await admin.from('manufacturers').select(COLUMNAS);
  if (error) {
    console.error('[fabricantes] portal: lectura falló:', error.message);
    return [];
  }
  return (data ?? []).map((r) => aFila(r as Record<string, unknown>)).filter((f) => esSuyo(f, user));
}

fabricantesRouter.get('/fabricantes/portal/acceso', portalLimiter, requireUser(), async (_req, res) => {
  const admin = getSupabaseAdmin();
  res.setHeader('Cache-Control', 'no-store');
  if (!admin) return res.json({ fabricante: false });
  res.json({ fabricante: (await suyos(admin, res.locals.auth!.user)).length > 0 });
});

fabricantesRouter.get('/fabricantes/portal', portalLimiter, requireUser(), async (_req, res) => {
  const admin = conAdmin(res);
  if (!admin) return;
  const user = res.locals.auth!.user;
  if (!user.email_confirmed_at) {
    return res.status(403).json({ error: 'correo_sin_confirmar', message: 'Confirma tu correo (te llegó un enlace) para entrar a tu portal de fabricante.' });
  }
  const lista = await suyos(admin, user);
  if (!lista.length) return res.status(404).json({ error: 'no_es_fabricante', message: 'Tu correo no está registrado como fabricante.' });

  const ahora = new Date();
  const hoy = hoyColombia(ahora);
  const hace30 = new Date(ahora.getTime() - 31 * 24 * 3600 * 1000).toISOString();
  const pagoEnLinea = wompiConfigured();

  const fabricantes = await Promise.all(
    lista.map(async (f) => {
      const [{ data: eventos }, { data: contactos }, { data: pagos }] = await Promise.all([
        admin.from('manufacturer_events').select('tipo, lugar, contexto, created_at').eq('manufacturer_id', f.id).gte('created_at', hace30).limit(50000),
        admin
          .from('manufacturer_events')
          .select('id, lugar, contexto, nombre, correo, telefono, mensaje, created_at')
          .eq('manufacturer_id', f.id)
          .eq('tipo', 'contacto')
          .order('created_at', { ascending: false })
          .limit(200),
        admin
          .from('manufacturer_payments')
          .select('meses, aplicado, pauta_hasta_nueva, created_at, payments(status, amount_cents, currency)')
          .eq('manufacturer_id', f.id)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);
      const ev = (eventos ?? []) as Evento[];
      const todosContactos = (contactos ?? []) as Array<{ created_at: string }>;
      return {
        perfil: {
          ...publico(f),
          estado: f.estado,
          activo: f.activo,
          pauta_hasta: f.pauta_hasta,
          vigente: pautaVigente(f, hoy),
          plan: f.plan,
          precio_mensual_usd: f.precio_mensual_usd,
        },
        metricas: metricas([...ev.filter((e) => e.tipo === 'impresion'), ...todosContactos.map((c) => ({ tipo: 'contacto', created_at: c.created_at }))], ahora),
        serie: serieDiaria(ev, hoy, 30),
        lugares: porLugar(ev),
        busquedas: topBusquedas(ev, 8),
        contactos: contactos ?? [],
        pagos: (pagos ?? []).map((p) => {
          const pago = (Array.isArray(p.payments) ? p.payments[0] : p.payments) as { status?: string; amount_cents?: number; currency?: string } | null;
          return {
            meses: p.meses,
            aplicado: p.aplicado,
            pauta_hasta_nueva: p.pauta_hasta_nueva,
            created_at: p.created_at,
            estado: pago?.status ?? 'pending',
            monto: pago?.amount_cents ? copDisplay(pago.amount_cents) : null,
          };
        }),
        precios: MESES_PAUTA.map((meses) => {
          const pr = precioPauta(f.precio_mensual_usd, meses);
          return { meses, usd: pr ? pr.usdCents / 100 : null, cop: pr ? copDisplay(pr.amountInCents) : null };
        }),
        pagoEnLinea: pagoEnLinea && f.precio_mensual_usd !== null && f.precio_mensual_usd > 0,
      };
    })
  );
  res.setHeader('Cache-Control', 'no-store');
  res.json({ fabricantes, hoy });
});

const pagarSchema = z.object({
  meses: z.number().int().refine((m) => (MESES_PAUTA as readonly number[]).includes(m), 'meses inválidos'),
  platform: z.enum(['web', 'native']).default('web'),
});

fabricantesRouter.post('/fabricantes/portal/:id/pagar', contactoLimiter, requireUser(), express.json({ limit: JSON_BODY_LIMIT }), async (req, res) => {
  const id = String(req.params.id);
  const p = pagarSchema.safeParse(req.body);
  if (!esId(id) || !p.success) return res.status(400).json({ error: 'datos_invalidos', message: 'Elige por cuántos meses quieres pagar.' });
  const admin = conAdmin(res);
  if (!admin) return;
  const user = res.locals.auth!.user;

  const f = (await suyos(admin, user)).find((x) => x.id === id);
  if (!f) {
    logSecurityEvent('forbidden', req, { route: 'fabricantes.pagar' });
    return res.status(404).json({ error: 'no_es_fabricante', message: 'Ese fabricante no está a tu nombre.' });
  }
  const precio = precioPauta(f.precio_mensual_usd, p.data.meses);
  if (!precio) return res.status(409).json({ error: 'sin_precio', message: 'Tu plan todavía no tiene precio. Escríbenos y lo activamos.' });
  if (!wompiConfigured()) return res.status(503).json({ error: 'sin_pasarela', message: 'El pago en línea no está disponible ahora. Escríbenos y te mandamos el enlace de pago.' });

  const ref = newRef();
  const { data: orden, error } = await admin
    .from('payments')
    .insert({
      stripe_session_id: orderId(ref),
      user_id: user.id,
      email: user.email ?? null,
      plan: PLAN_PAUTA,
      amount_cents: precio.amountInCents,
      currency: precio.currency,
      status: 'pending',
    })
    .select('id')
    .single();
  if (error || !orden) {
    console.error('[fabricantes] no se pudo crear la orden de pauta:', error?.message);
    return res.status(500).json({ error: 'orden_fallida', message: 'No pudimos crear el pago. Intenta de nuevo.' });
  }
  const { error: errLigar } = await admin.from('manufacturer_payments').insert({ payment_id: orden.id, manufacturer_id: f.id, meses: p.data.meses });
  if (errLigar) {
    // Sin esta fila el pago no sabría qué pauta extender: mejor no cobrar.
    await admin.from('payments').delete().eq('id', orden.id).eq('status', 'pending');
    console.error('[fabricantes] no se pudo ligar la orden de pauta:', errLigar.message);
    return res.status(500).json({ error: 'orden_fallida', message: conDetalle('No pudimos crear el pago.', esCuentaMaestra(user) ? errLigar : null) });
  }

  const appUrl = process.env.PUBLIC_APP_URL || `${req.protocol}://${req.get('host')}`;
  const url = checkoutUrl({
    publicKey: process.env.WOMPI_PUBLIC_KEY!,
    reference: ref,
    amountInCents: precio.amountInCents,
    currency: precio.currency,
    signature: integritySignature(ref, precio.amountInCents, precio.currency, process.env.WOMPI_INTEGRITY_SECRET!),
    redirectUrl: `${appUrl}/pago/exito${p.data.platform === 'native' ? '?native=1' : ''}`,
    email: user.email ?? null,
  });
  res.json({ url, gateway: 'wompi', reference: ref });
});
