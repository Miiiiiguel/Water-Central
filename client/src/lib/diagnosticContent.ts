// Diagnóstico de madurez — el contenido exacto del cuestionario de Easycomex.
//
// 16 preguntas de sí/no repartidas en 5 etapas, más una pregunta abierta que
// no puntúa. Cada Sí vale 6,25 %, así que 16 síes dan 100 %.
//
// Los textos son los del equipo, palabra por palabra: los comentarios que
// ve el cliente según responda, y la acción recomendada que aparece cuando
// hay una brecha (esas van detrás del pago). No los reescribas sin que lo
// pidan — son el producto.

export interface DiagnosticQuestion {
  /** The question itself. */
  t: string;
  /** Shown when they answer "no" — names the risk. */
  comNo?: string;
  /** Shown when they answer "yes" — confirms the ground covered. */
  comSi?: string;
  /** 'input' questions are open text and never score. */
  type?: 'input';
  placeholder?: string;
  hint?: string;
}

export interface DiagnosticSection {
  n: number;
  title: string;
  full: string;
  q: DiagnosticQuestion[];
}

export const SECTIONS: DiagnosticSection[] = [
  {
    n: 1,
    title: 'Constitución y marca',
    full: 'Constitución y estado de la marca en USA',
    q: [
      {
        t: '¿Tiene empresa registrada en Estados Unidos?',
        comNo: 'Debe comenzar a pagar impuestos en Estados Unidos desde el momento en que genera ingresos sujetos a tributación, sin importar su nacionalidad o estatus migratorio.',
        comSi: 'Su empresa va por buen camino. A partir del registro de su actividad económica puede iniciar formalmente sus ventas en USA.',
      },
      {
        t: '¿Tiene su marca registrada en USA?',
        comNo: 'Conozca los riesgos de no registrar su marca: puede llegar a perderla si no formaliza el proceso.',
        comSi: 'Excelente. Pocas empresas comprenden la importancia de tener su marca y sus derechos de autor debidamente registrados.',
      },
    ],
  },
  {
    n: 2,
    title: 'Logística',
    full: 'Logística internacional',
    q: [
      {
        t: '¿Ha identificado los requisitos legales para exportar?',
        comNo: 'Es fundamental identificar procesos, documentos y normativas para asegurar la viabilidad de la estrategia.',
        comSi: 'Muy bien. Tiene resuelta una parte importante del proceso.',
      },
      {
        t: '¿Tiene claros los costos de transporte, impuestos, requisitos, FDA, aranceles y logística internacional?',
        comNo: 'Estados Unidos es un mercado muy competido. Si no tiene claros los números, el riesgo de fallar en el proceso es alto.',
        comSi: 'Excelente. Un buen costeo del producto es la base para diseñar una estrategia de ventas eficiente.',
      },
      {
        t: '¿Tiene estimada una bodega en Estados Unidos para procesar sus órdenes?',
        comNo: '¿Sabía que un envío directo desde Latinoamérica a USA puede costar cerca de USD 30 por una sola libra? ¿Su ticket de venta soporta ese costo?',
        comSi: 'Va un paso adelante optimizando sus costos logísticos.',
      },
    ],
  },
  {
    n: 3,
    title: 'Marketing',
    full: 'Marketing y canales de venta',
    q: [
      {
        t: '¿Tiene cuenta creada, configurada y con accesos en Amazon y TikTok Shop en USA?',
        comNo: 'Para vender por modelos de ecommerce no basta con anunciar en sus redes que ofrece ventas internacionales.',
        comSi: 'Felicitaciones. Vender en Estados Unidos operando de forma local es uno de los aspectos más importantes.',
      },
      {
        t: '¿Ha realizado estudios de mercado de competidores en Instagram, TikTok y Amazon?',
        comNo: '¿Piensa entrar al mercado más competido del mundo sin información?',
        comSi: 'Buen trabajo. Ya cuenta con datos relevantes para realizar un buen ejercicio financiero.',
      },
      {
        t: '¿Tiene seguidores en Instagram, Facebook y TikTok Shop en USA?',
        comNo: '¿Sabía que el costo promedio para que un cliente visite su página está entre USD 45 y USD 200, sin comprar nada? (CAC promedio según Shopify.)',
        comSi: 'Excelente. Las redes sociales maximizan la inversión en pauta y reducen el costo de adquisición de cliente.',
      },
      {
        t: '¿Tiene productos creados en Amazon y TikTok Shop?',
        comNo: 'Es fundamental apoyar las ventas con canales que generan confianza al comprar. Hoy, TikTok Shop y Amazon son las mejores opciones.',
        comSi: 'Buen trabajo. Va por el camino correcto.',
      },
      {
        t: '¿Tiene reseñas en Amazon y TikTok Shop?',
        comNo: 'A todos nos gusta comprar, pero no que nos vendan. Por eso es clave contar con reseñas y comentarios que generan confianza al momento de la compra.',
        comSi: 'Muy bien. La validación social es primordial y usted ya está dando pasos importantes.',
      },
      {
        t: '¿Invierte actualmente en publicidad en Estados Unidos?',
        comNo: 'Invertir en publicidad (ADS) es obligatorio para llevar clientes a sus canales de venta. No es negociable.',
        comSi: 'Excelente. La inversión en pauta es la que activa y sostiene sus canales de venta.',
      },
    ],
  },
  {
    n: 4,
    title: 'País de origen',
    full: 'Situación en su país de origen',
    q: [
      {
        t: '¿Tiene redes sociales maduras y con buena interacción en su país de origen?',
        comNo: 'Para llegar a otros mercados por ecommerce o redes sociales es fundamental tener una comunidad en su país de origen. Es necesario trabajar su comunidad.',
        comSi: 'Muy bien. Una comunidad sólida en su país de origen es una base valiosa para expandirse.',
      },
      {
        t: '¿Actualmente invierte en publicidad en su país de origen?',
        comNo: 'Considere hacerlo: los resultados se verán reflejados.',
        comSi: 'Lo tiene claro. El que no invierte, no crece.',
      },
      {
        t: '¿Tiene ventas por sus redes sociales de forma automatizada?',
        comNo: 'Para llegar al mercado americano por ecommerce o social commerce es fundamental tener una comunidad en su país de origen. Es necesario trabajar la comunidad.',
        comSi: 'Muy bien. La automatización de ventas es una señal de madurez digital.',
      },
    ],
  },
  {
    n: 5,
    title: 'Expectativas',
    full: 'Expectativas de inversión',
    q: [
      {
        t: '¿Considera viable invertir en canales de venta adicionales en Estados Unidos?',
        comNo: 'Abrir nuevos canales es clave para crecer en USA. Si aún no lo considera viable, conversemos para mostrarle el potencial.',
        comSi: 'Excelente disposición. Para vender por redes necesita bases sólidas que generen confianza, y usted está listo para construirlas.',
      },
      {
        t: '¿Está dispuesto a invertir en publicidad en Estados Unidos?',
        comNo: 'Sin inversión en pauta será difícil ser visible en USA. Podemos ayudarle a dimensionar un presupuesto realista.',
        comSi: 'Excelente. La pauta es el motor que lleva clientes a sus canales; su disposición a invertir es una gran ventaja.',
      },
      {
        t: '¿Cuánto considera que es necesario invertir en campañas de ADS para lograr los resultados que quiere?',
        type: 'input',
        placeholder: 'Ej. USD 2.000 / mes',
        hint: 'Opcional. Nos ayuda a dimensionar mejor su estrategia.',
      },
    ],
  },
];

