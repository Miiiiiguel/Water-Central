// La ruta exportadora: los 7 pasos para que una marca latinoamericana
// venda en EE. UU. por ecommerce, con las tareas de cada uno y la
// herramienta de Easycomex que lo resuelve.
//
// La estructura sigue las etapas clásicas de internacionalización (elegir
// mercado, estrategia, operación, contratos, documentación, entrega,
// seguimiento). Los textos son nuestros y están escritos para ecommerce.
//
// El diagnóstico de madurez decide dónde empieza cada quien: una tarea
// que corresponde a una pregunta respondida con "Sí" ya viene hecha. El
// índice `diag` es el de FLAT en diagnosticContent.ts; si el cuestionario
// cambia de orden, la prueba de este archivo lo detecta.
//
// Es puro: sin red ni almacenamiento. Dónde se guarda el avance lo decide
// rutaProgreso.ts.

import type { Answer } from './diagnosticContent';

export type Herramienta =
  | { tipo: 'ruta'; href: string; es: string; en: string }
  | { tipo: 'buscar'; fuente: 'tiktok' | 'aduanas'; es: string; en: string }
  | { tipo: 'asesor'; mensaje: string; es: string; en: string };

export interface Tarea {
  id: string;
  es: string;
  en: string;
  /** La pregunta del diagnóstico que, respondida "Sí", la da por hecha. */
  diag?: number;
  herramienta?: Herramienta;
}

export interface Paso {
  n: number;
  id: string;
  titulo: { es: string; en: string };
  objetivo: { es: string; en: string };
  tareas: Tarea[];
}

const ROI: Herramienta = { tipo: 'ruta', href: '/roi', es: 'Calculadora ROI', en: 'ROI calculator' };
const FLETE: Herramienta = { tipo: 'ruta', href: '/#calculadora', es: 'Calculadora de fletes', en: 'Freight calculator' };
const ETIQUETA: Herramienta = { tipo: 'ruta', href: '/analizar', es: 'Leer mi etiqueta', en: 'Read my label' };
const plantilla = (doc: string, es: string, en: string): Herramienta => ({ tipo: 'ruta', href: `/plantillas?doc=${doc}`, es, en });
const asesor = (mensaje: string): Herramienta => ({ tipo: 'asesor', mensaje, es: 'Hablar con un asesor', en: 'Talk to an advisor' });

