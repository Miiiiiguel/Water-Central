import { motion } from 'framer-motion';
import { Landmark, LineChart, ArrowRight, Sparkles, Search } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSpotlight } from '@/lib/useSpotlight';
import { requestResearch, type ResearchRequest, type ResearchSource } from '@/lib/research';

// "Inteligencia de mercado": the section that sells what Marco Polo can
// actually look up, and lets a visitor try it with one click.
//
// The example questions are real queries — clicking one opens Marco Polo
// already in research mode with that question loaded, which is the free
// sample. Nothing here shows numbers: the data only ever comes back from
// the live source, and if a source is not connected Marco Polo says so.

interface Example {
  source: ResearchSource;
  question: { es: string; en: string };
  /** The term actually sent to the provider (a question is not a query). */
  query: string;
}

const examples: Example[] = [
  {
    source: 'aduanas',
    question: {
      es: '¿Qué empresas colombianas importan zapatos?',
      en: 'Which Colombian companies import shoes?',
    },
    query: 'zapatos',
  },
  {
    source: 'tiktok',
    question: {
      es: 'Los jeans más vendidos en TikTok Shop Estados Unidos',
      en: 'Best-selling jeans on TikTok Shop United States',
    },
    query: 'jeans',
  },
  {
    source: 'aduanas',
    question: {
      es: '¿Cuánto café se exporta a Estados Unidos y quién lo compra?',
      en: 'How much coffee is exported to the US, and who buys it?',
    },
    query: 'cafe',
  },
  {
    source: 'tiktok',
    question: {
      es: '¿Qué marcas de cosmética natural están creciendo?',
      en: 'Which natural cosmetics brands are growing?',
    },
    query: 'cosmetica natural',
  },
];

const sources = [
  {
    id: 'aduanas' as const,
    icon: Landmark,
    name: { es: 'Aduanas oficiales', en: 'Official customs' },
    body: {
      es: 'Registros reales de importación y exportación: quién compra, quién vende, cuánto y a qué precio, país por país.',
      en: 'Real import and export records: who buys, who sells, how much and at what price, country by country.',
    },
  },
  {
    id: 'tiktok' as const,
    icon: LineChart,
    name: { es: 'Inteligencia de marketplaces', en: 'Marketplace intelligence' },
    body: {
      es: 'Qué se está vendiendo hoy en TikTok Shop y Amazon: productos, precios, creadores y competencia.',
      en: 'What is selling today on TikTok Shop and Amazon: products, prices, creators and competitors.',
    },
  },
];

export default function MarketIntelSection() {
  const { language } = useLanguage();
  const spotlight = useSpotlight();
  const es = language === 'es';

  const ask = (example: Example) => {
    const detail: ResearchRequest = {
      source: example.source,
      query: example.query,
      question: es ? example.question.es : example.question.en,
    };
    requestResearch(detail);
  };

  return (
    <section id="inteligencia" className="py-20 md:py-28 bg-white relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-10 left-1/4 w-96 h-96 bg-orange-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl" />
      </div>

      <div className="container relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-3xl mx-auto mb-12 md:mb-14"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500/10 border border-orange-500/30 rounded-full mb-6">
            <Sparkles size={16} className="text-orange-600" />
            <span className="text-orange-700 font-semibold text-sm">
              {es ? 'Inteligencia de mercado' : 'Market intelligence'}
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-primary mb-5 leading-tight">
            {es ? 'Todo lo que necesitas para conocer el' : 'Everything you need to know the'}
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-orange-600">
              {es ? 'mercado internacional' : 'international market'}
            </span>
          </h2>
          <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
            {es
              ? 'Contamos con las mejores fuentes de aduanas oficiales e inteligencia de mercado de los principales países del mundo. Sin adivinar y sin pagar cinco suscripciones distintas.'
              : 'We work with the best official customs sources and market intelligence across the world’s main countries. No guessing, and no paying for five separate subscriptions.'}
          </p>
        </motion.div>

        {/* What the two kinds of source actually give you */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-4xl mx-auto mb-12">
          {sources.map((source, i) => {
            const Icon = source.icon;
            return (
              <motion.div
                key={source.id}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                {...spotlight}
                className="card-spotlight rounded-3xl border border-gray-100 bg-white app-shadow p-6 hover:shadow-premium-lg transition-shadow"
              >
                <span className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-indigo-950 text-white flex items-center justify-center mb-4">
                  <Icon size={22} />
                </span>
                <h3 className="font-bold text-primary text-lg mb-2">{es ? source.name.es : source.name.en}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{es ? source.body.es : source.body.en}</p>
              </motion.div>
            );
          })}
        </div>

        {/* The free sample: real questions, one tap away */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl mx-auto rounded-3xl border border-gray-100 bg-gradient-to-b from-gray-50 to-white app-shadow p-6 md:p-8"
        >
          <div className="flex items-center gap-2 mb-1.5">
            <Search size={16} className="text-accent" />
            <h3 className="font-bold text-primary">
              {es ? 'Pruébalo gratis ahora mismo' : 'Try it free right now'}
            </h3>
          </div>
          <p className="text-sm text-muted-foreground mb-5">
            {es
              ? 'Toca una pregunta y Marco Polo la busca en la fuente. Tienes consultas gratis todos los días con solo crear tu cuenta.'
              : 'Tap a question and Marco Polo looks it up at the source. You get free lookups every day just for creating your account.'}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {examples.map((example) => (
              <button
                key={example.question.es}
                onClick={() => ask(example)}
                className="tap-scale group text-left rounded-2xl border border-gray-200 hover:border-accent bg-white p-4 cursor-pointer transition-colors flex items-start gap-3"
              >
                <span className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-xl bg-secondary text-accent flex items-center justify-center group-hover:bg-accent group-hover:text-white transition-colors">
                  {example.source === 'aduanas' ? <Landmark size={15} /> : <LineChart size={15} />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground leading-snug">
                    {es ? example.question.es : example.question.en}
                  </span>
                  <span className="block text-[11px] font-bold uppercase tracking-wide text-muted-foreground mt-1">
                    {example.source === 'aduanas'
                      ? (es ? 'Aduanas' : 'Customs')
                      : (es ? 'Marketplaces' : 'Marketplaces')}
                  </span>
                </span>
                <ArrowRight size={16} className="ml-auto mt-1 flex-shrink-0 text-muted-foreground group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
              </button>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