/** Each "sí" is worth this much — 16 of them make 100 %. */
export const WEIGHT_PER_YES = 6.25;

export interface DiagnosticTier {
  /** Upper bound of the band, inclusive. */
  max: number;
  /** Short badge. */
  badge: string;
  /** The name the client is given. */
  name: string;
  /** What that level means for them. */
  body: string;
  /** Tailwind classes for the badge, matching the app's palette. */
  badgeClass: string;
  ringClass: string;
}

export const TIERS: DiagnosticTier[] = [
  {
    max: 25,
    badge: 'Etapa inicial',
    name: 'Explorador',
    body: 'Está comenzando. Hay bases importantes por construir antes de vender en USA, pero identificarlas hoy le ahorra tiempo y dinero.',
    badgeClass: 'bg-amber-50 text-amber-700',
    ringClass: 'stroke-amber-500',
  },
  {
    max: 50,
    badge: 'En construcción',
    name: 'Constructor',
    body: 'Ya tiene avances, pero faltan piezas clave. Con foco en las brechas correctas puede acelerar de forma considerable.',
    badgeClass: 'bg-orange-50 text-accent',
    ringClass: 'stroke-accent',
  },
  {
    max: 75,
    badge: 'Avanzado',
    name: 'Retador',
    body: 'Va bien encaminado. Cerrando algunos puntos estará en condiciones sólidas para competir en el mercado americano.',
    badgeClass: 'bg-indigo-50 text-indigo-700',
    ringClass: 'stroke-indigo-500',
  },
  {
    max: 100,
    badge: 'Listo para USA',
    name: 'Exportador',
    body: 'Tiene una base sólida. El siguiente paso es ejecutar con estrategia y afinar los detalles para escalar.',
    badgeClass: 'bg-green-50 text-green-700',
    ringClass: 'stroke-green-500',
  },
];

