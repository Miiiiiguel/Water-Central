// Rule-based knowledge base for Marco Polo, the guide chatbot. Works
// with zero external dependencies — this is what powers him when no AI
// backend is configured (see server/chat.ts), and it's also what grounds
// the AI backend's system prompt so it never drifts from what Easycomex
// actually offers.

export type SectionAction = 'planes' | 'calculadora' | 'contacto' | 'pronostico' | 'vsl' | 'inteligencia';

export interface KnowledgeEntry {
  id: string;
  keywords: string[];
  answer: { es: string; en: string };
  // When matched on the home page, Marco Polo scrolls the user there.
  action?: SectionAction;
  /** A page of its own to open instead of scrolling (e.g. '/roi'). */
  route?: string;
}

export const MARCO_POLO = {
  name: 'Marco Polo',
  tagline: { es: 'Tu guía para vender en el mundo', en: 'Your guide to selling worldwide' },
  greeting: {
    es: 'Soy Marco Polo. Abrí rutas comerciales hace 700 años; ahora saco marcas de su mercado local y las pongo a vender en el mundo. Dime qué vendes y vamos al grano.',
    en: "I'm Marco Polo. I opened trade routes 700 years ago; now I take brands out of their local market and get them selling worldwide. Tell me what you sell and let's cut to it.",
  },
  nudge: {
    es: '¿Vemos dónde vale más tu producto?',
    en: 'Want to see where your product is worth more?',
  },
  fallback: {
    es: 'Esa ruta no la tengo mapeada y no te voy a inventar una respuesta. Te paso con un especialista del equipo por WhatsApp.',
    en: "I have not mapped that route and I am not going to invent an answer. Let me hand you to a specialist on WhatsApp.",
  },
};

