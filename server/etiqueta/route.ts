import express from 'express';
import { z } from 'zod';
import { makeLimiter } from '../security';
import { requireUser } from '../auth';
import { logSecurityEvent } from '../log';
import { EXPLICACION, proveedorActivo, queFaltaParaOcr, revisarImagen, MIMES_ACEPTADOS } from './ocr';
import { leerEtiqueta, PREGUNTA, type Faltante } from './composicion';
import { leerPrenda, PREGUNTA_PRENDA, type FaltaPrenda, type Genero, type Tejido } from './prenda';

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
/** La foto ya reducida viaja en base64, que abulta un tercio más. */
const LIMITE_CUERPO = '9mb';

const cuerpoAnalizar = z.object({
  imagen: z.string().min(1).max(12_000_000),
  tipoMime: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  pistas: z
    .object({
      genero: z.enum(['hombre', 'mujer', 'nina_nino', 'bebe']).optional(),
      tejido: z.enum(['punto', 'plano']).optional(),
    })
    .optional(),
});

const cuerpoInterpretar = z.object({
  texto: z.string().max(8000),
  pistas: z
    .object({
      genero: z.enum(['hombre', 'mujer', 'nina_nino', 'bebe']).optional(),
      tejido: z.enum(['punto', 'plano']).optional(),
    })
    .optional(),
});

export interface Pregunta {
  campo: Faltante | FaltaPrenda;
  pregunta: string;
  /** Las respuestas posibles cuando son cerradas; libre si va vacío. */
  opciones?: { valor: string; etiqueta: string }[];
}

/** Lo que falta, convertido en preguntas concretas para la pantalla. */
export function preguntasDe(
  faltaEtiqueta: Faltante[],
  faltaPrenda: FaltaPrenda[]
): Pregunta[] {
  const preguntas: Pregunta[] = [];
  // Primero el tejido: es lo que decide el capítulo, y sin capítulo no
  // se puede ni empezar a buscar la partida.
  const orden: FaltaPrenda[] = ['tejido', 'tipo', 'genero'];
  for (const campo of orden) {
    if (!faltaPrenda.includes(campo)) continue;
    preguntas.push({
      campo,
      pregunta: PREGUNTA_PRENDA[campo],
      opciones:
        campo === 'tejido'
          ? [
              { valor: 'punto', etiqueta: 'De punto (elástica, tipo camiseta)' },
              { valor: 'plano', etiqueta: 'Plana (rígida, tipo camisa de vestir)' },
            ]
          : campo === 'genero'
            ? [
                { valor: 'hombre', etiqueta: 'Hombre' },
                { valor: 'mujer', etiqueta: 'Mujer' },
                { valor: 'nina_nino', etiqueta: 'Niño o niña' },
                { valor: 'bebe', etiqueta: 'Bebé' },
              ]
            : undefined,
    });
  }
  for (const campo of faltaEtiqueta) {
    preguntas.push({ campo, pregunta: PREGUNTA[campo] });
  }
  return preguntas;
}

function analisisDe(texto: string, pistas: { genero?: Genero; tejido?: Tejido } = {}) {
  const etiqueta = leerEtiqueta(texto);
  const prenda = leerPrenda(texto, pistas);
  return {
    texto,
    etiqueta,
    prenda,
    preguntas: preguntasDe(etiqueta.faltante, prenda.faltante),
  };
}

/** ¿Se puede analizar una foto hoy? La pantalla lo pregunta antes de ofrecerlo. */
etiquetaRouter.get('/etiqueta/estado', (_req, res) => {
  const proveedor = proveedorActivo();
  res.setHeader('Cache-Control', 'no-store');
  res.json({
    ocr: Boolean(proveedor),
    // El nombre del proveedor no sale de acá; sí lo que falta poner.
    falta: proveedor ? null : queFaltaParaOcr(),
    formatos: MIMES_ACEPTADOS,
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

    const { imagen, tipoMime, pistas } = parsed.data;
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
      // El detalle técnico va al log, no a la pantalla.
      console.error('[etiqueta] el OCR falló:', (err as Error).message);
      return res.status(502).json({
        error: 'ocr_fallo',
        message: 'No pudimos leer la foto. Probá de nuevo; si sigue igual, escribí la composición a mano.',
      });
    }

    if (transcripcion.ilegible) {
      return res.json({
        ...analisisDe('', pistas),
        legible: false,
        consejo:
          'No se leyó nada en la foto. Acercá la cámara a la etiqueta, que quede plana y con buena luz, y volvé a intentar.',
      });
    }

    res.json({ ...analisisDe(transcripcion.texto, pistas), legible: true });
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
    res.json({ ...analisisDe(parsed.data.texto, parsed.data.pistas), legible: Boolean(parsed.data.texto.trim()) });
  }
);
