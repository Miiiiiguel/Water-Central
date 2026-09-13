import { Suspense, lazy, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Plane, Ship, Truck } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import GlobeFallback from './GlobeFallback';

// three.js + WebGL only ships to devices that can afford it. Phones and
// low-core machines get the CSS globe: same look, no jank, ~600 KB less JS.
const Globe3D = lazy(() => import('./Globe3D'));

function useLightweightGlobe(): boolean {
  return useMemo(() => {
    if (typeof window === 'undefined') return true;
    const small = window.matchMedia('(max-width: 640px)').matches;
    const cores = navigator.hardwareConcurrency ?? 4;
    const memory = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 4;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    return small || cores <= 2 || memory <= 2 || reduced;
  }, []);
}

export default function GlobalReachSection() {
  const { language } = useLanguage();
  const lightweight = useLightweightGlobe();

  const modes = [
    { icon: Plane, label: language === 'es' ? 'Aéreo' : 'Air' },
    { icon: Ship, label: language === 'es' ? 'Marítimo' : 'Ocean' },
    { icon: Truck, label: language === 'es' ? 'Puerta a puerta' : 'Door-to-door' },
  ];

  return (
    <section className="py-20 md:py-28 bg-primary relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl"></div>
      </div>

      <div className="container relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7 }}
          className="order-2 lg:order-1 text-center lg:text-left"
        >
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-white mb-5">
            {language === 'es' ? 'Alcance verdaderamente' : 'Truly'}
            <span className="block text-accent">{language === 'es' ? 'internacional' : 'international reach'}</span>
          </h2>
          <p className="text-white/70 text-base md:text-lg mb-8 max-w-md mx-auto lg:mx-0">
            {language === 'es'
              ? '220 destinos conectados. Tu producto sale de Latinoamérica y llega a manos de tu cliente en Estados Unidos sin fricción.'
              : '220 connected destinations. Your product leaves Latin America and reaches your US customer without friction.'}
          </p>
          <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
            {modes.map((m) => {
              const Icon = m.icon;
              return (
                <span key={m.label} className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/10 border border-white/10 text-white text-sm font-bold">
                  <Icon size={16} />
                  {m.label}
                </span>
              );
            })}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.8 }}
          className="order-1 lg:order-2 h-72 sm:h-96 lg:h-[26rem]"
        >
          {lightweight ? (
            <GlobeFallback />
          ) : (
            <Suspense fallback={<GlobeFallback />}>
              <Globe3D className="w-full h-full" />
            </Suspense>
          )}
        </motion.div>
      </div>
    </section>
  );
}