export const knowledgeBase: KnowledgeEntry[] = [
  {
    id: 'quien-eres',
    keywords: ['quien eres', 'quién eres', 'marco polo', 'que eres', 'eres un bot', 'who are you', 'what are you'],
    answer: {
      es: 'Soy Marco Polo, el asistente de Easycomex. Respondo sobre mercados, precios, logística y por dónde empezar, y puedo investigar demanda y competencia con datos reales de TikTok Shop y de comercio exterior. Lo que no sé, te lo digo y te paso con el equipo.',
      en: "I'm Marco Polo, Easycomex's assistant. I answer questions about markets, pricing, logistics and where to start, and I can research demand and competition with real TikTok Shop and foreign-trade data. What I do not know, I say so and hand you to the team.",
    },
  },
  {
    id: 'servicios',
    keywords: ['servicio', 'ofrecen', 'hacen', 'ayudan', 'que hacen', 'services', 'what do you do'],
    answer: {
      es: 'Sacamos marcas de su mercado local y las ponemos a vender donde el producto valga más: Estados Unidos, Europa, México, Asia. Canales (Amazon, TikTok Shop, Shopify), logística puerta a puerta a 220 destinos, Prep Center en USA, estrategia e inteligencia de mercado.',
      en: 'We take brands out of their local market and get them selling where the product is worth more: the US, Europe, Mexico, Asia. Channels (Amazon, TikTok Shop, Shopify), door-to-door logistics to 220 destinations, a US Prep Center, strategy and market intelligence.',
    },
  },
  {
    id: 'empezar',
    keywords: ['empezar', 'comenzar', 'como empiezo', 'primer paso', 'start', 'get started', 'how do i begin', 'begin'],
    answer: {
      es: 'Diagnóstico gratis primero. Si hay oportunidad te armamos el plan; si no, te lo decimos. Te llevo a los planes.',
      en: 'The easiest way is to start with the free diagnosis of your current situation. From there we propose a growth plan and, if needed, a market analysis. Let me take you to the plans.',
    },
    action: 'planes',
  },
  {
    id: 'roi',
    keywords: [
      'roi', 'retorno', 'rentabilidad', 'calculadora roi', 'simulador', 'cuanto gano', 'cuánto gano',
      'margen', 'utilidad', 'ganancia', 'inversion inicial', 'inversión inicial', 'cuanto invierto',
      'flujo de caja', 'payback', 'return', 'profit', 'margin', 'how much do i make', 'investment',
    ],
    answer: {
      es: 'Tenemos una calculadora de ROI: escribís precio, costo, peso, inventario y presupuesto, y te muestra utilidad, margen, cuándo recuperás la inversión y el flujo de caja mes a mes de dos años. Es gratis y te la abro ahora.',
      en: 'We have an ROI calculator: type your price, cost, weight, inventory and budget, and it shows profit, margin, when you recover the investment and the month-by-month cash flow for two years. It is free — let me open it.',
    },
    route: '/roi',
  },
  {
    id: 'precio',
    keywords: ['precio', 'cuesta', 'cuanto', 'cuánto', 'costo', 'tarifa', 'price', 'cost', 'how much', 'pricing'],
    answer: {
      es: 'El diagnóstico básico es gratis. El plan de acción del diagnóstico de madurez cuesta USD 9.99 (unos $39.900 COP). El plan de crecimiento es a medida según tu marca. El análisis de mercado y competencia en Amazon/TikTok Shop cuesta USD 499 e incluye 2 horas de asesoría 1 a 1.',
      en: 'The basic diagnosis is free. The maturity diagnosis action plan costs USD 9.99 (about $39,900 COP). The growth plan is custom-priced for your brand. The market & competitor analysis on Amazon/TikTok Shop costs USD 499 and includes 2 hours of 1-on-1 advisory.',
    },
    action: 'planes',
  },
  {
    id: 'pago',
    keywords: [
      'pagar', 'pago', 'pagos', 'tarjeta', 'stripe', 'wompi', 'pse', 'nequi', 'metodo de pago', 'método de pago',
      'como pago', 'cómo pago', 'formas de pago', 'pay', 'payment', 'card', 'how do i pay',
    ],
    answer: {
      es: 'El plan de acción del diagnóstico se paga en pesos con Wompi: tarjeta, PSE o Nequi, en una página segura. Los planes en dólares se pagan con tarjeta por Stripe. Apenas se confirma el pago, tu plan aparece en tu dashboard y el equipo te contacta en menos de 24 horas.',
      en: 'The diagnosis action plan is paid in Colombian pesos through Wompi: card, PSE or Nequi, on a secure page. The US-dollar plans are paid by card through Stripe. As soon as it clears, your plan shows up in your dashboard and the team reaches out within 24 hours.',
    },
  },
  {
    id: 'amazon-tiktok',
    keywords: ['amazon', 'tiktok', 'tik tok', 'shopify', 'canal', 'canales', 'vender en', 'channel', 'marketplace', 'fba'],
    answer: {
      es: 'Sí: Amazon (con FBA vía nuestro Prep Center en USA), TikTok Shop y Shopify, en el país que te sirva. Con estrategia de contenido y pauta para cada canal.',
      en: 'Yes: Amazon (with FBA through our US Prep Center), TikTok Shop and Shopify, in whichever country fits you. With content and ad strategy per channel.',
    },
  },
  {
    id: 'prep-center',
    keywords: ['prep center', 'bodega', 'almacen', 'almacén', 'warehouse', 'etiquetado', 'labeling', 'inventario'],
    answer: {
      es: 'Nuestro Prep Center en USA recibe tu mercancía, la inspecciona, la etiqueta según las reglas de cada marketplace y la despacha a los centros de Amazon (FBA) o directo a tus clientes finales.',
      en: 'Our US Prep Center receives your goods, inspects them, labels them to each marketplace\'s rules and ships them to Amazon (FBA) warehouses or straight to your end customers.',
    },
  },
  {
    id: 'inteligencia',
    keywords: [
      'inteligencia de mercado', 'inteligencia', 'datos', 'aduana', 'aduanas', 'importadores', 'importa', 'exporta',
      'competencia', 'quien importa', 'quien compra', 'mas vendidos', 'más vendidos', 'tendencia', 'tendencias',
      'market intelligence', 'customs', 'who imports', 'best selling', 'competitors', 'trends',
      // Cómo se pregunta esto de verdad, no cómo lo llamamos nosotros:
      // nadie escribe "inteligencia de mercado", escribe "qué se vende
      // más en tik tok". Estas frases llevan esa pregunta acá.
      'mejores productos', 'mejor producto', 'mejores articulos', 'que vender', 'que producto',
      'productos ganadores', 'producto ganador', 'top productos', 'que se vende', 'que se venden',
      'mas vendido', 'más vendido', 'mas se vende', 'más se vende', 'nicho', 'nichos', 'demanda',
      'oportunidad', 'oportunidades', 'tiktok', 'tik tok',
      'best products', 'what to sell', 'what sells', 'selling best', 'sells best', 'winning products', 'top selling', 'demand', 'niche',
    ],
    answer: {
      es: 'Tenemos fuentes de aduanas oficiales y de inteligencia de marketplaces de los principales países del mundo. Puedo buscarte cosas como qué empresas importan un producto, o cuáles son los más vendidos en TikTok Shop. Tenés consultas gratis todos los días al crear tu cuenta — mirá los ejemplos acá abajo.',
      en: 'We have official customs sources and marketplace intelligence for the world\u2019s main countries. I can look up things like which companies import a product, or what is selling best on TikTok Shop. You get free lookups every day when you create your account — see the examples below.',
    },
    action: 'inteligencia',
  },
  {
    id: 'logistica',
    keywords: [
      'logistica', 'logística', 'envio', 'envío', 'flete', 'fletes', 'aduana', 'importar', 'exportar',
      // "Precio" y "cuánto cuesta" también viven en la entrada de planes.
      // Estas frases son las que separan "cuánto cuesta el flete" de
      // "cuánto cuesta el servicio": ganan por ser más largas, no por
      // ningún desempate escondido.
      'cuanto cuesta el flete', 'cuanto vale el flete', 'cuanto cuesta enviar', 'cuanto cuesta mandar',
      'precio del flete', 'costo de envio', 'costo del envio', 'tarifa de envio', 'cotizar', 'cotizacion', 'cotización',
      'shipping', 'freight', 'customs', 'shipping cost', 'how much to ship',
    ],
    answer: {
      es: 'Puerta a puerta, aérea y marítima, a 220 destinos en el mundo. Te llevo a la calculadora para una tarifa estimada.',
      en: 'We offer door-to-door international logistics, air and ocean, to 220 destinations. Let me take you to the freight calculator for an estimated rate.',
    },
    action: 'calculadora',
  },
  {
    id: 'tiempo',
    keywords: ['tiempo', 'cuanto tarda', 'cuánto tarda', 'cuando', 'cuándo', 'resultados', 'how long', 'timeline', 'when'],
    answer: {
      es: 'Depende del canal y de dónde arranques. Nadie serio te da una fecha sin ver tus números: por eso va primero el diagnóstico, con metas y tiempos escritos.',
      en: "It depends on the channel and your brand's starting point. That's why we always start with a diagnosis and an action plan with clear goals and timelines.",
    },
  },
  {
    id: 'consultoria',
    keywords: ['consultoria', 'consultoría', 'llamada', 'agendar', 'reunion', 'reunión', 'cita', 'consulting', 'call', 'schedule', 'meeting', 'book'],
    answer: {
      es: 'Podés agendar 20-30 minutos de consultoría gratis con nuestros especialistas — sin compromiso. Te llevo al botón para reservar.',
      en: 'You can book a free 20-30 minute consultation with our specialists — no commitment. Let me take you to the booking button.',
    },
    action: 'pronostico',
  },
  {
    id: 'referidos',
    keywords: ['referido', 'referidos', 'afiliado', 'comision', 'comisión', 'referral', 'affiliate', 'recomendar'],
    answer: {
      es: 'Sí, tenemos programa de referidos: al crear tu cuenta recibís un link único en tu dashboard. Cada marca que se registre con tu link queda asociada a vos.',
      en: 'Yes, we have a referral program: when you create your account you get a unique link in your dashboard. Every brand that signs up through it is linked to you.',
    },
  },
  {
    id: 'cuenta',
    keywords: ['cuenta', 'registro', 'registrarme', 'login', 'ingresar', 'dashboard', 'account', 'sign up', 'register', 'google'],
    answer: {
      es: 'Podés crear tu cuenta en segundos con Google o con tu email desde el ícono de usuario arriba a la derecha. Ahí ves tus cotizaciones, tu plan y tu link de referidos.',
      en: 'You can create your account in seconds with Google or email from the user icon at the top right. There you see your quotes, your plan and your referral link.',
    },
  },
  {
    id: 'contacto',
    keywords: ['contacto', 'whatsapp', 'telefono', 'teléfono', 'email', 'correo', 'hablar con alguien', 'humano', 'persona', 'contact', 'phone', 'human', 'someone'],
    answer: {
      es: 'Podés escribirnos por WhatsApp al (+57) 313 6380121, o a info@easycomex.com. Si querés, te dejo el formulario de contacto acá abajo.',
      en: 'You can reach us on WhatsApp at (+57) 313 6380121, or at info@easycomex.com. I can also take you to the contact form below.',
    },
    action: 'contacto',
  },
  {
    id: 'gracias',
    keywords: ['gracias', 'thanks', 'thank you', 'genial', 'perfecto', 'ok'],
    answer: {
      es: 'De nada. Cuando quieras seguimos trazando la ruta.',
      en: 'Anytime. Whenever you are ready we keep charting the route.',
    },
  },
];

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Palabras sueltas, sin acentos, sin signos: "¿Cuánto cuesta?" -> ['cuanto','cuesta']. */
const tokenize = (s: string) =>
  normalize(s)
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);

