import Anthropic from '@anthropic-ai/sdk';

// Leer el texto de una foto de etiqueta. Fase 1.
//
// El proveedor está detrás de una interfaz a propósito: hoy lee con el
// modelo que ya usa el chat, mañana puede ser otro, y el resto del
// módulo no se entera. Lo único que el resto del sistema sabe es que
// entra una imagen y sale texto.
//
// La regla que gobierna este archivo: transcribir, no interpretar. Si
// la foto salió borrosa, la respuesta correcta es "no se lee", no un
// texto plausible. Una composición inventada acá se convierte más
// adelante en una partida arancelaria equivocada y en un cliente que
// paga de más —o que tiene un problema en aduana.

export interface Transcripcion {
  texto: string;
  proveedor: string;
  /** Lo que el proveedor no pudo leer, si lo reporta. */
  ilegible: boolean;
}

export interface ProveedorOcr {
  nombre: string;
  disponible(): boolean;
  /** Falta por configurar: qué variable de entorno hay que poner. */
  queFalta(): string;
  leer(imagenBase64: string, tipoMime: string): Promise<Transcripcion>;
}

export const MIMES_ACEPTADOS = ['image/jpeg', 'image/png', 'image/webp'];
/** 6 MB de imagen ya decodificada: una foto de teléfono reducida entra de sobra. */
export const MAXIMO_BYTES = 6 * 1024 * 1024;

const INSTRUCCION = [
  'Transcribe literalmente todo el texto visible en esta etiqueta de prenda.',
  'Reglas:',
  '- Copia el texto tal como aparece, línea por línea, respetando el idioma original.',
  '- No traduzcas, no corrijas, no completes, no ordenes.',
  '- Si una parte no se lee con seguridad, escribe [ilegible] en su lugar.',
  '- Si la imagen no es una etiqueta o no se lee nada, responde exactamente: SIN_TEXTO',
  'No agregues explicaciones ni comentarios: sólo el texto de la etiqueta.',
].join('\n');

/**
 * Lector con el modelo de visión que ya está configurado para el chat.
 * Comparte ANTHROPIC_API_KEY; no hay una llave nueva que poner.
 */
export const proveedorAnthropic: ProveedorOcr = {
  nombre: 'vision',
  disponible: () => Boolean(process.env.ANTHROPIC_API_KEY),
  queFalta: () => 'ANTHROPIC_API_KEY',

  async leer(imagenBase64: string, tipoMime: string): Promise<Transcripcion> {
    const cliente = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    const respuesta = await cliente.messages.create({
      // El OCR necesita más capacidad que el chat: la etiqueta está
      // impresa en letra diminuta sobre tela arrugada.
      model: process.env.ANTHROPIC_OCR_MODEL || 'claude-sonnet-5',
      max_tokens: 1200,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: tipoMime as 'image/jpeg', data: imagenBase64 } },
            { type: 'text', text: INSTRUCCION },
          ],
        },
      ],
    });

    const texto = respuesta.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    const ilegible = !texto || /^SIN_TEXTO$/i.test(texto.trim());
    return { texto: ilegible ? '' : texto, proveedor: proveedorAnthropic.nombre, ilegible };
  },
};

const PROVEEDORES: ProveedorOcr[] = [proveedorAnthropic];

export function proveedorActivo(): ProveedorOcr | null {
  return PROVEEDORES.find((p) => p.disponible()) ?? null;
}

/** Qué hay que configurar para que el OCR funcione, para decirlo en pantalla. */
export function queFaltaParaOcr(): string {
  return PROVEEDORES.map((p) => p.queFalta()).join(' o ');
}

export type ProblemaImagen = 'formato' | 'tamano' | 'vacia';

/**
 * Revisa la imagen antes de gastar una llamada. Devuelve null si está
 * bien.
 */
export function revisarImagen(base64: string, tipoMime: string): ProblemaImagen | null {
  if (!base64) return 'vacia';
  if (!MIMES_ACEPTADOS.includes(tipoMime)) return 'formato';
  // base64 crece 4/3 sobre el binario.
  const bytes = Math.floor((base64.length * 3) / 4);
  if (bytes > MAXIMO_BYTES) return 'tamano';
  if (bytes < 1024) return 'vacia';
  return null;
}

export const EXPLICACION: Record<ProblemaImagen, string> = {
  formato: 'Esa imagen no es JPG, PNG ni WEBP. Tomá la foto de nuevo con la cámara.',
  tamano: 'La imagen pesa demasiado. Probá de nuevo: la app la reduce sola antes de enviarla.',
  vacia: 'No llegó ninguna imagen.',
};
