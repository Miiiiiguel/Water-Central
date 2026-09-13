import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { PenLine, PlayCircle, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import FloatingProductCards from './FloatingProductCards';

// Title lines reveal word by word — one of the cheapest ways a page
// stops feeling static without loading a video.
function RevealWords({ text, className = '', delay = 0 }: { text: string; className?: string; delay?: number }) {
  const words = text.split(' ');
  return (
    <span className={`block ${className}`}>
      {words.map((word, i) => (
        <motion.span
          key={`${word}-${i}`}
          className="inline-block mr-[0.25em]"
          initial={{ opacity: 0, y: 18, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.55, delay: delay + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
        >
          {word}
        </motion.span>
      ))}
    </span>
  );
}

export default function HeroSectionVideo() {
  const { t } = useLanguage();

  const scrollTo = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <section className="relative w-full overflow-hidden bg-white pt-16 pb-28 md:pt-24 md:pb-36">
      <div className="aurora" aria-hidden="true" />
      <div className="dot-grid" aria-hidden="true" />

      <FloatingProductCards />

      <div className="relative z-10 px-4 md:px-12 lg:px-16">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2.5 bg-white/90 backdrop-blur rounded-2xl app-shadow border border-gray-100 pl-2 pr-4 py-2 mb-8"
          >
            <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center flex-shrink-0 shadow-glow">
              <PenLine size={16} className="text-white" strokeWidth={2.5} />
            </span>
            <span className="text-primary font-bold text-xs md:text-sm text-left">{t('hero.badge')}</span>
          </motion.div>

          <h1
            className="text-4xl sm:text-5xl md:text-6xl font-black text-primary mb-6 leading-[1.08]"
            style={{ letterSpacing: '-0.02em' }}
          >
            <RevealWords text={t('hero.title1')} delay={0.15} />
            <RevealWords text={t('hero.title2')} delay={0.35} />
            <RevealWords text={t('hero.title3')} delay={0.6} className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-accent to-orange-600" />
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.9 }}
            className="text-base sm:text-lg text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed"
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
              className="tap-scale rounded-full bg-accent hover:bg-accent/90 text-white px-7 py-6 text-base font-bold border-0 shadow-glow hover:shadow-glow-lg transition-all duration-300 hover:scale-105 flex items-center justify-center gap-2 w-full sm:w-auto group"
            >
              {t('hero.cta1')}
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button
              onClick={() => scrollTo('vsl')}
              variant="outline"
              className="tap-scale rounded-full border-2 border-primary/15 bg-white/70 backdrop-blur text-primary hover:bg-primary/5 px-7 py-6 text-base font-bold transition-all duration-300 hover:scale-105 w-full sm:w-auto flex items-center justify-center gap-2"
            >
              <PlayCircle size={18} />
              {t('hero.cta2')}
            </Button>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