const tokenCache = new Map<string, string[]>();
const keywordTokens = (keyword: string) => {
  let tokens = tokenCache.get(keyword);
  if (!tokens) {
    tokens = tokenize(keyword);
    tokenCache.set(keyword, tokens);
  }
  return tokens;
};

// Con menos de esto, un prefijo no dice nada: "ok" sería el principio de
// "okupa" y de "okey". Desde cinco letras sí: "precio" y "precios",
// "tendencia" y "tendencias", "exporta" y "exportar".
const MIN_PREFIX = 5;

const tokenMatches = (keywordToken: string, queryToken: string) => {
  if (keywordToken === queryToken) return true;
  if (keywordToken.length < MIN_PREFIX || queryToken.length < MIN_PREFIX) return false;
  return queryToken.startsWith(keywordToken) || keywordToken.startsWith(queryToken);
};

/** ¿Aparece la palabra (o la frase completa, seguida) dentro de la consulta? */
const keywordHits = (keyword: string[], query: string[]) => {
  if (keyword.length === 0 || keyword.length > query.length) return false;
  for (let i = 0; i <= query.length - keyword.length; i++) {
    let all = true;
    for (let j = 0; j < keyword.length; j++) {
      if (!tokenMatches(keyword[j], query[i + j])) {
        all = false;
        break;
      }
    }
    if (all) return true;
  }
  return false;
};