export const PASOS: Paso[] = [
  {
    n: 1,
    id: 'mercado',
    titulo: { es: 'Elegir el mercado', en: 'Choose the market' },
    objetivo: {
      es: 'Saber dónde y contra quién vas a vender, con datos y no con intuición.',
      en: 'Know where and against whom you will sell, with data rather than gut feeling.',
    },
    tareas: [
      { id: 'base-redes', diag: 11, es: 'Tu marca tiene redes activas y con buena interacción en tu país', en: 'Your brand has active, engaged social media at home' },
      { id: 'base-ventas', diag: 13, es: 'Ya vendes por redes de forma automatizada en tu país', en: 'You already sell through social media, automated, at home' },
      {
        id: 'competencia', diag: 6,
        es: 'Estudiaste a tu competencia en Instagram, TikTok y Amazon',
        en: 'You studied your competitors on Instagram, TikTok and Amazon',
        herramienta: { tipo: 'buscar', fuente: 'tiktok', es: 'Ver qué se vende en TikTok Shop', en: 'See what sells on TikTok Shop' },
      },
      {
        id: 'importadores',
        es: 'Sabes quién importa tu producto y desde qué países',
        en: 'You know who imports your product and from which countries',
        herramienta: { tipo: 'buscar', fuente: 'aduanas', es: 'Buscar en comercio exterior', en: 'Search foreign-trade data' },
      },
    ],
  },
  {
    n: 2,
    id: 'estrategia',
    titulo: { es: 'Definir precio y canal', en: 'Set price and channel' },
    objetivo: {
      es: 'Un precio que deje margen después de flete, aranceles y comisiones, y el canal por donde vas a entrar.',
      en: 'A price that leaves margin after freight, duties and fees, and the channel you will enter through.',
    },
    tareas: [
      { id: 'costos', diag: 3, es: 'Tienes claros tus costos: transporte, aranceles, impuestos y logística', en: 'Your costs are clear: freight, duties, taxes and logistics', herramienta: ROI },
      { id: 'canales', diag: 14, es: 'Decidiste en qué canales vender (Amazon, TikTok Shop, Shopify)', en: 'You decided which channels to sell on (Amazon, TikTok Shop, Shopify)' },
      { id: 'presupuesto-ads', diag: 15, es: 'Definiste cuánto vas a invertir en publicidad en EE. UU.', en: 'You set how much you will invest in US advertising', herramienta: ROI },
    ],
  },
  {
    n: 3,
    id: 'operacion',
    titulo: { es: 'Montar la operación', en: 'Set up operations' },
    objetivo: {
      es: 'La empresa, la marca y las cuentas que te dejan vender legalmente en EE. UU.',
      en: 'The company, brand and accounts that let you sell legally in the US.',
    },
    tareas: [
      { id: 'empresa', diag: 0, es: 'Empresa registrada en EE. UU.', en: 'Company registered in the US', herramienta: asesor('necesito registrar mi empresa en EE. UU.') },
      { id: 'marca', diag: 1, es: 'Marca registrada en EE. UU.', en: 'Trademark registered in the US', herramienta: asesor('necesito registrar mi marca en EE. UU.') },
      { id: 'cuentas', diag: 5, es: 'Cuentas creadas y configuradas en Amazon y TikTok Shop', en: 'Amazon and TikTok Shop accounts created and set up', herramienta: asesor('quiero abrir mis cuentas en Amazon y TikTok Shop.') },
    ],
  },
  {
    n: 4,
    id: 'contratos',
    titulo: { es: 'Cerrar acuerdos', en: 'Close agreements' },
    objetivo: {
      es: 'Condiciones claras con quien guarda, mueve y vende tu producto.',
      en: 'Clear terms with whoever stores, moves and sells your product.',
    },
    tareas: [
      { id: 'acuerdo-bodega', es: 'Acuerdo firmado con tu bodega o Prep Center en EE. UU.', en: 'Signed agreement with your US warehouse or Prep Center', herramienta: asesor('quiero información del Prep Center en EE. UU.') },
      { id: 'incoterm', es: 'Elegiste el Incoterm y la forma de pago con tu transportista', en: 'You chose the Incoterm and payment terms with your carrier', herramienta: plantilla('incoterms', 'Guía de Incoterms', 'Incoterms guide') },
      { id: 'creadores', es: 'Acuerdos con creadores de contenido (comisión, entregables, derechos de uso)', en: 'Agreements with content creators (commission, deliverables, usage rights)' },
    ],
  },
  {
    n: 5,
    id: 'documentos',
    titulo: { es: 'Tener los papeles en regla', en: 'Get the paperwork right' },
    objetivo: {
      es: 'Clasificación, registros y certificados para que la carga no se quede en aduana.',
      en: 'Classification, registrations and certificates so the cargo does not get stuck at customs.',
    },
    tareas: [
      { id: 'requisitos', diag: 2, es: 'Identificaste los requisitos legales para exportar tu producto', en: 'You identified the legal requirements to export your product' },
      { id: 'partida', es: 'Tienes la partida arancelaria de tu producto', en: 'You have your product’s tariff code', herramienta: ETIQUETA },
      { id: 'registros', es: 'Registros sanitarios o de seguridad si tu producto los pide (FDA, CPSC)', en: 'Health or safety registrations if your product needs them (FDA, CPSC)', herramienta: asesor('necesito saber si mi producto requiere registro FDA.') },
      { id: 'origen', es: 'Certificado de origen para usar el acuerdo comercial de tu país', en: 'Certificate of origin to use your country’s trade agreement', herramienta: plantilla('origen', 'Plantilla de certificación', 'Certification template') },
      { id: 'factura', es: 'Factura comercial y lista de empaque de tu primer envío', en: 'Commercial invoice and packing list for your first shipment', herramienta: plantilla('factura', 'Hacer la factura', 'Make the invoice') },
    ],
  },
  {
    n: 6,
    id: 'entrega',
    titulo: { es: 'Llevar el producto al comprador', en: 'Get the product to the buyer' },
    objetivo: {
      es: 'El producto publicado, en una bodega de EE. UU. y con el costo de cada envío calculado.',
      en: 'The product listed, in a US warehouse, with the cost of each shipment worked out.',
    },
    tareas: [
      { id: 'flete', es: 'Cotizaste el flete internacional de tu primer envío', en: 'You quoted the international freight for your first shipment', herramienta: FLETE },
      { id: 'bodega', diag: 4, es: 'Tienes bodega en EE. UU. para procesar pedidos', en: 'You have a US warehouse to process orders', herramienta: asesor('quiero una bodega en EE. UU. para mis pedidos.') },
      { id: 'publicados', diag: 8, es: 'Tus productos están publicados en Amazon y TikTok Shop', en: 'Your products are listed on Amazon and TikTok Shop' },
      { id: 'ultima-milla', es: 'Sabes cuánto cuesta enviar cada pedido al comprador', en: 'You know what shipping each order to the buyer costs', herramienta: ROI },
    ],
  },
  {
    n: 7,
    id: 'crecer',
    titulo: { es: 'Medir y crecer', en: 'Measure and grow' },
    objetivo: {
      es: 'Ventas que se sostienen: audiencia, reseñas y publicidad que se paga sola.',
      en: 'Sales that last: audience, reviews and ads that pay for themselves.',
    },
    tareas: [
      { id: 'audiencia', diag: 7, es: 'Tienes seguidores en EE. UU. (Instagram, Facebook, TikTok)', en: 'You have US followers (Instagram, Facebook, TikTok)' },
      { id: 'resenas', diag: 9, es: 'Tienes reseñas en Amazon y TikTok Shop', en: 'You have reviews on Amazon and TikTok Shop' },
      { id: 'ads', diag: 10, es: 'Inviertes en publicidad en EE. UU. y mides el retorno', en: 'You invest in US advertising and measure the return', herramienta: ROI },
    ],
  },
];

