import express from 'express';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { apiRateLimiter, makeLimiter, JSON_BODY_LIMIT } from '../security';
import { requireUser } from '../auth';
import { getAnonClient, getSupabaseAdmin } from '../supabaseAdmin';
import { logSecurityEvent } from '../log';
import { esCuentaMaestra } from '../maestros';
import { formaValida, generarSerial, hashSerial, pistaSerial } from './serial';

// Revendedores: entran con su número de serie, ven el portafolio de
// planes y su billetera (lo que Easycomex les debe por comisiones), y
// consultan con los tokens que se les regalaron.
//
// Cómo funciona la entrada con serial sin inventar un sistema de sesiones
// paralelo: cada revendedor es una cuenta normal de Supabase con un
// correo interno que nadie usa. Cuando el serial es correcto, el servidor
// le pide a Supabase un enlace de acceso para esa cuenta (sin mandar
// correo) y lo canjea ahí mismo por una sesión, que vuelve al navegador.
// De ahí en adelante es una sesión como cualquier otra: Marco Polo, los
// tokens y el panel funcionan sin cambios.
//
// Lo administran sólo las cuentas maestras (maestros.ts).

export interface Movimiento {
  id: string;
  tipo: 'comision' | 'pago';
  monto_usd: number;
  cliente: string | null;
  nota: string | null;
  fecha: string;
  created_at: string;
}

export interface Billetera {
  /** Lo que se le debe hoy: comisiones − pagos. */
  saldo: number;
  comisiones: number;
  pagado: number;
  /** Clientes distintos con comisión cargada. */
  clientes: number;
}

const centavos = (n: number) => Math.round(n * 100);

export function billeteraDe(movimientos: Array<Pick<Movimiento, 'tipo' | 'monto_usd' | 'cliente'>>): Billetera {
  let comisiones = 0;
  let pagado = 0;
  const clientes = new Set<string>();
  for (const m of movimientos) {
    const c = centavos(Number(m.monto_usd) || 0);
    if (m.tipo === 'comision') {
      comisiones += c;
      if (m.cliente?.trim()) clientes.add(m.cliente.trim().toLowerCase());
    } else pagado += c;
  }
  return { saldo: (comisiones - pagado) / 100, comisiones: comisiones / 100, pagado: pagado / 100, clientes: clientes.size };
}

export type Entrada =
  | { ok: true; session: { access_token: string; refresh_token: string; expires_at: number | null } }
  | { ok: false; motivo: 'serial_invalido' | 'inactivo' | 'sin_base' | 'error' };

/** Del serial a una sesión de Supabase. */
export async function entrarConSerial(serial: string, admin: SupabaseClient | null, anon: SupabaseClient | null): Promise<Entrada> {
  if (!admin || !anon) return { ok: false, motivo: 'sin_base' };
  if (!formaValida(serial)) return { ok: false, motivo: 'serial_invalido' };

  const { data: fila, error } = await admin
    .from('resellers')
    .select('id, user_id, activo')
    .eq('serial_hash', hashSerial(serial))
    .maybeSingle();
  if (error) {
    console.error('resellers lookup failed:', error.message);
    return { ok: false, motivo: 'error' };
  }
  if (!fila) return { ok: false, motivo: 'serial_invalido' };
  if (!fila.activo) return { ok: false, motivo: 'inactivo' };

  const { data: usuario, error: errUsuario } = await admin.auth.admin.getUserById(fila.user_id as string);
  const email = usuario?.user?.email;
  if (errUsuario || !email) {
    console.error('reseller auth user missing:', errUsuario?.message ?? 'sin correo');
    return { ok: false, motivo: 'error' };
  }

  const { data: enlace, error: errEnlace } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  const tokenHash = enlace?.properties?.hashed_token;
  if (errEnlace || !tokenHash) {
    console.error('reseller generateLink failed:', errEnlace?.message ?? 'sin token');
    return { ok: false, motivo: 'error' };
  }

  const { data: canje, error: errCanje } = await anon.auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' });
  const s = canje?.session;
  if (errCanje || !s) {
    console.error('reseller verifyOtp failed:', errCanje?.message ?? 'sin sesión');
    return { ok: false, motivo: 'error' };
  }
  return { ok: true, session: { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at ?? null } };
}

/**
 * Correo interno de la cuenta: no recibe nada (se crea confirmado y el
 * enlace de acceso no se envía), sólo identifica. Va con el dominio real
 * de la empresa porque Supabase puede rechazar un dominio sin correo
 * configurado (como un subdominio inventado).
 */
