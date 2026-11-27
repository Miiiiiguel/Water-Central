import express from 'express';
import { z } from 'zod';
import { makeLimiter } from '../security';
import { getProfileFromRequest } from '../supabaseAdmin';
import { destino, NOMBRE_DE_FUENTE } from '../../client/src/lib/destinos';
import { arancelDe, FalloArancelDestino, lineasDe, type Servicio } from './tradeTariff';
import { ARANCEL_DE, ARANCEL_UE, arancelLocal, lineasLocales, resumenAranceles } from '../aranceles/store';
import { UNION_EUROPEA } from '../../client/src/lib/paises';

// El arancel de los países de destino que no son EE. UU. (el de EE. UU.
// sale del HTS cargado, en /api/hts). Público, como la calculadora, con
// su propio límite; las respuestas del arancel oficial se guardan 12 horas.
//
// México y Latinoamérica salen del arancel oficial descargado de cada
// aduana (server/aranceles). La UE se consulta en vivo (trae la tarifa
// preferencial según el origen) y, si no responde, sale del arancel común
// descargado, con la tarifa general.

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

const UE = new Set(UNION_EUROPEA);
/** El arancel descargado que sirve para ese destino, si hay. */
const localDe = (iso: string): string | null => ARANCEL_DE[iso] ?? (UE.has(iso) ? ARANCEL_UE : null);

destinosRouter.get('/destinos/:iso/lineas', limite, async (req, res) => {
  const iso = String(req.params.iso);
  const servicio = servicioDe(iso);
  const local = localDe(iso);
  const p = z.object({ hs6: z.string().regex(/^\d{6}$/) }).safeParse(req.query);
  if ((!servicio && !local) || !p.success) return res.status(400).json({ causa: 'pedido_invalido', mensaje: 'Destino o subpartida inválidos.' });
  if (!servicio && local) {
    const lineas = lineasLocales(local, p.data.hs6);
    if (!lineas) return res.status(503).json({ causa: 'no_disponible', mensaje: 'El arancel de este destino no está cargado.' });
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.json({ lineas });
  }
  try {
    const lineas = await lineasDe(servicio!, p.data.hs6);
    res.setHeader('Cache-Control', 'public, max-age=600');
    res.json({ lineas });
  } catch (err) {
    // La UE en vivo no respondió: el arancel común descargado.
    const lineas = local && !(err instanceof FalloArancelDestino && err.causa === 'no_existe') ? lineasLocales(local, p.data.hs6) : null;
    if (lineas && lineas.length) return res.json({ lineas });
    responderFallo(res, err, 'lineas');
  }
});

destinosRouter.get('/destinos/:iso/linea/:codigo', limite, async (req, res) => {
  const iso = String(req.params.iso);
  const servicio = servicioDe(iso);
  const local = localDe(iso);
  const codigo = String(req.params.codigo || '');
  const p = z.object({ origen: z.string().regex(/^[A-Z]{2}$/) }).safeParse(req.query);
  if ((!servicio && !local) || !/^\d{8,10}$/.test(codigo) || !p.success) {
    return res.status(400).json({ causa: 'pedido_invalido', mensaje: 'Destino, código u origen inválidos.' });
  }
  if (!servicio && local) {
    const a = arancelLocal(local, codigo);
    if (!a) return res.status(404).json({ causa: 'no_existe', mensaje: 'Esa línea no está en el arancel del destino.' });
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.json(a);
  }
  try {
    const a = await arancelDe(servicio!, codigo, p.data.origen);
    res.setHeader('Cache-Control', 'public, max-age=600');
    res.json({ ...a, fuente: NOMBRE_DE_FUENTE[servicio!], vivo: true });
  } catch (err) {
    const a = local ? arancelLocal(local, codigo) : null;
    if (a) return res.json({ ...a, avisos: ['La consulta en vivo no respondió: es la tarifa general del arancel común descargado, sin la preferencial de tu origen.', ...a.avisos] });
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
  res.json({ ...resultado, descargados: resumenAranceles() });
});