export const TODAS: Tarea[] = PASOS.flatMap((p) => p.tareas);

/** Las tareas que el diagnóstico ya da por hechas (respuestas "Sí"). */
export function hechasPorDiagnostico(answers: ReadonlyArray<Answer | string | null | undefined>): Set<string> {
  const hechas = new Set<string>();
  for (const t of TODAS) {
    if (t.diag !== undefined && answers[t.diag] === 'si') hechas.add(t.id);
  }
  return hechas;
}

export interface EstadoRuta {
  total: number;
  hechas: number;
  pct: number;
  /** El primer paso con algo pendiente; null si todo está hecho. */
  actual: Paso | null;
  porPaso: Array<{ paso: Paso; hechas: number; total: number; completo: boolean }>;
}

export function estadoDe(hechas: ReadonlySet<string>): EstadoRuta {
  const porPaso = PASOS.map((paso) => {
    const h = paso.tareas.filter((t) => hechas.has(t.id)).length;
    return { paso, hechas: h, total: paso.tareas.length, completo: h === paso.tareas.length };
  });
  const total = TODAS.length;
  const n = TODAS.filter((t) => hechas.has(t.id)).length;
  return {
    total,
    hechas: n,
    pct: Math.round((n / total) * 100),
    actual: porPaso.find((p) => !p.completo)?.paso ?? null,
    porPaso,
  };
}
