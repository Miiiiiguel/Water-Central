import express from 'express';
import { z } from 'zod';
import { JSON_BODY_LIMIT, makeLimiter } from '../security';
import { FalloUsps } from './cliente';
import { cotizarNacional } from './envios';

// POST /api/envios/eeuu/tarifa — el envío real dentro de EE. UU. para la
// calculadora ROI. Público, como la calculadora, pero con un límite
// corto: cada cotización nueva gasta hasta cuatro consultas de una cuota
// que es por hora (las repetidas salen de memoria y no gastan nada).

export const enviosRouter = express.Router();

const limite = makeLimiter('envios', 20);

const pedido = z.object({
  origen: z.string().trim().regex(/^\d{5}$/),
  // Hasta 70 lb y 108" de largo: el máximo que USPS acepta en un paquete.
  pesoG: z.number().positive().max(31_750),
  largoCm: z.number().positive().max(274),
  anchoCm: z.number().positive().max(274),
  altoCm: z.number().positive().max(274),
});

function estadoDe(causa: FalloUsps['causa']): number {
  if (causa === 'pedido_invalido') return 400;
  if (causa === 'demasiadas_peticiones') return 429;
  return 503;
}

enviosRouter.post('/envios/eeuu/tarifa', limite, express.json({ limit: JSON_BODY_LIMIT }), async (req, res) => {
  const p = pedido.safeParse(req.body);
  if (!p.success) {
    return res.status(400).json({ ok: false, causa: 'pedido_invalido', mensaje: 'Revisá el código postal (5 dígitos), el peso y las medidas de la caja.' });
  }
  const { origen, ...paquete } = p.data;
  try {
    const cotizacion = await cotizarNacional(paquete, origen);
    res.setHeader('Cache-Control', 'no-store');
    res.json({ ok: true, cotizacion });
  } catch (err) {
    if (!(err instanceof FalloUsps)) {
      console.error('[envios] falla inesperada', err);
      return res.status(500).json({ ok: false, causa: 'no_disponible', mensaje: 'No se pudo cotizar el envío. Probá de nuevo en unos minutos.' });
    }
    if (err.causa !== 'no_configurado') console.error(`[envios] ${err.detalle}`);
    res.status(estadoDe(err.causa)).json({ ok: false, causa: err.causa, mensaje: err.publico });
  }
});
