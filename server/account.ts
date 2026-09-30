import express from 'express';
import { z } from 'zod';
import { formRateLimiter, JSON_BODY_LIMIT } from './security';
import { getSupabaseAdmin, getUserFromRequest } from './supabaseAdmin';
import { logSecurityEvent } from './log';
import { captureException } from './monitoring';

// Borrar la cuenta.
//
// Esto existe porque la política de privacidad dice, palabra por
// palabra, "puedes eliminar tu cuenta desde el dashboard" — y durante un
// tiempo eso no fue cierto. Una política que promete algo que la app no
// hace no es un detalle de redacción: en Colombia el habeas data (Ley
// 1581 de 2012) hace del borrado un derecho, y aparte de eso, decir algo
// falso sobre los datos de alguien no se arregla con letra pequeña.
//
// Qué se borra y qué no:
//
//   - La cuenta en Supabase Auth. Las filas personales —perfil, compras,
//     suscripciones push, factores MFA— se van con ella en cascada.
//   - Los registros del negocio (leads, cotizaciones, diagnósticos) NO se
//     borran: se quedan sin dueño (`user_id` a null). Son asientos
//     contables y comerciales de Easycomex, no sólo datos personales, y
//     borrar una venta porque el comprador cerró su cuenta rompería la
//     contabilidad. El vínculo con la persona sí desaparece.
//
// Se pide escribir BORRAR para confirmar: un clic accidental en el móvil
// no puede costar una cuenta.

export const accountRouter = express.Router();

const confirmSchema = z.object({ confirm: z.string() });

accountRouter.delete('/account', formRateLimiter, express.json({ limit: JSON_BODY_LIMIT }), async (req, res) => {
  const user = await getUserFromRequest(req);
  if (!user) {
    logSecurityEvent('unauthenticated', req, { route: 'account.delete' });
    return res.status(401).json({ error: 'Inicia sesión primero.' });
  }

  const parsed = confirmSchema.safeParse(req.body);
  if (!parsed.success || parsed.data.confirm.trim().toUpperCase() !== 'BORRAR') {
    return res.status(400).json({ error: 'Escribe BORRAR para confirmar.' });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return res.status(503).json({ error: 'No configurado (falta SUPABASE_SERVICE_ROLE_KEY).' });

  try {
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) {
      captureException(error, { route: 'account.delete' });
      return res.status(500).json({ error: 'No pudimos borrar la cuenta. Escríbenos a info@easycomex.com.' });
    }
  } catch (err) {
    captureException(err, { route: 'account.delete' });
    return res.status(500).json({ error: 'No pudimos borrar la cuenta. Escríbenos a info@easycomex.com.' });
  }

  // Queda registrado que se borró una cuenta, sin guardar de quién: el
  // punto de borrarla es no conservar a la persona.
  logSecurityEvent('account_deleted', req, {});
  return res.json({ ok: true });
});