function correoInterno(): string {
  return `revendedor.${randomBytes(6).toString('hex')}@easycomex.com`;
}

/**
 * El panel de administración lo usan sólo las cuentas maestras, así que
 * a ellas sí se les dice qué contestó Supabase: sin eso, "no se pudo"
 * no se puede arreglar.
 */
const conDetalle = (mensaje: string, error: { message?: string; code?: string } | null | undefined) =>
  error?.message ? `${mensaje} Detalle: ${error.message}${error.code ? ` (${error.code})` : ''}` : mensaje;

export const revendedoresRouter = express.Router();

// Pocos intentos por IP: el serial no se adivina, pero tampoco se deja
// probar en lote.
const entradaLimiter = makeLimiter('revendedor_entrada', 10);
const adminLimiter = makeLimiter('revendedores_admin', 120);

const MENSAJE_ENTRADA: Record<Exclude<Entrada, { ok: true }>['motivo'], { status: number; message: string }> = {
  serial_invalido: { status: 401, message: 'Ese número de serie no es válido. Revísalo, o escríbenos si lo perdiste.' },
  inactivo: { status: 403, message: 'Tu acceso de revendedor está pausado. Escríbenos para reactivarlo.' },
  sin_base: { status: 503, message: 'El acceso de revendedores todavía no está configurado en el servidor.' },
  error: { status: 500, message: 'No pudimos abrir tu sesión. Intenta de nuevo en un momento.' },
};

revendedoresRouter.post('/revendedores/entrar', entradaLimiter, express.json({ limit: JSON_BODY_LIMIT }), async (req, res) => {
  const parsed = z.object({ serial: z.string().trim().min(4).max(64) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'serial_invalido', message: MENSAJE_ENTRADA.serial_invalido.message });
  const r = await entrarConSerial(parsed.data.serial, getSupabaseAdmin(), getAnonClient());
  if (!r.ok) {
    if (r.motivo === 'serial_invalido' || r.motivo === 'inactivo') logSecurityEvent('unauthenticated', req, { reason: `revendedor_${r.motivo}` });
    const m = MENSAJE_ENTRADA[r.motivo];
    return res.status(m.status).json({ error: r.motivo, message: m.message });
  }
  res.setHeader('Cache-Control', 'no-store');
  res.json({ session: r.session });
});

// Qué es la cuenta que llama: para mostrar el enlace al portal o al
// panel de administración donde corresponde.
revendedoresRouter.get('/revendedores/acceso', apiRateLimiter, requireUser(), async (_req, res) => {
  const auth = res.locals.auth!;
  const admin = getSupabaseAdmin();
  let revendedor = false;
  if (admin) {
    const { data } = await admin.from('resellers').select('id').eq('user_id', auth.user.id).maybeSingle();
    revendedor = Boolean(data);
  }
  res.json({ maestra: esCuentaMaestra(auth.user), revendedor });
});

// El portal del revendedor: sus datos, su billetera y sus tokens.
revendedoresRouter.get('/revendedores/yo', apiRateLimiter, requireUser(), async (_req, res) => {
  const auth = res.locals.auth!;
  const admin = getSupabaseAdmin();
  if (!admin) return res.status(503).json({ error: 'sin_base' });

  const { data: fila } = await admin
    .from('resellers')
    .select('id, nombre, empresa, activo, tokens_regalados, created_at')
    .eq('user_id', auth.user.id)
    .maybeSingle();
  if (!fila) return res.status(404).json({ error: 'no_es_revendedor' });

  const [{ data: movs }, { data: creditos }, { data: perfil }] = await Promise.all([
    admin
      .from('reseller_movements')
      .select('id, tipo, monto_usd, cliente, nota, fecha, created_at')
      .eq('reseller_id', fila.id)
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false }),
    admin.from('research_credits').select('credits').eq('user_id', auth.user.id).maybeSingle(),
    admin.from('profiles').select('referral_code').eq('id', auth.user.id).maybeSingle(),
  ]);
  const { count: referidos } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('referred_by', auth.user.id);

  const movimientos = (movs ?? []).map((m) => ({ ...m, monto_usd: Number(m.monto_usd) })) as Movimiento[];
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    revendedor: { nombre: fila.nombre, empresa: fila.empresa, activo: fila.activo, desde: fila.created_at },
    billetera: billeteraDe(movimientos),
    movimientos,
    tokens: (creditos?.credits as number | undefined) ?? 0,
    referido: { codigo: (perfil?.referral_code as string | undefined) ?? null, clientes: referidos ?? 0 },
  });
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

const esId = (v: string) => z.string().uuid().safeParse(v).success;

