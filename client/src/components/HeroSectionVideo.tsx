import { motion } from 'framer-motion';
import { scrollToAnchor } from '@/lib/scrollToAnchor';
import { Button } from '@/components/ui/button';
import { PenLine, PlayCircle, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import FloatingProductCards from './FloatingProductCards';

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

// Dark, cinematic hero: deep navy with an orange aurora, big type, glass
// controls. The rest of the page stays light — the contrast is the point.
export default function HeroSectionVideo() {
  const { t } = useLanguage();

  const scrollTo = (id: string) => scrollToAnchor(`#${id}`);

  return (
    <section className="relative w-full overflow-hidden bg-primary text-white -mt-16 md:-mt-20 pt-36 pb-36 md:pt-48 md:pb-48">
      <div className="absolute inset-0 hero-sky" aria-hidden="true" />
      <div className="aurora aurora-dark" aria-hidden="true" />
      <div className="dot-grid dot-grid-light" aria-hidden="true" />
      <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-b from-transparent to-white pointer-events-none" aria-hidden="true" />

      <FloatingProductCards />

      <div className="relative z-10 px-4 md:px-12 lg:px-16">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2.5 bg-white/10 backdrop-blur-md rounded-2xl border border-white/15 pl-2 pr-4 py-2 mb-8"
          >
            <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center flex-shrink-0 shadow-glow">
              <PenLine size={16} className="text-white" strokeWidth={2.5} />
            </span>
            <span className="text-white/90 font-bold text-xs md:text-sm text-left">{t('hero.badge')}</span>
          </motion.div>

          <h1
            className="text-[2.6rem] sm:text-6xl md:text-7xl lg:text-[5.25rem] font-black mb-7 leading-[1.05] md:leading-[1.02]"
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
            className="text-base sm:text-lg md:text-xl text-white/70 mb-10 max-w-2xl mx-auto leading-relaxed"
          >
            {t('hero.subtitle')}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1.05 }}
            className="flex flex-col sm:flex-row gap-3 justify-center"
          >
            <Button
              onClick={() => scrollTo('planes')}
              className="btn-shine tap-scale rounded-full bg-accent hover:bg-accent/90 text-white px-8 py-7 text-base font-bold border-0 shadow-glow-lg hover:shadow-glow-xl transition-all duration-300 hover:scale-105 flex items-center justify-center gap-2 w-full sm:w-auto group"
            >
              {t('hero.cta1')}
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button
              onClick={() => scrollTo('vsl')}
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
            transition={{ duration: 0.8, delay: 1.4 }}
            className="mt-12 flex items-center justify-center gap-6 text-xs text-white/50 font-semibold uppercase tracking-widest"
          >
            <span>Amazon</span>
            <span className="w-1 h-1 rounded-full bg-accent" />
            <span>TikTok Shop</span>
            <span className="w-1 h-1 rounded-full bg-accent" />
            <span>Shopify</span>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
