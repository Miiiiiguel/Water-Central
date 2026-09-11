'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Play, ChevronDown, Sparkles } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function HeroSectionVideo() {
  const [isVisible, setIsVisible] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setMousePosition({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const { t } = useLanguage();

  const stats = [
    { number: t('hero.stat1'), label: t('hero.stat1_label') },
    { number: t('hero.stat2'), label: t('hero.stat2_label') },
    { number: t('hero.stat3'), label: t('hero.stat3_label') },
  ];

  return (
    <section
      ref={containerRef}
      className="relative w-full h-screen min-h-screen overflow-hidden bg-black"
    >
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900"></div>

      {/* Advanced Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/20 to-black/60"></div>

      {/* Animated Gradient Mesh Background */}
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-0 left-0 w-96 h-96 bg-cyan-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }}></div>
        <div className="absolute top-1/4 right-0 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s', animationDelay: '1s' }}></div>
        <div className="absolute bottom-0 left-1/3 w-96 h-96 bg-cyan-600/15 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '5s', animationDelay: '2s' }}></div>
      </div>

      {/* Mouse-following Glow Effect */}
      <div
        className="absolute w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none transition-all duration-100"
        style={{
          left: `${mousePosition.x - 192}px`,
          top: `${mousePosition.y - 192}px`,
          opacity: 0.5,
        }}
      ></div>

      {/* Animated Particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(15)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-cyan-400 rounded-full animate-float"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${i * 0.2}s`,
              opacity: Math.random() * 0.6 + 0.2,
            }}
          ></div>
        ))}
      </div>

      {/* Content - Optimizado para móvil y mejorado para PC */}
      <div className="relative z-10 h-full flex flex-col justify-center items-center px-4 md:px-12 lg:px-16 py-12 md:py-0">
        <div className="max-w-6xl mx-auto text-center w-full">
          {/* Badge with Animation */}
          <div
            className={`inline-flex items-center gap-2 px-4 py-2 md:px-6 md:py-2.5 lg:px-7 lg:py-3 bg-cyan-500/20 border border-cyan-500/60 rounded-full mb-6 md:mb-10 lg:mb-14 transition-all duration-700 backdrop-blur-sm hover:bg-cyan-500/30 hover:border-cyan-400 cursor-pointer group ${
              isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            }`}
          >
            <Sparkles size={16} className="text-cyan-300 group-hover:animate-spin" />
            <span className="text-cyan-200 font-semibold text-xs md:text-sm flex items-center gap-1">
              {t('hero.badge')}
            </span>
          </div>

          {/* Main Title - Optimizado para móvil */}
          <h1
            className={`text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 md:mb-8 lg:mb-10 leading-tight transition-all duration-700 delay-100 drop-shadow-2xl ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
            style={{
              textShadow: '0 0 40px rgba(0, 0, 0, 0.95), 0 0 80px rgba(6, 182, 212, 0.3), 0 4px 20px rgba(0, 0, 0, 0.9)',
              letterSpacing: '-0.02em',
            }}
          >
            <span className="block">{t('hero.title1')}</span>
            <span className="block">{t('hero.title2')}</span>
            <span 
              className="block text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-cyan-200 to-blue-400 animate-pulse"
              style={{
                textShadow: '0 0 30px rgba(0, 0, 0, 0.8), 0 0 60px rgba(6, 182, 212, 0.4)',
                animationDuration: '3s',
              }}
            >
              {t('hero.title3')}
            </span>
          </h1>

          {/* Subtitle - Optimizado para móvil */}
          <p
            className={`text-sm sm:text-base md:text-lg lg:text-xl text-gray-100 mb-8 md:mb-10 lg:mb-12 max-w-3xl mx-auto leading-relaxed transition-all duration-700 delay-200 drop-shadow-lg ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
            style={{
              textShadow: '0 0 30px rgba(0, 0, 0, 0.95), 0 0 60px rgba(0, 0, 0, 0.85)',
            }}
          >
            {t('hero.subtitle')}
          </p>

          {/* CTA Buttons - Optimizado para móvil */}
          <div
            className={`flex flex-col sm:flex-row gap-3 md:gap-4 justify-center mb-10 md:mb-14 lg:mb-16 transition-all duration-700 delay-300 w-full ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
          >
            <Button 
              onClick={() => {
                const contactEl = document.getElementById('contacto');
                if (contactEl) {
                  contactEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
              className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white px-6 md:px-8 py-4 md:py-6 text-sm md:text-lg font-semibold border-0 shadow-2xl shadow-cyan-500/50 hover:shadow-cyan-500/70 transition-all duration-300 hover:scale-105 flex items-center justify-center gap-2 w-full sm:w-auto group cursor-pointer"
            >
              <Play size={18} className="fill-white group-hover:animate-bounce" />
              {t('hero.cta1')}
            </Button>
            <Button
              onClick={() => {
                const serviciosEl = document.getElementById('servicios');
                if (serviciosEl) {
                  serviciosEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
              variant="outline"
              className="border-2 border-cyan-400/60 text-white hover:bg-white/15 hover:border-cyan-300 px-6 md:px-8 py-4 md:py-6 text-sm md:text-lg font-semibold transition-all duration-300 hover:scale-105 w-full sm:w-auto backdrop-blur-sm cursor-pointer"
            >
              {t('hero.cta2')}
            </Button>
          </div>

          {/* Stats - Optimizado para móvil */}
          <div
            className={`grid grid-cols-3 gap-3 md:gap-12 lg:gap-16 transition-all duration-700 delay-400 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
          >
            {stats.map((stat, index) => (
              <div key={index} className="text-center group hover:scale-110 transition-transform duration-300 cursor-pointer">
                <div className="text-3xl sm:text-4xl md:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-400 mb-2 md:mb-3 group-hover:from-cyan-200 group-hover:to-blue-300">
                  {stat.number}
                </div>
                <div className="text-xs sm:text-sm md:text-base lg:text-lg text-gray-300 leading-tight group-hover:text-cyan-200 transition-colors">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll Indicator - Solo en desktop */}
        <div className="absolute bottom-4 md:bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce hidden md:block">
          <ChevronDown size={32} className="text-cyan-400 drop-shadow-lg" />
        </div>
      </div>

      {/* Animated Grid Background */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <div
          className="w-full h-full"
          style={{
            backgroundImage: 'linear-gradient(0deg, transparent 24%, rgba(6, 182, 212, 0.1) 25%, rgba(6, 182, 212, 0.1) 26%, transparent 27%, transparent 74%, rgba(6, 182, 212, 0.1) 75%, rgba(6, 182, 212, 0.1) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(6, 182, 212, 0.1) 25%, rgba(6, 182, 212, 0.1) 26%, transparent 27%, transparent 74%, rgba(6, 182, 212, 0.1) 75%, rgba(6, 182, 212, 0.1) 76%, transparent 77%, transparent)',
            backgroundSize: '50px 50px',
          }}
        ></div>
      </div>
    </section>
  );
}
