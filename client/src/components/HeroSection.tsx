import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function HeroSection() {
  const [isVisible, setIsVisible] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <section
      id="inicio"
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
    >
      {/* Animated Background Elements */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        {/* Background Image */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'url(https://d2xsxph8kpxj0f.cloudfront.net/310519663507101400/M3vGFBvXTzeHHq6Z95nygi/hero-water-dark-ak7fqS3KHbhVEq3fGXcBRY.webp)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          {/* Gradient Overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-slate-900/50"></div>
        </div>

        {/* Animated Orbs */}
        <div className="absolute top-20 right-10 w-72 h-72 bg-cyan-500/20 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-20 left-10 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/2 left-1/3 w-80 h-80 bg-cyan-400/10 rounded-full blur-3xl animate-pulse-glow"></div>
      </div>

      {/* Content */}
      <div className="container relative z-10 py-20 md:py-32">
        <div className="max-w-3xl">
          {/* Badge with Animation */}
          <div
            className={`inline-flex items-center gap-2 px-4 py-2 bg-cyan-500/20 border border-cyan-500/50 rounded-full mb-6 backdrop-blur-lg transition-all duration-700 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            <Sparkles size={16} className="text-cyan-400 animate-pulse" />
            <span className="text-cyan-300 text-sm font-semibold">{t('hero.badge')}</span>
          </div>

          {/* Main Headline with Staggered Animation */}
          <h1
            className={`text-6xl md:text-7xl lg:text-8xl font-bold text-white mb-6 leading-tight transition-all duration-1000 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
          >
            {t('hero.title1')}
            <span className="block bg-gradient-to-r from-cyan-400 via-cyan-300 to-blue-400 bg-clip-text text-transparent animate-pulse-glow">
              {t('hero.title2')}
            </span>
            {t('hero.title3')}
          </h1>

          {/* Subheadline */}
          <p
            className={`text-lg md:text-xl text-gray-300 mb-8 leading-relaxed max-w-2xl transition-all duration-1000 delay-200 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
          >
            {t('hero.subtitle')}
          </p>

          {/* CTA Buttons with Hover Effects */}
          <div
            className={`flex flex-col sm:flex-row gap-4 mb-12 transition-all duration-1000 delay-300 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
          >
            <Button className="bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 text-white px-8 py-6 text-lg font-semibold flex items-center gap-2 border-0 shadow-glow-lg hover:shadow-glow-lg transition-all duration-300 hover:scale-105 group">
              {t('hero.cta1')}
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button
              variant="outline"
              className="border-2 border-white text-white hover:bg-white/10 px-8 py-6 text-lg font-semibold backdrop-blur-lg transition-all duration-300 hover:scale-105"
            >
              {t('hero.cta2')}
            </Button>
          </div>

          {/* Stats with Animation */}
          <div
            className={`grid grid-cols-3 gap-4 pt-12 border-t border-white/20 transition-all duration-1000 delay-500 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
          >
            <div className="group hover-lift">
              <div className="text-3xl md:text-4xl font-bold text-cyan-400 group-hover:text-cyan-300 transition-colors">{t('hero.stat1')}</div>
              <p className="text-gray-400 text-sm mt-2 group-hover:text-gray-300 transition-colors">{t('hero.stat1_label')}</p>
            </div>
            <div className="group hover-lift">
              <div className="text-3xl md:text-4xl font-bold text-cyan-400 group-hover:text-cyan-300 transition-colors">{t('hero.stat2')}</div>
              <p className="text-gray-400 text-sm mt-2 group-hover:text-gray-300 transition-colors">{t('hero.stat2_label')}</p>
            </div>
            <div className="group hover-lift">
              <div className="text-3xl md:text-4xl font-bold text-cyan-400 group-hover:text-cyan-300 transition-colors">{t('hero.stat3')}</div>
              <p className="text-gray-400 text-sm mt-2 group-hover:text-gray-300 transition-colors">{t('hero.stat3_label')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10 animate-bounce">
        <div className="flex flex-col items-center gap-2">
          <span className="text-gray-400 text-sm">Scroll</span>
          <svg className="w-6 h-6 text-cyan-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      </div>
    </section>
  );
}