/**
 * Elige la entrada que mejor responde a la pregunta.
 *
 * Compara PALABRAS, no subcadenas. La versión anterior preguntaba
 * `q.includes(keyword)`, y con eso la palabra clave "ok" —de la respuesta
 * "de nada"— coincidía dentro de "tik tok": a quien escribía "mejores
 * productos que se vendan en tik tok" le contestaba "De nada. Cuando
 * quieras seguimos trazando la ruta." Pasó de verdad, con un cliente
 * mirando.
 *
 * Gana quien coincide en más palabras, así que una frase ("mas vendidos")
 * pesa más que una palabra suelta. A igualdad de palabras gana la
 * coincidencia más larga —la más específica—, y si aun así empatan, la
 * entrada que va primero en la lista.
 */
export function matchKnowledge(query: string): KnowledgeEntry | null {
  const q = tokenize(query);
  if (q.length === 0) return null;

  let best: { entry: KnowledgeEntry; words: number; chars: number } | null = null;

  for (const entry of knowledgeBase) {
    let words = 0;
    let chars = 0;
    // Sin acentos, "cuánto" y "cuanto" son la misma clave: contarla dos
    // veces inflaría la entrada frente a las demás.
    const counted = new Set<string>();

    for (const keyword of entry.keywords) {
      const tokens = keywordTokens(keyword);
      const key = tokens.join(' ');
      if (counted.has(key)) continue;
      if (!keywordHits(tokens, q)) continue;
      counted.add(key);
      words += tokens.length;
      chars += key.length;
    }

    if (words === 0) continue;
    if (!best || words > best.words || (words === best.words && chars > best.chars)) {
      best = { entry, words, chars };
    }
  }

  return best?.entry ?? null;
}

