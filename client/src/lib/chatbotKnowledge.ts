// Rule-based knowledge base for Marco Polo, the guide chatbot. Works
// with zero external dependencies — this is what powers him when no AI
// backend is configured (see server/chat.ts), and it's also what grounds
// the AI backend's system prompt so it never drifts from what Easycomex
// actually offers.

export type SectionAction = 'planes' | 'calculadora' | 'contacto' | 'pronostico' | 'vsl';

export interface KnowledgeEntry {
  id: string;
  keywords: string[];
  answer: { es: string; en: string };
  // When matched on the home page, Marco Polo scrolls the user there.
  action?: SectionAction;
}

export const MARCO_POLO = {
  name: 'Marco Polo',
  tagline: { es: 'Tu guía para vender en USA', en: 'Your guide to selling in the US' },
  greeting: {
    es: '¡Hola! Soy Marco Polo, tu guía de Easycomex. Abrí rutas comerciales hace 700 años y ahora ayudo a marcas como la tuya a llegar a Estados Unidos. ¿Por dónde empezamos?',
    en: "Hi! I'm Marco Polo, your Easycomex guide. I opened trade routes 700 years ago and now I help brands like yours reach the United States. Where do we start?",
  },
  nudge: {
    es: '¿Te ayudo a vender en Estados Unidos?',
    en: 'Want help selling in the US?',
  },
  fallback: {
    es: 'Esa ruta todavía no la tengo mapeada, pero un especialista del equipo sí — te paso con ellos por WhatsApp.',
    en: "I haven't mapped that route yet, but a specialist on the team has — let me hand you over on WhatsApp.",
  },
};

export const knowledgeBase: KnowledgeEntry[] = [
  {
    id: 'quien-eres',
    keywords: ['quien eres', 'quién eres', 'marco polo', 'que eres', 'eres un bot', 'who are you', 'what are you'],
    answer: {
      es: 'Soy Marco Polo, el asistente de Easycomex. Respondo dudas sobre cómo vender en Estados Unidos, precios, logística y por dónde empezar. Si necesitás algo más específico, te conecto con una persona del equipo.',
      en: "I'm Marco Polo, Easycomex's assistant. I answer questions about selling in the US, pricing, logistics and where to start. If you need something more specific, I'll connect you with a person on the team.",
    },
  },
  {
    id: 'servicios',
    keywords: ['servicio', 'ofrecen', 'hacen', 'ayudan', 'que hacen', 'services', 'what do you do'],
    answer: {
      es: 'Ayudamos a marcas latinoamericanas a vender en Estados Unidos: nuevos canales de venta (Amazon, TikTok Shop, Shopify), logística internacional puerta a puerta, Prep Center en USA, estrategia ecommerce, inteligencia de mercado y análisis de tu oportunidad.',
      en: 'We help Latin American brands sell in the United States: new sales channels (Amazon, TikTok Shop, Shopify), door-to-door international logistics, a US Prep Center, ecommerce strategy, market intelligence, and opportunity analysis.',
    },
  },
  {
    id: 'empezar',
    keywords: ['empezar', 'comenzar', 'como empiezo', 'primer paso', 'start', 'get started', 'how do i begin', 'begin'],
    answer: {
      es: 'Lo más fácil es empezar con el diagnóstico gratuito de tu situación actual. Con eso te proponemos un plan de crecimiento y, si lo necesitás, un análisis de mercado. Te llevo a los planes.',
      en: 'The easiest way is to start with the free diagnosis of your current situation. From there we propose a growth plan and, if needed, a market analysis. Let me take you to the plans.',
    },
    action: 'planes',
  },
  {
    id: 'precio',
    keywords: ['precio', 'cuesta', 'cuanto', 'cuánto', 'costo', 'tarifa', 'price', 'cost', 'how much', 'pricing'],
    answer: {
      es: 'El diagnóstico básico es gratis. El diagnóstico de madurez cuesta USD 6.90. El plan de crecimiento es a medida según tu marca. El análisis de mercado y competencia en Amazon/TikTok Shop cuesta USD 499 e incluye 2 horas de asesoría 1 a 1.',
      en: 'The basic diagnosis is free. The maturity diagnosis costs USD 6.90. The growth plan is custom-priced for your brand. The market & competitor analysis on Amazon/TikTok Shop costs USD 499 and includes 2 hours of 1-on-1 advisory.',
    },
    action: 'planes',
  },
  {
    id: 'pago',
    keywords: ['pagar', 'pago', 'tarjeta', 'stripe', 'metodo de pago', 'método de pago', 'pay', 'payment', 'card'],
    answer: {
      es: 'Los pagos se hacen con tarjeta a través de Stripe, en dólares, en una página segura. Apenas se confirma el pago, tu plan aparece en tu dashboard y el equipo te contacta en menos de 24 horas.',
      en: 'Payments are made by card through Stripe, in US dollars, on a secure page. As soon as it clears, your plan shows up in your dashboard and the team reaches out within 24 hours.',
    },
  },
  {
    id: 'amazon-tiktok',
    keywords: ['amazon', 'tiktok', 'shopify', 'canal', 'canales', 'vender en', 'channel', 'marketplace', 'fba'],
    answer: {
      es: 'Sí, te ayudamos a vender en Amazon (incluye FBA vía nuestro Prep Center en USA), TikTok Shop y Shopify, con estrategia de contenido y pauta para cada canal.',
      en: 'Yes, we help you sell on Amazon (including FBA through our US Prep Center), TikTok Shop and Shopify, with content and ad strategy for each channel.',
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
    id: 'logistica',
    keywords: ['logistica', 'logística', 'envio', 'envío', 'flete', 'aduana', 'shipping', 'freight', 'customs', 'importar', 'exportar'],
    answer: {
      es: 'Ofrecemos logística internacional puerta a puerta, aérea y marítima, a 220 destinos. Te llevo a la calculadora de fletes para una tarifa estimada.',
      en: 'We offer door-to-door international logistics, air and ocean, to 220 destinations. Let me take you to the freight calculator for an estimated rate.',
    },
    action: 'calculadora',
  },
  {
    id: 'tiempo',
    keywords: ['tiempo', 'cuanto tarda', 'cuánto tarda', 'cuando', 'cuándo', 'resultados', 'how long', 'timeline', 'when'],
    answer: {
      es: 'Depende del canal y del punto de partida de tu marca. Por eso siempre empezamos con un diagnóstico y un plan de acción con metas y tiempos claros.',
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
      es: '¡Con gusto! Cuando quieras seguimos trazando la ruta hacia Estados Unidos.',
      en: 'Anytime! Whenever you\'re ready we keep charting the route to the US.',
    },
  },
];

const normalize = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function matchKnowledge(query: string): KnowledgeEntry | null {
  const q = normalize(query);
  let best: { entry: KnowledgeEntry; score: number } | null = null;
  for (const entry of knowledgeBase) {
    const score = entry.keywords.filter((k) => q.includes(normalize(k))).length;
    if (score > 0 && (!best || score > best.score)) best = { entry, score };
  }
  return best?.entry ?? null;
}
