// Rule-based knowledge base for the guide chatbot. Works with zero
// external dependencies — this is what powers the bot when no AI
// backend is configured (see server/chat.ts), and it's also what
// grounds the AI backend's system prompt so it never drifts from what
// Easycomex actually offers.

export interface KnowledgeEntry {
  id: string;
  keywords: string[];
  answer: { es: string; en: string };
}

export const knowledgeBase: KnowledgeEntry[] = [
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
    keywords: ['empezar', 'comenzar', 'como empiezo', 'primer paso', 'start', 'get started', 'how do i begin'],
    answer: {
      es: 'Lo más fácil es empezar con el diagnóstico gratuito de tu situación actual. Con eso te proponemos un plan de crecimiento y, si lo necesitas, un análisis de mercado. Te llevo a la sección de planes.',
      en: 'The easiest way is to start with the free diagnosis of your current situation. From there we propose a growth plan and, if needed, a market analysis. Let me take you to the plans section.',
    },
  },
  {
    id: 'precio',
    keywords: ['precio', 'cuesta', 'cuanto', 'costo', 'tarifa', 'price', 'cost', 'how much'],
    answer: {
      es: 'El diagnóstico básico es gratis. El diagnóstico de madurez cuesta USD 6.90. El plan de crecimiento es a medida según tu marca. El análisis de mercado y competencia en Amazon/TikTok Shop cuesta USD 499 e incluye 2 horas de asesoría 1 a 1.',
      en: 'The basic diagnosis is free. The maturity diagnosis costs USD 6.90. The growth plan is custom-priced for your brand. The market & competitor analysis on Amazon/TikTok Shop costs USD 499 and includes 2 hours of 1-on-1 advisory.',
    },
  },
  {
    id: 'amazon-tiktok',
    keywords: ['amazon', 'tiktok', 'shopify', 'canal', 'canales', 'vender en', 'channel'],
    answer: {
      es: 'Sí, te ayudamos a vender en Amazon (incluye FBA vía nuestro Prep Center en USA), TikTok Shop y Shopify, con estrategia de contenido y pauta para cada canal.',
      en: 'Yes, we help you sell on Amazon (including FBA through our US Prep Center), TikTok Shop and Shopify, with content and ad strategy for each channel.',
    },
  },
  {
    id: 'logistica',
    keywords: ['logistica', 'envio', 'flete', 'aduana', 'shipping', 'freight', 'customs'],
    answer: {
      es: 'Ofrecemos logística internacional puerta a puerta, aérea y marítima, a 220 destinos. Podés usar la calculadora de fletes en el sitio para una tarifa estimada.',
      en: 'We offer door-to-door international logistics, air and ocean, to 220 destinations. You can use the freight calculator on the site for an estimated rate.',
    },
  },
  {
    id: 'tiempo',
    keywords: ['tiempo', 'cuanto tarda', 'cuando', 'resultados', 'how long', 'timeline'],
    answer: {
      es: 'Depende del canal y del punto de partida de tu marca. Por eso siempre empezamos con un diagnóstico y un plan de acción con metas y tiempos claros.',
      en: "It depends on the channel and your brand's starting point. That's why we always start with a diagnosis and an action plan with clear goals and timelines.",
    },
  },
  {
    id: 'consultoria',
    keywords: ['consultoria', 'llamada', 'agendar', 'reunion', 'consulting', 'call', 'schedule', 'meeting'],
    answer: {
      es: 'Podés agendar 20-30 minutos de consultoría gratis con nuestros especialistas — sin compromiso. El botón está en la sección de consultoría del sitio.',
      en: 'You can book a free 20-30 minute consultation with our specialists — no commitment. The button is in the consultation section of the site.',
    },
  },
  {
    id: 'contacto',
    keywords: ['contacto', 'whatsapp', 'telefono', 'email', 'correo', 'hablar con alguien', 'humano', 'contact', 'phone', 'human'],
    answer: {
      es: 'Podés escribirnos por WhatsApp al (+57) 313 6380121, o a info@easycomex.com.',
      en: 'You can reach us on WhatsApp at (+57) 313 6380121, or at info@easycomex.com.',
    },
  },
];

export function matchKnowledge(query: string): KnowledgeEntry | null {
  const q = query.toLowerCase();
  let best: { entry: KnowledgeEntry; score: number } | null = null;
  for (const entry of knowledgeBase) {
    const score = entry.keywords.filter((k) => q.includes(k)).length;
    if (score > 0 && (!best || score > best.score)) best = { entry, score };
  }
  return best?.entry ?? null;
}
