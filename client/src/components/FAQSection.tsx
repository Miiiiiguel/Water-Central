import { useLanguage } from '@/contexts/LanguageContext';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const faqs: { q: { es: string; en: string }; a: { es: string; en: string } }[] = [
  {
    q: { es: '¿A qué marcas ayuda Easycomex?', en: 'Which brands does Easycomex help?' },
    a: {
      es: 'Trabajamos con marcas latinoamericanas que ya venden y quieren expandirse al mercado de Estados Unidos a través de Amazon, TikTok Shop y Shopify.',
      en: 'We work with Latin American brands that already sell and want to expand into the US market through Amazon, TikTok Shop and Shopify.',
    },
  },
  {
    q: { es: '¿Cómo empiezo?', en: 'How do I get started?' },
    a: {
      es: 'Empieza con un diagnóstico gratuito de tu situación actual. Con base en eso te proponemos un plan de crecimiento y, si lo necesitas, un análisis de mercado y competencia.',
      en: 'You start with a free diagnosis of your current situation. Based on that, we propose a growth plan and, if needed, a market and competitor analysis.',
    },
  },
  {
    q: { es: '¿Manejan la logística de mis envíos a USA?', en: 'Do you handle the logistics of my shipments to the US?' },
    a: {
      es: 'Sí. Ofrecemos logística internacional puerta a puerta (aérea y marítima) y un Prep Center en USA que recibe, inspecciona, etiqueta y envía tus productos a FBA o a tus clientes finales.',
      en: 'Yes. We offer door-to-door international logistics (air and ocean) and a US Prep Center that receives, inspects, labels and ships your products to FBA or your end customers.',
    },
  },
  {
    q: { es: '¿Cuánto tiempo toma ver resultados?', en: 'How long does it take to see results?' },
    a: {
      es: 'Depende del canal y del punto de partida de tu marca. Por eso empezamos siempre con un diagnóstico y un plan de acción con metas y tiempos claros.',
      en: 'It depends on the channel and your brand’s starting point. That is why we always start with a diagnosis and an action plan with clear goals and timelines.',
    },
  },
  {
    q: { es: '¿Qué incluye la consultoría gratuita de 30 minutos?', en: 'What does the free 30-minute consultation include?' },
    a: {
      es: 'Una llamada con un especialista donde revisamos tu producto, tu oportunidad en el mercado americano y los próximos pasos recomendados. Sin compromiso.',
      en: 'A call with a specialist where we review your product, your opportunity in the US market and the recommended next steps. No obligation.',
    },
  },
];

export default function FAQSection() {
  const { language } = useLanguage();

  return (
    <section id="faq" className="py-16 md:py-24 lg:py-32 bg-white relative overflow-hidden">
      <div className="container relative z-10 max-w-3xl">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-primary mb-3 md:mb-4">
            {language === 'es' ? 'Preguntas frecuentes' : 'Frequently asked questions'}
          </h2>
        </div>

        <Accordion type="single" collapsible className="bg-white rounded-xl border border-gray-200 px-6 shadow-premium">
          {faqs.map((faq, index) => (
            <AccordionItem key={index} value={`faq-${index}`}>
              <AccordionTrigger className="text-base md:text-lg font-semibold text-foreground">
                {language === 'es' ? faq.q.es : faq.q.en}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed">
                {language === 'es' ? faq.a.es : faq.a.en}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
