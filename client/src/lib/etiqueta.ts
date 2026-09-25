// La mesa de análisis de producto, del lado del navegador.
//
// Lo importante que pasa acá es la reducción de la foto. Un teléfono
// actual toma imágenes de 4000×3000 y 5 MB; subirlas tal cual por datos
// móviles tarda medio minuto y muchas veces falla. La foto se reduce a
// 1600 px del lado largo antes de salir: pesa unos 300 KB, se sube en
// segundos y la letra de la etiqueta se sigue leyendo bien.

export type Genero = 'hombre' | 'mujer' | 'nina_nino' | 'bebe';
export type Tejido = 'punto' | 'plano';

export interface Fibra { fibra: string; comoDice: string; porcentaje: number | null }
export interface Capa { capa: string; fibras: Fibra[]; suma: number }

export interface Etiqueta {
  capas: Capa[];
  fibras: Fibra[];
  fibraPrincipal: Fibra | null;
  talla: string | null;
  origen: string | null;
  cuidados: string[];
  rn: string | null;
  ca: string | null;
  advertencias: string[];
  faltante: string[];
}

export interface Prenda {
  prenda: { tipo: string; etiqueta: string } | null;
  genero: Genero | null;
  tejido: Tejido | null;
  origenDelTejido: 'etiqueta' | 'habitual' | 'desconocido';
  capitulo: string | null;
  faltante: string[];
}

export interface Cantidad {
  valor: number;
  unidad: string;
  base: { valor: number; unidad: 'kg' | 'L' | 'u' } | null;
}

/** Lo que trae cualquier etiqueta, sea una camiseta o una lata de atún. */
export interface DatosGenericos {
  origen: string | null;
  marca: string | null;
  modelo: string | null;
  contenidoNeto: Cantidad | null;
  codigoDeBarras: string | null;
  lote: string | null;
  vencimiento: string | null;
  materiales: string[];
  electrico: { voltaje: string | null; potencia: string | null; frecuencia: string | null } | null;
}

export interface Pregunta {
  campo: string;
  pregunta: string;
  decisiva: boolean;
  opciones?: { valor: string; etiqueta: string }[];
}

export interface AtributoLeido {
  id: string;
  pregunta: string;
  decisivo: boolean;
  valor: string | null;
  etiqueta: string | null;
  /** `supuesto` es el que hay que marcar: no estaba escrito, se dedujo. */
  origen: 'etiqueta' | 'supuesto' | 'respuesta' | null;
}

export interface Analisis {
  /** Lo que llegó, entero: se reenvía con cada respuesta. */
  texto: string;
  /** Sólo lo impreso en la etiqueta. */
  etiqueta: string;
  /** Qué producto se ve en la foto. No es un dato leído de la etiqueta. */
  pista: string | null;
  legible: boolean;
  generico: DatosGenericos;
  familia: { id: string; nombre: string; capitulos: string[] } | null;
  candidatas: { id: string; nombre: string }[];
  atributos: AtributoLeido[];
  /** Sólo para ropa: capas, porcentajes y cuidados. Null en todo lo demás. */
  textil: { etiqueta: Etiqueta; prenda: Prenda } | null;
  preguntas: Pregunta[];
  terminos: string;
  consejo?: string;
}

/** Con qué campo se contesta "¿qué producto es?". Lo define el servidor. */
export const CAMPO_FAMILIA = 'familia';

/** Lo que la persona ya contestó: campo -> valor. */
export type Respuestas = Record<string, string>;

export type Resultado =
  | { estado: 'ok'; analisis: Analisis }
  | { estado: 'sin_sesion' }
  | { estado: 'no_configurado'; mensaje: string }
  | { estado: 'error'; mensaje: string };

/** Lado largo al que se reduce la foto antes de subirla. */
const LADO_MAXIMO = 1600;
/** Debajo de esto la letra chica de la etiqueta se pierde. */
export const LADO_MINIMO_UTIL = 600;

export interface FotoLista {
  base64: string;
  tipoMime: string;
  ancho: number;
  alto: number;
  /** Para avisar antes de gastar la llamada: una foto diminuta no se va a leer. */
  demasiadoChica: boolean;
}

/**
 * Reduce la foto y la deja lista para enviar. Se hace en el navegador
 * para no subir cinco megas por una etiqueta de cinco centímetros.
 */
