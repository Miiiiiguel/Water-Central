import { useLanguage } from '@/contexts/LanguageContext';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const faqs: { q: { es: string; en: string }; a: { es: string; en: string } }[] = [
  {
    q: { es: '¿A qué marcas ayuda Easycomex?', en: 'Which brands does Easycomex help?' },
    a: {
      es: 'Marcas que ya venden y quieren salir de su mercado local. Estados Unidos, Europa, México, Medio Oriente: donde el producto valga más. Si todavía no vendes nada, no somos para ti todavía.',
      en: 'Brands that already sell and want out of their local market. The US, Europe, Mexico, the Middle East \u2014 wherever the product is worth more. If you are not selling anything yet, we are not for you yet.',
    },
  },
  {
    q: { es: '¿Cómo empiezo?', en: 'How do I get started?' },
    a: {
      es: 'Diagnóstico gratis. Si hay oportunidad, te armamos el plan con números; si no la hay, te lo decimos y no pierdes más tiempo.',
      en: 'Free diagnosis. If there is an opportunity we build the plan with numbers; if there is not, we say so and you stop wasting time.',
    },
  },
  {
    q: { es: '¿Manejan la logística de mis envíos?', en: 'Do you handle my shipping logistics?' },
    a: {
      es: 'Sí. Puerta a puerta, aéreo y marítimo, a 220 destinos en el mundo. Y un Prep Center propio en USA que recibe, inspecciona, etiqueta y despacha a FBA o a tu cliente final.',
      en: 'Yes. Door to door, air and ocean, to 220 destinations worldwide. Plus our own US Prep Center that receives, inspects, labels and ships to FBA or your end customer.',
    },
  },
  {
    q: { es: '¿Cuánto tiempo toma ver resultados?', en: 'How long does it take to see results?' },
    a: {
      es: 'Depende del canal y de dónde arrancas. Nadie serio te da una fecha sin ver tus números: por eso el diagnóstico va primero, con metas y tiempos escritos.',
      en: 'It depends on the channel and where you start. Nobody serious gives you a date without seeing your numbers: that is why the diagnosis comes first, with goals and timelines in writing.',
    },
  },
  {
    q: { es: '¿Qué incluye la consultoría gratuita de 30 minutos?', en: 'What does the free 30-minute consultation include?' },
    a: {
      es: 'Una llamada con un especialista: revisamos tu producto, en qué países tiene sentido y qué sigue. Sin compromiso y sin presentación de 40 slides.',
      en: 'A call with a specialist: we review your product, which countries make sense and what comes next. No obligation and no 40-slide deck.',
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

        <Accordion type="single" collapsible className="bg-white rounded-3xl border border-gray-100 px-6 app-shadow">
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
