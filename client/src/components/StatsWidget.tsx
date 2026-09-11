import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function StatsWidget() {
  const { t } = useLanguage();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold: 0.2 }
    );
    const el = document.getElementById('stats-widget');
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const stats = [
    { number: t('hero.stat1'), label: t('hero.stat1_label') },
    { number: t('hero.stat2'), label: t('hero.stat2_label') },
    { number: t('hero.stat3'), label: t('hero.stat3_label') },
  ];

  return (
    <div className="relative z-20 -mt-16 md:-mt-20 px-4">
      <div
        id="stats-widget"
        className={`max-w-5xl mx-auto rounded-3xl bg-gradient-to-br from-primary via-indigo-950 to-primary app-shadow p-8 md:p-12 grid grid-cols-3 gap-4 md:gap-8 relative overflow-hidden transition-all duration-700 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        <div className="absolute -top-16 -right-16 w-56 h-56 bg-accent/20 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-16 -left-16 w-56 h-56 bg-orange-400/10 rounded-full blur-3xl pointer-events-none"></div>
        {stats.map((stat, index) => (
          <div key={index} className="relative text-center group hover:scale-105 transition-transform duration-300">
            <div className="text-3xl sm:text-4xl md:text-5xl font-black text-accent mb-1 md:mb-2">
              {stat.number}
            </div>
            <div className="text-[11px] sm:text-xs md:text-base text-white/70 leading-tight">
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