export interface DiagnosticOffer {
  t: string;
  d: string;
  /** USD. Zero means the free call. */
  p: number;
  eta: string;
  feat?: boolean;
  free?: boolean;
}

/** What to offer once the diagnosis is done. Prices in USD. */
export const OFFERS: DiagnosticOffer[] = [
  { t: 'Diagnóstico 1 a 1', d: 'Una hora con nuestro equipo para revisar su caso y trazar los primeros pasos.', p: 99, eta: 'Agenda en línea' },
  { t: 'Análisis de mercado y competencia', d: 'Estudio de su categoría en Amazon y TikTok Shop USA.', p: 399, eta: 'Entrega 48 h', feat: true },
  { t: 'Plan de acción 360° a 90 días', d: 'Hoja de ruta completa con prioridades y responsables.', p: 699, eta: 'Entrega 48 h' },
  { t: 'Plan Social Commerce USA', d: 'Estructuración con costos, logística internacional e interna y aranceles.', p: 999, eta: 'Entrega 48 h' },
  { t: 'Apertura de un canal de ventas', d: 'Montamos y dejamos operativo un canal de venta en USA.', p: 999, eta: 'Con agenda' },
  { t: 'Apertura de dos canales de ventas', d: 'Dos canales listos para vender, integrados a su operación.', p: 1699, eta: 'Con agenda' },
  { t: 'Asesoría · 1 hora', d: 'Sesión enfocada en la decisión o duda que tenga en este momento.', p: 69, eta: 'Con agenda' },
  { t: 'Llamada de 30 minutos', d: 'Conversemos su caso sin costo y veamos si somos el aliado indicado.', p: 0, eta: 'Sin costo', free: true },
];

// ---------------------------------------------------------------------
// Scoring — pure, so it can be tested without a browser.
// ---------------------------------------------------------------------

export type Answer = 'si' | 'no' | null;

/** Every question in order, with the section it belongs to. */
export interface FlatQuestion extends DiagnosticQuestion {
  section: DiagnosticSection;
  /** Position in the flattened list, which is what `answers` is indexed by. */
  index: number;
}

export const FLAT: FlatQuestion[] = SECTIONS.flatMap((section) =>
  section.q.map((q) => ({ ...q, section, index: 0 }))
).map((q, index) => ({ ...q, index }));

export const TOTAL_QUESTIONS = FLAT.length;
export const SCORED_QUESTIONS = FLAT.filter((q) => q.type !== 'input').length;

/** 0-100. Only "sí" on a scored question adds anything. */
export function scorePct(answers: Answer[]): number {
  const yes = FLAT.filter((q) => q.type !== 'input' && answers[q.index] === 'si').length;
  return Math.round(yes * WEIGHT_PER_YES);
}

/** The band a score falls into. */
export function tierFor(score: number): DiagnosticTier {
  return TIERS.find((t) => score <= t.max) ?? TIERS[TIERS.length - 1];
}

/** The questions answered "no" — each one becomes a recommended action. */
export function gapsIn(answers: Answer[]): FlatQuestion[] {
  return FLAT.filter((q) => q.type !== 'input' && answers[q.index] === 'no');
}

/** True once every scored question has an answer. */
export function isComplete(answers: Answer[]): boolean {
  return FLAT.every((q) => q.type === 'input' || answers[q.index] !== null);
}