// ---------------------------------------------------------------------
// Qué ofrecer después de cada respuesta.
//
// Un chat que contesta y se calla obliga a la persona a inventar la
// siguiente pregunta, y casi nadie la inventa: se va. Cada respuesta
// deja dos caminos abiertos, elegidos a mano según lo que de verdad
// viene después — quien pregunta por fletes está pensando en números, no
// en el programa de referidos.
// ---------------------------------------------------------------------

export interface QuickReply {
  label: string;
  /** Lo que se "escribe" al tocarlo. Un `__comando__` o una pregunta. */
  value: string;
}

const CHIPS: Record<string, { es: QuickReply; en: QuickReply }> = {
  empezar: {
    es: { label: '¿Cómo empiezo?', value: 'como empiezo' },
    en: { label: 'How do I start?', value: 'how do i start' },
  },
  precio: {
    es: { label: '¿Cuánto cuesta?', value: 'cuanto cuesta' },
    en: { label: 'How much is it?', value: 'how much does it cost' },
  },
  roi: {
    es: { label: 'Calcular mi ROI', value: 'calculadora roi' },
    en: { label: 'Work out my ROI', value: 'roi calculator' },
  },
  logistica: {
    es: { label: 'Cotizar un flete', value: 'cuanto cuesta el flete' },
    en: { label: 'Quote a shipment', value: 'shipping cost' },
  },
  inteligencia: {
    es: { label: '¿Qué se vende más?', value: 'que se vende mas' },
    en: { label: 'What sells best?', value: 'what sells best' },
  },
  // Estos dos no preguntan: BUSCAN. La respuesta sobre inteligencia de
  // mercado terminaba ofreciendo "crear cuenta" y "consultoría", o sea
  // más conversación, y quien preguntaba se quedaba sin el dato. Estos
  // valores los entiende el chat como una orden de consultar.
  buscar_tiktok: {
    es: { label: 'Buscar en TikTok Shop', value: '__research:tiktok__' },
    en: { label: 'Search TikTok Shop', value: '__research:tiktok__' },
  },
  buscar_aduanas: {
    es: { label: 'Buscar en aduanas', value: '__research:aduanas__' },
    en: { label: 'Search customs data', value: '__research:aduanas__' },
  },
  canales: {
    es: { label: '¿Amazon o TikTok Shop?', value: 'amazon tiktok shop canales' },
    en: { label: 'Amazon or TikTok Shop?', value: 'amazon tiktok shop channels' },
  },
  consultoria: {
    es: { label: 'Agendar una llamada', value: 'agendar llamada' },
    en: { label: 'Book a call', value: 'book a call' },
  },
  cuenta: {
    es: { label: 'Crear mi cuenta', value: '__register__' },
    en: { label: 'Create my account', value: '__register__' },
  },
  humano: {
    es: { label: 'Hablar con una persona', value: '__human__' },
    en: { label: 'Talk to a person', value: '__human__' },
  },
};

/** Dos sugerencias por respuesta: más es un menú, y un menú no se lee. */
const AFTER: Record<string, string[]> = {
  'quien-eres': ['inteligencia', 'empezar'],
  servicios: ['precio', 'empezar'],
  empezar: ['precio', 'consultoria'],
  roi: ['logistica', 'precio'],
  precio: ['empezar', 'consultoria'],
  pago: ['empezar', 'humano'],
  'amazon-tiktok': ['buscar_tiktok', 'inteligencia'],
  'prep-center': ['logistica', 'precio'],
  inteligencia: ['buscar_tiktok', 'buscar_aduanas'],
  logistica: ['roi', 'precio'],
  tiempo: ['empezar', 'consultoria'],
  consultoria: ['precio', 'inteligencia'],
  referidos: ['cuenta', 'humano'],
  cuenta: ['inteligencia', 'empezar'],
  contacto: ['consultoria', 'empezar'],
  gracias: ['empezar', 'inteligencia'],
};

export function followUpsFor(entryId: string, language: 'es' | 'en'): QuickReply[] {
  return (AFTER[entryId] ?? []).map((chip) => CHIPS[chip][language]).filter(Boolean);
}
