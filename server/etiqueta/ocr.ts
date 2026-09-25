import Anthropic from '@anthropic-ai/sdk';
import { modeloDeOcr } from '../anthropicError';
import { interpretarSalida } from './pista';

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

// La instrucción no dice de qué producto es la etiqueta, y eso importa:
// mientras decía "etiqueta de prenda", una lata de atún o la placa de
// un electrodoméstico entraban en "la imagen no es una etiqueta" y
// volvían como SIN_TEXTO. El arancel tiene 97 capítulos de producto.
//
// La última línea es la única que no es transcripción: qué producto se
// ve. Va separada y marcada (ver pista.ts) para que nunca se confunda
// con algo que la etiqueta dice.
const INSTRUCCION = [
  'Transcribe literalmente todo el texto visible en esta imagen.',
  'Puede ser la etiqueta de cualquier producto: ropa, alimentos, bebidas,',
  'cosméticos, calzado, juguetes, herramientas, relojes, instrumentos, repuestos,',
  'o la placa de datos de un aparato.',
  'Reglas:',
  '- Copia el texto tal como aparece, línea por línea, respetando el idioma original.',
  '- No traduzcas, no corrijas, no completes, no ordenes.',
  '- Incluye números, porcentajes, unidades, códigos y símbolos tal cual.',
  '- Si una parte no se lee con seguridad, escribe [ilegible] en su lugar.',
  '- Si en la imagen no hay NINGÚN texto legible, escribe exactamente: SIN_TEXTO',
  'Al final, en una línea aparte, escribe PRODUCTO_VISTO: seguido de qué producto es,',
  'en español y en pocas palabras (por ejemplo: PRODUCTO_VISTO: reloj de pulsera).',
  'Básate en lo que se ve en la imagen, aunque la etiqueta no lo diga.',
  'Si no se puede saber, escribe PRODUCTO_VISTO: desconocido.',
  'Fuera de esa última línea, no agregues explicaciones ni comentarios.',
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
      model: modeloDeOcr(),
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

    const crudo = respuesta.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n');

    // Sin texto pero con un producto reconocible ya no es ilegible: se
    // sabe qué es, y con eso alcanza para empezar a preguntar.
    const { texto, ilegible } = interpretarSalida(crudo);
    return { texto, proveedor: proveedorAnthropic.nombre, ilegible };
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