export async function prepararFoto(archivo: File): Promise<FotoLista> {
  const bitmap = await cargarImagen(archivo);
  const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
  const ancho = Math.round(bitmap.width * escala);
  const alto = Math.round(bitmap.height * escala);

  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  const ctx = lienzo.getContext('2d');
  if (!ctx) throw new Error('El navegador no pudo procesar la imagen.');
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0, ancho, alto);

  // 0.82 conserva la letra pequeña sin que el archivo se dispare.
  const base64 = lienzo.toDataURL('image/jpeg', 0.82);
  if ('close' in bitmap && typeof bitmap.close === 'function') bitmap.close();

  return {
    base64,
    tipoMime: 'image/jpeg',
    ancho,
    alto,
    demasiadoChica: Math.max(ancho, alto) < LADO_MINIMO_UTIL,
  };
}

function cargarImagen(archivo: File): Promise<ImageBitmap | HTMLImageElement> {
  if ('createImageBitmap' in window) return createImageBitmap(archivo);
  return new Promise((resolver, rechazar) => {
    const img = new Image();
    img.onload = () => resolver(img);
    img.onerror = () => rechazar(new Error('No se pudo abrir la imagen.'));
    img.src = URL.createObjectURL(archivo);
  });
}

/** ¿El servidor puede leer fotos hoy? Se consulta antes de ofrecer el botón. */
export async function estadoDelLector(): Promise<{ ocr: boolean; falta: string | null }> {
  try {
    const res = await fetch('/api/etiqueta/estado');
    if (!res.ok) return { ocr: false, falta: null };
    return (await res.json()) as { ocr: boolean; falta: string | null };
  } catch {
    return { ocr: false, falta: null };
  }
}

async function pedir(ruta: string, token: string | null, cuerpo: unknown): Promise<Resultado> {
  if (!token) return { estado: 'sin_sesion' };
  try {
    const res = await fetch(ruta, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(cuerpo),
    });
    const datos = await res.json().catch(() => ({}));

    if (res.status === 401) return { estado: 'sin_sesion' };
    if (res.status === 503) {
      return { estado: 'no_configurado', mensaje: datos.message ?? 'La lectura de etiquetas no está activada.' };
    }
    if (!res.ok) {
      return { estado: 'error', mensaje: datos.message ?? 'No pudimos analizar la foto.' };
    }
    return { estado: 'ok', analisis: datos as Analisis };
  } catch {
    return { estado: 'error', mensaje: 'No hubo conexión con el servidor.' };
  }
}

/** Manda la foto a leer. Cuesta una llamada al proveedor de visión. */
export function analizarFoto(token: string | null, foto: FotoLista, respuestas?: Respuestas): Promise<Resultado> {
  return pedir('/api/etiqueta/analizar', token, {
    imagen: foto.base64,
    tipoMime: foto.tipoMime,
    ...(respuestas && Object.keys(respuestas).length ? { respuestas } : {}),
  });
}

/**
 * Vuelve a interpretar el texto ya leído con lo que la persona
 * contestó. No gasta otra foto.
 */
export function reinterpretar(token: string | null, texto: string, respuestas?: Respuestas): Promise<Resultado> {
  return pedir('/api/etiqueta/interpretar', token, {
    texto,
    ...(respuestas && Object.keys(respuestas).length ? { respuestas } : {}),
  });
}

/** Cómo se nombra cada fibra en pantalla. */
export const NOMBRE_FIBRA: Record<string, string> = {
  algodon: 'Algodón',
  poliester: 'Poliéster',
  elastano: 'Elastano',
  nylon: 'Nylon',
  lana: 'Lana',
  viscosa: 'Viscosa',
  lino: 'Lino',
  seda: 'Seda',
  acrilico: 'Acrílico',
  modal: 'Modal',
  lyocell: 'Lyocell',
  bambu: 'Bambú',
  canamo: 'Cáñamo',
  yute: 'Yute',
  cuero: 'Cuero',
  poliuretano: 'Poliuretano',
  cachemira: 'Cachemira',
  angora: 'Angora',
  alpaca: 'Alpaca',
};

export const NOMBRE_CAPA: Record<string, string> = {
  exterior: 'Tela exterior',
  forro: 'Forro',
  relleno: 'Relleno',
  puno: 'Puño y cuello',
  adorno: 'Adornos',
  sin_especificar: 'Composición',
};

export const NOMBRE_CUIDADO: Record<string, string> = {
  lavar_a_maquina: 'Lavar a máquina',
  lavar_a_mano: 'Lavar a mano',
  agua_fria: 'Agua fría',
  no_blanqueador: 'No usar blanqueador',
  no_secadora: 'No usar secadora',
  secar_a_la_sombra: 'Secar a la sombra',
  planchar_bajo: 'Planchar a temperatura baja',
  no_planchar: 'No planchar',
  lavado_en_seco: 'Lavado en seco',
};
