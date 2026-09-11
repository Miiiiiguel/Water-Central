'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { PenLine, PlayCircle, ArrowRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import FloatingProductCards from './FloatingProductCards';

export default function HeroSectionVideo() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const { t } = useLanguage();

  return (
    <section className="relative w-full overflow-hidden bg-white pt-16 pb-28 md:pt-24 md:pb-36">
      {/* Ambient blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-10 left-1/4 w-72 h-72 bg-orange-200/40 rounded-full blur-3xl animate-float"></div>
        <div className="absolute top-1/3 right-10 w-96 h-96 bg-orange-100/60 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
        <div className="absolute bottom-0 left-1/2 w-80 h-80 bg-indigo-100/40 rounded-full blur-3xl animate-float" style={{ animationDelay: '3s' }}></div>
      </div>

      <FloatingProductCards />

      <div className="relative z-10 px-4 md:px-12 lg:px-16">
        <div className="max-w-3xl mx-auto text-center">
          {/* Badge */}
          <div
            className={`inline-flex items-center gap-2.5 bg-white rounded-2xl app-shadow border border-gray-100 pl-2 pr-4 py-2 mb-8 transition-all duration-700 ${
              isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            }`}
          >
            <span className="w-8 h-8 rounded-xl bg-accent flex items-center justify-center flex-shrink-0">
              <PenLine size={16} className="text-white" strokeWidth={2.5} />
            </span>
            <span className="text-primary font-bold text-xs md:text-sm text-left">
              {t('hero.badge')}
            </span>
          </div>

          {/* Main Title */}
          <h1
            className={`text-4xl sm:text-5xl md:text-6xl font-black text-primary mb-6 leading-[1.08] transition-all duration-700 delay-100 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
            style={{ letterSpacing: '-0.02em' }}
          >
            <span className="block">{t('hero.title1')}</span>
            <span className="block">{t('hero.title2')}</span>
            <span className="block text-accent">{t('hero.title3')}</span>
          </h1>

          {/* Subtitle */}
          <p
            className={`text-base sm:text-lg text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed transition-all duration-700 delay-200 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
          >
            {t('hero.subtitle')}
          </p>

          {/* CTA Buttons */}
          <div
            className={`flex flex-col sm:flex-row gap-3 justify-center transition-all duration-700 delay-300 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
          >
            <Button
              onClick={() => {
                const el = document.getElementById('planes');
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className="rounded-full bg-accent hover:bg-accent/90 text-white px-7 py-6 text-base font-bold border-0 app-shadow transition-all duration-300 hover:scale-105 flex items-center justify-center gap-2 w-full sm:w-auto group"
            >
              {t('hero.cta1')}
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button
              onClick={() => {
                const el = document.getElementById('vsl');
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              variant="outline"
              className="rounded-full border-2 border-primary/15 text-primary hover:bg-primary/5 px-7 py-6 text-base font-bold transition-all duration-300 hover:scale-105 w-full sm:w-auto flex items-center justify-center gap-2"
            >
              <PlayCircle size={18} />
              {t('hero.cta2')}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