revendedoresRouter.get('/revendedores/admin', adminLimiter, requireUser(), soloMaestras, async (_req, res) => {
  const admin = conAdmin(res);
  if (!admin) return;
  const { data: filas, error } = await admin
    .from('resellers')
    .select('id, user_id, nombre, empresa, contacto, serial_pista, activo, tokens_regalados, created_at')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: 'base', message: conDetalle('No se pudo leer la tabla de revendedores.', error) });

  const ids = (filas ?? []).map((f) => f.id as string);
  const usuarios = (filas ?? []).map((f) => f.user_id as string);
  const [{ data: movs }, { data: creditos }] = await Promise.all([
    ids.length
      ? admin.from('reseller_movements').select('id, reseller_id, tipo, monto_usd, cliente, nota, fecha, created_at').in('reseller_id', ids).order('fecha', { ascending: false })
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    usuarios.length ? admin.from('research_credits').select('user_id, credits').in('user_id', usuarios) : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
  ]);

  const revendedores = (filas ?? []).map((f) => {
    const suyos = (movs ?? []).filter((m) => m.reseller_id === f.id).map((m) => ({ ...m, monto_usd: Number(m.monto_usd) })) as unknown as Movimiento[];
    const tokens = ((creditos ?? []).find((c) => c.user_id === f.user_id)?.credits as number | undefined) ?? 0;
    const { user_id: _u, ...publico } = f;
    return { ...publico, tokens, billetera: billeteraDe(suyos), movimientos: suyos };
  });
  res.setHeader('Cache-Control', 'no-store');
  res.json({ revendedores });
});

const crearSchema = z.object({
  nombre: z.string().trim().min(2).max(120),
  empresa: z.string().trim().max(120).optional().default(''),
  contacto: z.string().trim().max(160).optional().default(''),
  tokens: z.number().int().min(0).max(100000).default(0),
});

revendedoresRouter.post('/revendedores/admin', adminLimiter, requireUser(), soloMaestras, express.json({ limit: JSON_BODY_LIMIT }), async (req, res) => {
  const parsed = crearSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'datos_invalidos', message: 'Revisa el nombre y la cantidad de tokens.' });
  const admin = conAdmin(res);
  if (!admin) return;
  const { nombre, empresa, contacto, tokens } = parsed.data;

  const { data: creado, error: errCrear } = await admin.auth.admin.createUser({
    email: correoInterno(),
    email_confirm: true,
    user_metadata: { full_name: nombre, company: empresa || undefined, revendedor: true },
  });
  if (errCrear || !creado?.user) {
    console.error('reseller createUser failed:', errCrear?.message);
    return res.status(500).json({ error: 'crear_cuenta', message: conDetalle('No se pudo crear la cuenta del revendedor.', errCrear) });
  }
  const userId = creado.user.id;

  // El perfil lo crea el disparador de registro; por si no corrió, se
  // asegura acá (la fila de revendedor depende de él).
  await admin.from('profiles').upsert({ id: userId, email: creado.user.email!, full_name: nombre, company: empresa || null }, { onConflict: 'id' });

  const serial = generarSerial();
  const { data: fila, error: errFila } = await admin
    .from('resellers')
    .insert({
      user_id: userId,
      nombre,
      empresa: empresa || null,
      contacto: contacto || null,
      serial_hash: hashSerial(serial),
      serial_pista: pistaSerial(serial),
      tokens_regalados: tokens,
    })
    .select('id')
    .single();
  if (errFila || !fila) {
    console.error('reseller insert failed:', errFila?.message);
    await admin.auth.admin.deleteUser(userId);
    return res.status(500).json({ error: 'crear_revendedor', message: conDetalle('No se pudo guardar el revendedor.', errFila) });
  }
  if (tokens > 0) await admin.rpc('grant_research_credits', { p_user_id: userId, p_credits: tokens });

  // El serial completo sale UNA vez, en esta respuesta. Después sólo
  // queda su hash y los últimos 4.
  res.setHeader('Cache-Control', 'no-store');
  res.status(201).json({ id: fila.id, serial });
});

