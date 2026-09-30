import express from 'express';
import { z } from 'zod';
import { makeLimiter } from '../security';
import { getProfileFromRequest } from '../supabaseAdmin';
import { destino, NOMBRE_DE_FUENTE } from '../../client/src/lib/destinos';
import { arancelDe, FalloArancelDestino, lineasDe, type Servicio } from './tradeTariff';

// El arancel de los países de destino que no son EE. UU. (el de EE. UU.
// sale del HTS cargado, en /api/hts). Público, como la calculadora, con
// su propio límite; las respuestas del arancel oficial se guardan 12 horas.

export const destinosRouter = express.Router();

const limite = makeLimiter('destinos', 200);

const servicioDe = (iso: string): Servicio | null => {
  const d = destino(iso);
  return d && (d.fuente === 'uk' || d.fuente === 'xi') ? d.fuente : null;
};

function responderFallo(res: express.Response, err: unknown, donde: string) {
  if (err instanceof FalloArancelDestino) {
    if (err.causa !== 'no_existe') console.error(`[destinos] ${err.detalle}`);
    return res.status(err.causa === 'no_existe' ? 404 : 503).json({ causa: err.causa, mensaje: err.publico });
  }
  console.error(`[destinos] falla inesperada en ${donde}`, err);
  return res.status(500).json({ causa: 'no_disponible', mensaje: 'No se pudo consultar el arancel del destino.' });
}

destinosRouter.get('/destinos/:iso/lineas', limite, async (req, res) => {
  const servicio = servicioDe(String(req.params.iso));
  const p = z.object({ hs6: z.string().regex(/^\d{6}$/) }).safeParse(req.query);
  if (!servicio || !p.success) return res.status(400).json({ causa: 'pedido_invalido', mensaje: 'Destino o subpartida inválidos.' });
  try {
    const lineas = await lineasDe(servicio, p.data.hs6);
    res.setHeader('Cache-Control', 'public, max-age=600');
    res.json({ lineas });
  } catch (err) {
    responderFallo(res, err, 'lineas');
  }
});

destinosRouter.get('/destinos/:iso/linea/:codigo', limite, async (req, res) => {
  const servicio = servicioDe(String(req.params.iso));
  const codigo = String(req.params.codigo || '');
  const p = z.object({ origen: z.string().regex(/^[A-Z]{2}$/) }).safeParse(req.query);
  if (!servicio || !/^\d{10}$/.test(codigo) || !p.success) {
    return res.status(400).json({ causa: 'pedido_invalido', mensaje: 'Destino, código u origen inválidos.' });
  }
  try {
    const a = await arancelDe(servicio, codigo, p.data.origen);
    res.setHeader('Cache-Control', 'public, max-age=600');
    res.json({ ...a, fuente: NOMBRE_DE_FUENTE[servicio] });
  } catch (err) {
    responderFallo(res, err, 'linea');
  }
});

// Para el equipo: una consulta real contra cada arancel, para saber desde
// el panel si la fuente responde y se lee bien.
destinosRouter.get('/destinos/diagnostico', limite, async (req, res) => {
  const ctx = await getProfileFromRequest(req);
  if (!ctx || ctx.profile.role !== 'vendedor') return res.status(403).json({ error: 'forbidden' });
  res.setHeader('Cache-Control', 'no-store');
  const resultado: Record<string, unknown> = {};
  for (const servicio of ['uk', 'xi'] as Servicio[]) {
    try {
      const lineas = await lineasDe(servicio, '610910');
      if (!lineas.length) throw new FalloArancelDestino('respuesta_rara', 'sin líneas para 610910', '');
      const a = await arancelDe(servicio, lineas[0].codigo, 'CO');
      resultado[servicio] = {
        ok: Boolean(a.general),
        lineas: lineas.length,
        codigo: a.codigo,
        general: a.general?.texto ?? null,
        preferencialCO: a.preferencial ? `${a.preferencial.tasa.texto} (${a.preferencial.acuerdo})` : null,
      };
    } catch (err) {
      resultado[servicio] = { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
  res.json(resultado);
});
