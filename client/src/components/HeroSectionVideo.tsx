import { motion } from 'framer-motion';
import { scrollToAnchor } from '@/lib/scrollToAnchor';
import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';
import { PenLine, PlayCircle, ArrowRight, Calculator, Ship, Globe2, FileSearch } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

// Title lines reveal word by word — one of the cheapest ways a page
// stops feeling static without loading a video.
// Gradient text must be applied per word: background-clip:text on the
// parent doesn't reach text inside inline-block children, which left the
// last title line invisible.
function RevealWords({ text, className = '', wordClassName = '', delay = 0 }: { text: string; className?: string; wordClassName?: string; delay?: number }) {
  const words = text.split(' ');
  return (
    <span className={`block ${className}`}>
      {words.map((word, i) => (
        <motion.span
          key={`${word}-${i}`}
          className={`inline-block mr-[0.25em] ${wordClassName}`}
          initial={{ opacity: 0, y: 22, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.6, delay: delay + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
        >
          {word}
        </motion.span>
      ))}
    </span>
  );
}

interface Herramienta {
  icon: typeof Calculator;
  titulo: { es: string; en: string };
  texto: { es: string; en: string };
  href: string;
}

// Las herramientas que de verdad tiene la plataforma, a un toque desde el
// banner. Reemplazan a las tarjetas flotantes que se ponían encima del
// contenido: esto es parte del diseño, no una ventana que tapa.
const HERRAMIENTAS: Herramienta[] = [
  {
    icon: Calculator,
    titulo: { es: 'Calculadora ROI', en: 'ROI calculator' },
    texto: { es: 'Tu retorno mes a mes, con tus números', en: 'Your month-by-month return, with your numbers' },
    href: '/roi',
  },
  {
    icon: Ship,
    titulo: { es: 'Fletes express', en: 'Express freight' },
    texto: { es: 'Hasta 45 % menos que la tarifa pública', en: 'Up to 45% off the public rate' },
    href: '#calculadora',
  },
  {
    icon: Globe2,
    titulo: { es: 'Inteligencia de mercado', en: 'Market intelligence' },
    texto: { es: 'Qué se vende en TikTok Shop y Amazon', en: 'What sells on TikTok Shop and Amazon' },
    href: '#inteligencia',
  },
  {
    icon: FileSearch,
    titulo: { es: 'Diagnóstico exportador', en: 'Export diagnosis' },
    texto: { es: '17 preguntas, 3 minutos, gratis', en: '17 questions, 3 minutes, free' },
    href: '/diagnostico',
  },
];

// Dark, cinematic hero: deep navy with an orange aurora, big type, glass
// controls. The rest of the page stays light — the contrast is the point.
// Two columns from lg up: the message on the left, the tools on the right.
export default function HeroSectionVideo() {
  const { t, language } = useLanguage();
  const [, navigate] = useLocation();
  const es = language === 'es';

  const ir = (href: string) => (href.startsWith('#') ? scrollToAnchor(href) : navigate(href));

  return (
    <section className="relative w-full overflow-hidden bg-primary text-white -mt-16 md:-mt-20 pt-32 pb-28 md:pt-40 md:pb-36">
      <div className="absolute inset-0 hero-sky" aria-hidden="true" />
      <div className="aurora aurora-dark" aria-hidden="true" />
      <div className="dot-grid dot-grid-light" aria-hidden="true" />
      <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-b from-transparent to-white pointer-events-none" aria-hidden="true" />

      <div className="relative z-10 container">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 lg:grid-cols-[1.25fr_0.75fr] lg:gap-12">
          <div className="text-center lg:text-left">
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: -8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2.5 bg-white/10 backdrop-blur-md rounded-2xl border border-white/15 pl-2 pr-4 py-2 mb-7"
            >
              <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center flex-shrink-0 shadow-glow">
                <PenLine size={16} className="text-white" strokeWidth={2.5} />
              </span>
              <span className="text-white/90 font-bold text-xs md:text-sm text-left">{t('hero.badge')}</span>
            </motion.div>

            <h1
              className="text-[2.5rem] sm:text-6xl lg:text-[3.5rem] xl:text-[3.9rem] font-black mb-6 leading-[1.05] md:leading-[1.02]"
              style={{ letterSpacing: '-0.03em' }}
            >
              <RevealWords text={t('hero.title1')} delay={0.15} className="text-white" />
              <RevealWords text={t('hero.title2')} delay={0.35} className="text-white" />
              <RevealWords
                text={t('hero.title3')}
                delay={0.6}
                className="pb-2"
                wordClassName="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-accent to-orange-300"
              />
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.9 }}
              className="text-base sm:text-lg text-white/70 mb-9 max-w-xl mx-auto lg:mx-0 leading-relaxed"
            >
              {t('hero.subtitle')}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 1.05 }}
              className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start"
            >
              <Button
                onClick={() => scrollToAnchor('#planes')}
                className="btn-shine tap-scale rounded-full bg-accent hover:bg-accent/90 text-white px-8 py-7 text-base font-bold border-0 shadow-glow-lg hover:shadow-glow-xl transition-all duration-300 hover:scale-105 flex items-center justify-center gap-2 w-full sm:w-auto group"
              >
                {t('hero.cta1')}
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button
                onClick={() => scrollToAnchor('#vsl')}
                variant="outline"
                className="tap-scale rounded-full border-2 border-white/20 bg-white/5 backdrop-blur-md text-white hover:bg-white/10 hover:text-white px-8 py-7 text-base font-bold transition-all duration-300 hover:scale-105 w-full sm:w-auto flex items-center justify-center gap-2"
              >
                <PlayCircle size={18} />
                {t('hero.cta2')}
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 1.3 }}
              className="mt-9 flex flex-wrap items-center justify-center lg:justify-start gap-2"
            >
              <span className="mr-1 text-[11px] font-semibold uppercase tracking-widest text-white/45">{es ? 'Vende en' : 'Sell on'}</span>
              {['Amazon', 'TikTok Shop', 'Shopify'].map((canal) => (
                <span key={canal} className="rounded-full border border-white/12 bg-white/[0.06] px-3.5 py-1.5 text-xs font-bold text-white/80">
                  {canal}
                </span>
              ))}
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="relative"
          >
            <div className="absolute -inset-6 rounded-[2.5rem] bg-accent/20 blur-3xl" aria-hidden="true" />
            <div className="relative rounded-[1.75rem] border border-white/12 bg-white/[0.07] p-3 shadow-2xl backdrop-blur-xl">
              <p className="px-3 pb-2 pt-2 text-[11px] font-bold uppercase tracking-widest text-white/50">
                {es ? 'Tu caja de herramientas' : 'Your toolkit'}
              </p>
              <ul className="space-y-1.5">
                {HERRAMIENTAS.map((h) => (
                  <li key={h.href}>
                    <button
                      type="button"
                      onClick={() => ir(h.href)}
                      className="tap-scale-sm group flex w-full cursor-pointer items-center gap-3.5 rounded-2xl border border-transparent bg-white/[0.04] px-3.5 py-3 text-left transition-colors hover:border-white/15 hover:bg-white/[0.1]"
                    >
                      <span className="flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 shadow-glow">
                        <h.icon size={19} className="text-white" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-white">{es ? h.titulo.es : h.titulo.en}</span>
                        <span className="block text-xs text-white/60">{es ? h.texto.es : h.texto.en}</span>
                      </span>
                      <ArrowRight size={16} className="flex-none text-white/40 transition-transform group-hover:translate-x-0.5 group-hover:text-white" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
