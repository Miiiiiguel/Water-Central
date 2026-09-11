import { ShoppingCart, Ship, TrendingUp, Warehouse, BarChart3, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function ServicesSection() {
  const [visibleCards, setVisibleCards] = useState<boolean[]>([false, false, false, false, false, false]);
  const { t, language } = useLanguage();

  useEffect(() => {
    const timers = [100, 200, 300, 400, 500, 600].map((delay, index) =>
      setTimeout(() => {
        setVisibleCards((prev) => {
          const newState = [...prev];
          newState[index] = true;
          return newState;
        });
      }, delay)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  const services = [
    {
      icon: ShoppingCart,
      title: t('services.service1'),
      description: t('services.service1_desc'),
      color: 'from-blue-500 to-cyan-500',
    },
    {
      icon: Ship,
      title: t('services.service2'),
      description: t('services.service2_desc'),
      color: 'from-cyan-500 to-blue-500',
    },
    {
      icon: TrendingUp,
      title: t('services.service3'),
      description: t('services.service3_desc'),
      color: 'from-blue-600 to-cyan-600',
    },
    {
      icon: Warehouse,
      title: t('services.service4'),
      description: t('services.service4_desc'),
      color: 'from-cyan-600 to-blue-600',
    },
    {
      icon: BarChart3,
      title: t('services.service5'),
      description: t('services.service5_desc'),
      color: 'from-blue-500 to-cyan-600',
    },
    {
      icon: Target,
      title: t('services.service6'),
      description: t('services.service6_desc'),
      color: 'from-cyan-500 to-blue-600',
    },
  ];

  const marketplaces = ['Amazon', 'TikTok Shop', 'Shopify', 'Walmart', 'Meta Ads', 'FBA'];

  return (
    <section className="py-20 md:py-32 bg-gradient-to-b from-white via-blue-50/30 to-gray-50 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-10 right-10 w-72 h-72 bg-cyan-500/15 rounded-full blur-3xl animate-float"></div>
        <div className="absolute top-1/3 left-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
        <div className="absolute bottom-20 right-1/4 w-80 h-80 bg-cyan-400/12 rounded-full blur-3xl animate-float" style={{ animationDelay: '1s' }}></div>
        <div className="absolute -bottom-20 left-1/3 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '3s' }}></div>

        <div className="absolute top-1/4 left-0 w-full h-px bg-gradient-to-r from-transparent via-cyan-500/20 to-transparent"></div>
        <div className="absolute bottom-1/3 left-0 w-full h-px bg-gradient-to-r from-transparent via-blue-500/15 to-transparent"></div>
      </div>

      <div className="container relative z-10">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-cyan-500/5 rounded-full blur-2xl"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500/5 rounded-full blur-2xl"></div>

        {/* Section Header */}
        <div className="text-center mb-20 animate-fade-in-down">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-primary mb-6 lg:mb-8">
            {t('services.title')}
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-blue-600">
              {t('services.subtitle')}
            </span>
          </h2>
          <p className="text-base md:text-lg lg:text-xl text-muted-foreground max-w-3xl mx-auto">
            {t('services.description')}
          </p>
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-10 mb-16 md:mb-20 mt-12 md:mt-16">
          {services.map((service, index) => {
            const Icon = service.icon;
            return (
              <div
                key={index}
                className={`group relative bg-white rounded-2xl p-8 border border-gray-200 hover:border-cyan-500/50 transition-all duration-500 hover:shadow-2xl hover:shadow-cyan-500/20 overflow-hidden ${
                  visibleCards[index] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="absolute -inset-px bg-gradient-to-r from-cyan-500/0 via-cyan-500/20 to-blue-500/0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-lg"></div>

                <div className="relative z-10">
                  <div className="flex items-center gap-4 mb-5 md:mb-6">
                    <div className={`p-4 bg-gradient-to-br ${service.color} rounded-lg text-white group-hover:scale-110 transition-transform duration-300`}>
                      <Icon size={32} />
                    </div>
                    <h3 className="text-lg md:text-xl font-bold text-foreground group-hover:text-cyan-600 transition-colors duration-300">
                      {service.title}
                    </h3>
                  </div>

                  <p className="text-sm md:text-base text-muted-foreground leading-relaxed">{service.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Marketplace / Partners Strip */}
        <div className="pt-8 border-t border-gray-200 text-center">
          <p className="text-sm font-semibold text-muted-foreground mb-6 uppercase tracking-wide">
            {language === 'es' ? 'Trabajamos con los principales marketplaces y aliados' : 'We work with the top marketplaces and partners'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4 mb-16">
            {marketplaces.map((name) => (
              <span
                key={name}
                className="px-5 py-2.5 rounded-full border border-gray-200 bg-white text-sm md:text-base font-semibold text-foreground/80 hover:border-cyan-500/50 hover:text-cyan-700 transition-colors"
              >
                {name}
              </span>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="text-center">
          <Button
            className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white px-8 py-6 text-lg border-0 shadow-glow-lg hover:shadow-glow-lg transition-all duration-300 hover:scale-105"
            onClick={() => {
              const el = document.getElementById('contacto');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            {t('services.explore_all')}
          </Button>
        </div>
      </div>
    </section>
  );
}
