import express from 'express';
import { z } from 'zod';
import { makeLimiter } from '../security';
import { requireUser } from '../auth';
import { logSecurityEvent } from '../log';
import { EXPLICACION, proveedorActivo, queFaltaParaOcr, revisarImagen, MIMES_ACEPTADOS } from './ocr';
import { analizar } from './analisis';
import { diagnosticarIA, modeloDeOcr } from '../anthropicError';
import { configurado as partidasConectadas, FalloFedex } from '../fedex/cliente';
import { sugerirPartidas } from '../fedex/partidas';

// La mesa de análisis de producto: foto -> texto -> datos.
//
// Son dos rutas y hacen cosas muy distintas de precio. `analizar` gasta
// una llamada al proveedor de visión por cada foto, así que pide sesión
// y tiene su propio límite. `interpretar` sólo vuelve a pasar el texto
// por las funciones puras: es gratis, y es la que se usa cuando la
// persona contesta lo que faltaba.

export const etiquetaRouter = express.Router();

// Una foto por vez, y no más de veinte por cuarto de hora: cada una
// cuesta dinero de verdad.
const limiteAnalisis = makeLimiter('etiqueta', 20);
// Las partidas sugeridas salen de un servicio externo con cuota propia.
const limitePartidas = makeLimiter('partidas', 30);
/** La foto ya reducida viaja en base64, que abulta un tercio más. */
const LIMITE_CUERPO = '9mb';

// Lo que la persona ya contestó. Es un mapa abierto a propósito: las
// preguntas las declara cada familia de producto en familias.ts, y una
// lista cerrada acá obligaría a tocar la ruta cada vez que se agrega
// una familia. Lo que sí se cierra es el tamaño: claves cortas, valores
// cortos y pocas, que es lo que evita que esto sea un depósito.
const respuestas = z
  .record(z.string().max(40), z.string().max(160))
  .refine((r) => Object.keys(r).length <= 20, { message: 'demasiadas respuestas' })
  .optional();

const cuerpoAnalizar = z.object({
  imagen: z.string().min(1).max(12_000_000),
  tipoMime: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  respuestas,
});

const cuerpoInterpretar = z.object({
  texto: z.string().max(8000),
  respuestas,
});

/** ¿Se puede analizar una foto hoy? La pantalla lo pregunta antes de ofrecerlo. */
etiquetaRouter.get('/etiqueta/estado', (_req, res) => {
  const proveedor = proveedorActivo();
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    ocr: Boolean(proveedor),
    // El nombre del proveedor no sale de acá; sí lo que falta poner.
    falta: proveedor ? null : queFaltaParaOcr(),
    // El modelo configurado. No es un secreto y es la causa más común
    // de que una foto perfecta vuelva con error: un identificador que
    // esa cuenta no tiene habilitado. Verlo acá ahorra abrir los logs.
    modelo: modeloDeOcr(),
    formatos: MIMES_ACEPTADOS,
    // Si hay partidas sugeridas. Sin decir de dónde salen.
    partidas: partidasConectadas(),
  });
});

etiquetaRouter.post(
  '/etiqueta/analizar',
  limiteAnalisis,
  requireUser(),
  express.json({ limit: LIMITE_CUERPO }),
  async (req, res) => {
    const parsed = cuerpoAnalizar.safeParse(req.body);
    if (!parsed.success) {
      logSecurityEvent('invalid_input', req, { form: 'etiqueta' });
      return res.status(400).json({ error: 'imagen_invalida', message: EXPLICACION.formato });
    }

    const { imagen, tipoMime, respuestas: contestadas } = parsed.data;
    // El navegador manda "data:image/jpeg;base64,XXXX" o sólo los datos.
    const datos = imagen.includes(',') ? imagen.slice(imagen.indexOf(',') + 1) : imagen;

    const problema = revisarImagen(datos, tipoMime);
    if (problema) {
      return res.status(400).json({ error: 'imagen_invalida', message: EXPLICACION[problema] });
    }

    const proveedor = proveedorActivo();
    if (!proveedor) {
      return res.status(503).json({
        error: 'ocr_no_configurado',
        message:
          'La lectura de etiquetas todavía no está activada en el servidor. Es configuración nuestra, no tuya: avisale al equipo.',
      });
    }

    let transcripcion;
    try {
      transcripcion = await proveedor.leer(datos, tipoMime);
    } catch (err) {
      // Antes esto decía "no pudimos leer la foto" para cinco fallas
      // distintas, y cuatro de ellas no tenían NADA que ver con la
      // foto. Quien tomaba una foto perfecta volvía a intentarlo tres
      // veces antes de escribirnos. Ahora se nombra la causa.
      const fallo = diagnosticarIA(err, modeloDeOcr());
      console.error(`[etiqueta] el OCR falló: ${fallo.detalle}`);
      return res.status(502).json({
        error: 'ocr_fallo',
        causa: fallo.causa,
        nuestro: fallo.nuestro,
        message: fallo.publico,
      });
    }

    if (transcripcion.ilegible) {
      return res.json({
        ...analizar('', contestadas),
        consejo:
          'No se leyó nada en la foto. Acercá la cámara a la etiqueta, que quede plana y con buena luz, y volvé a intentar.',
      });
    }

    res.json(analizar(transcripcion.texto, contestadas));
  }
);

/**
 * Vuelve a interpretar un texto ya leído. Es la ruta de las respuestas:
 * la persona dice "es plana" y se recalcula todo sin volver a gastar
 * una foto.
 */
etiquetaRouter.post(
  '/etiqueta/interpretar',
  requireUser(),
  express.json({ limit: '32kb' }),
  (req, res) => {
    const parsed = cuerpoInterpretar.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'texto_invalido' });
    res.json(analizar(parsed.data.texto, parsed.data.respuestas));
  }
);

/**
 * Partidas sugeridas para un producto ya analizado. Sale a un servicio
 * externo, así que pide sesión, tiene su propio límite y sólo devuelve
 * códigos que existen en el arancel cargado (ver server/fedex/).
 */
etiquetaRouter.post(
  '/etiqueta/partidas',
  limitePartidas,
  requireUser(),
  express.json({ limit: '32kb' }),
  async (req, res) => {
    const parsed = cuerpoInterpretar.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'texto_invalido' });
    const { texto, respuestas: contestadas = {} } = parsed.data;

    const analisis = analizar(texto, contestadas);
    if (!analisis.familia) return res.json({ partidas: [], sugeridas: 0 });

    try {
      const r = await sugerirPartidas(analisis, contestadas);
      // Lo que el proveedor sugirió y no existe en el arancel no llega
      // a la pantalla, pero se anota: si se repite, es señal de que el
      // arancel cargado quedó viejo.
      if (r.descartadas.length) {
        console.warn(`[partidas] ${r.descartadas.length} de ${r.sugeridas} no existen en el arancel cargado: ${r.descartadas.join(', ')}`);
      }
      res.json({ partidas: r.partidas, sugeridas: r.sugeridas });
    } catch (err) {
      if (!(err instanceof FalloFedex)) {
        console.error('[partidas] falla inesperada', err);
        return res.status(502).json({ error: 'partidas_fallo', message: 'No pudimos traer las partidas sugeridas.' });
      }
      if (err.causa !== 'no_configurado') console.error(`[partidas] ${err.detalle}`);
      res.status(err.causa === 'no_configurado' ? 503 : 502).json({
        error: `partidas_${err.causa}`,
        causa: err.causa,
        nuestro: err.nuestro,
        message: err.publico,
      });
    }
  }
);