const movimientoSchema = z.object({
  tipo: z.enum(['comision', 'pago']),
  monto: z.number().positive().max(10_000_000),
  cliente: z.string().trim().max(160).optional().default(''),
  nota: z.string().trim().max(300).optional().default(''),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

revendedoresRouter.post('/revendedores/admin/:id/movimientos', adminLimiter, requireUser(), soloMaestras, express.json({ limit: JSON_BODY_LIMIT }), async (req, res) => {
  const parsed = movimientoSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'datos_invalidos', message: 'Revisa el monto y la fecha.' });
  if (!esId(req.params.id)) return res.status(404).json({ error: 'no_existe' });
  const admin = conAdmin(res);
  if (!admin) return;
  const { tipo, monto, cliente, nota, fecha } = parsed.data;
  const { error } = await admin.from('reseller_movements').insert({
    reseller_id: req.params.id,
    tipo,
    monto_usd: Math.round(monto * 100) / 100,
    cliente: cliente || null,
    nota: nota || null,
    ...(fecha ? { fecha } : {}),
    creado_por: res.locals.auth!.user.email ?? null,
  });
  if (error) {
    console.error('reseller movement insert failed:', error.message);
    return res.status(500).json({ error: 'base', message: conDetalle('No se pudo guardar el movimiento.', error) });
  }
  res.status(201).json({ ok: true });
});

revendedoresRouter.delete('/revendedores/admin/:id/movimientos/:mov', adminLimiter, requireUser(), soloMaestras, async (req, res) => {
  if (!esId(req.params.id) || !esId(req.params.mov)) return res.status(404).json({ error: 'no_existe' });
  const admin = conAdmin(res);
  if (!admin) return;
  const { error } = await admin.from('reseller_movements').delete().eq('id', req.params.mov).eq('reseller_id', req.params.id);
  if (error) return res.status(500).json({ error: 'base', message: conDetalle('No se pudo borrar el movimiento.', error) });
  res.json({ ok: true });
});

revendedoresRouter.post('/revendedores/admin/:id/tokens', adminLimiter, requireUser(), soloMaestras, express.json({ limit: JSON_BODY_LIMIT }), async (req, res) => {
  const parsed = z.object({ cantidad: z.number().int().min(1).max(100000) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'datos_invalidos', message: 'La cantidad tiene que ser un número entero mayor que cero.' });
  if (!esId(req.params.id)) return res.status(404).json({ error: 'no_existe' });
  const admin = conAdmin(res);
  if (!admin) return;
  const { data: fila } = await admin.from('resellers').select('user_id, tokens_regalados').eq('id', req.params.id).maybeSingle();
  if (!fila) return res.status(404).json({ error: 'no_existe' });
  const { error } = await admin.rpc('grant_research_credits', { p_user_id: fila.user_id, p_credits: parsed.data.cantidad });
  if (error) return res.status(500).json({ error: 'base', message: conDetalle('No se pudieron dar los tokens.', error) });
  await admin.from('resellers').update({ tokens_regalados: (fila.tokens_regalados as number) + parsed.data.cantidad }).eq('id', req.params.id);
  res.json({ ok: true });
});

// Un serial nuevo (el viejo deja de servir): para cuando lo pierden o
// se filtra.
revendedoresRouter.post('/revendedores/admin/:id/serial', adminLimiter, requireUser(), soloMaestras, async (req, res) => {
  if (!esId(req.params.id)) return res.status(404).json({ error: 'no_existe' });
  const admin = conAdmin(res);
  if (!admin) return;
  const serial = generarSerial();
  const { data, error } = await admin
    .from('resellers')
    .update({ serial_hash: hashSerial(serial), serial_pista: pistaSerial(serial) })
    .eq('id', req.params.id)
    .select('id');
  if (error || !data?.length) return res.status(404).json({ error: 'no_existe' });
  res.setHeader('Cache-Control', 'no-store');
  res.json({ serial });
});

revendedoresRouter.post('/revendedores/admin/:id/estado', adminLimiter, requireUser(), soloMaestras, express.json({ limit: JSON_BODY_LIMIT }), async (req, res) => {
  const parsed = z.object({ activo: z.boolean() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'datos_invalidos' });
  if (!esId(req.params.id)) return res.status(404).json({ error: 'no_existe' });
  const admin = conAdmin(res);
  if (!admin) return;
  const { data, error } = await admin.from('resellers').update({ activo: parsed.data.activo }).eq('id', req.params.id).select('user_id');
  if (error || !data?.length) return res.status(404).json({ error: 'no_existe' });
  // Pausar también bloquea la cuenta en Supabase: sin esto, la sesión que
  // ya tiene abierta se seguiría renovando sola. Con el bloqueo, a lo
  // sumo le queda la hora que dura el token en curso.
  const { error: errBloqueo } = await admin.auth.admin.updateUserById(data[0].user_id as string, {
    ban_duration: parsed.data.activo ? 'none' : '876000h',
  });
  if (errBloqueo) console.error('reseller ban update failed:', errBloqueo.message);
  res.json({ ok: true });
});
