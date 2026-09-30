import express from 'express';
import { z } from 'zod';
import { makeLimiter } from '../security';
import { arbol, buscarPartidas, capitulos, detalle } from './consulta';

// El arancel de EE. UU., consultable desde la calculadora ROI.
//
// Es público a propósito: la USITC lo publica gratis y la calculadora se
// usa sin cuenta. Tiene su propio límite, más amplio que el general de
// /api, porque la búsqueda se hace mientras la persona escribe.

export const htsRouter = express.Router();

const limite = makeLimiter('hts', 600);

const consulta = z.object({ q: z.string().trim().min(1).max(120) });
const ramas = z.object({
  capitulo: z.string().regex(/^\d{1,2}$/).optional(),
  linea: z.coerce.number().int().min(0).max(100_000).optional(),
});

function cache(res: express.Response) {
  // El arancel cambia pocas veces al año, y una respuesta vieja de
  // minutos no le hace daño a nadie.
  res.setHeader('Cache-Control', 'public, max-age=600');
}

htsRouter.get('/hts/buscar', limite, (req, res) => {
  const p = consulta.safeParse(req.query);
  if (!p.success) return res.status(400).json({ error: 'consulta_invalida' });
  cache(res);
  res.json({ resultados: buscarPartidas(p.data.q) });
});

htsRouter.get('/hts/capitulos', limite, (_req, res) => {
  cache(res);
  res.json({ capitulos: capitulos() });
});

htsRouter.get('/hts/arbol', limite, (req, res) => {
  const p = ramas.safeParse(req.query);
  if (!p.success || (p.data.capitulo === undefined && p.data.linea === undefined)) {
    return res.status(400).json({ error: 'rama_invalida' });
  }
  cache(res);
  res.json({ nodos: arbol(p.data) });
});

htsRouter.get('/hts/partida/:codigo', limite, (req, res) => {
  const codigo = String(req.params.codigo || '');
  if (!/^[\d.]{4,13}$/.test(codigo)) return res.status(400).json({ error: 'codigo_invalido' });
  const d = detalle(codigo);
  // Un código que no está en el arancel cargado no existe para la app.
  if (!d) return res.status(404).json({ error: 'no_existe', message: 'Ese código no está en el arancel de EE. UU. cargado.' });
  cache(res);
  res.json(d);
});

// La primera búsqueda arma el índice de palabras (~1 s). Se hace al
// arrancar, fuera del camino de cualquier pedido, para que la primera
// persona que escribe en la calculadora no la pague.
if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  setTimeout(() => {
    try {
      buscarPartidas('cotton');
    } catch (err) {
      console.error('[hts] no se pudo precargar el índice:', (err as Error).message);
    }
  }, 2000).unref();
}
