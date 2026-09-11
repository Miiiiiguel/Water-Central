import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Search, BarChart2, Lightbulb, ListChecks, ArrowRight, CalendarClock } from 'lucide-react';
import { useState, useEffect } from 'react';
import { openCalendlyPopup, isCalendlyConfigured } from '@/lib/calendly';

export default function VSLSection() {
  const { language } = useLanguage();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const steps = [
    { icon: Search, title: language === 'es' ? 'Descubre' : 'Discover' },
    { icon: BarChart2, title: language === 'es' ? 'Estadísticas' : 'Statistics' },
    { icon: Lightbulb, title: language === 'es' ? 'Recomendaciones' : 'Recommendations' },
    { icon: ListChecks, title: language === 'es' ? 'Plan de acción' : 'Action plan' },
  ];

  return (
    <section className="py-20 md:py-32 bg-gradient-to-b from-white to-gray-50 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="container relative z-10">
        <div className={`max-w-3xl mx-auto text-center mb-14 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500/10 border border-orange-500/30 rounded-full mb-6">
            <span className="text-orange-700 font-semibold text-sm">
              {language === 'es' ? 'Consultoría 1 a 1' : '1-on-1 consulting'}
            </span>
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-primary mb-6 leading-tight">
            {language === 'es'
              ? 'Obtén el análisis personalizado de tu oportunidad'
              : 'Get a personalized analysis of your opportunity'}
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            {language === 'es'
              ? '30 minutos de consultoría donde nuestros especialistas desbloquean tu verdadero potencial de ecommerce. No consejos genéricos: insights específicos basados en tu negocio, mercado y objetivos.'
              : '30 minutes of consulting where our specialists unlock your true ecommerce potential. No generic advice: specific insights based on your business, market and goals.'}
          </p>
        </div>

        {/* Steps */}
        <div className={`grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 max-w-4xl mx-auto mb-14 transition-all duration-700 delay-200 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div key={index} className="relative bg-white rounded-xl p-6 border border-gray-200 text-center hover:shadow-premium-lg hover:border-orange-500/50 transition-all duration-300 group">
                <div className="absolute -top-3 -left-3 w-7 h-7 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 text-white text-xs font-bold flex items-center justify-center shadow-glow">
                  {index + 1}
                </div>
                <div className="w-14 h-14 mx-auto bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center mb-4 shadow-glow group-hover:scale-110 transition-transform duration-300">
                  <Icon className="text-white" size={26} />
                </div>
                <p className="font-semibold text-foreground">{step.title}</p>
              </div>
            );
          })}
        </div>

        <div className={`text-center transition-all duration-700 delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <Button
            className="rounded-full bg-accent hover:bg-accent/90 text-white px-8 py-6 text-base sm:text-lg font-semibold border-0 app-shadow transition-all duration-300 hover:scale-105 inline-flex items-center gap-2 group"
            onClick={async () => {
              const opened = await openCalendlyPopup();
              if (!opened) {
                const el = document.getElementById('contacto');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }
            }}
          >
            {isCalendlyConfigured && <CalendarClock size={20} />}
            {language === 'es' ? '¡Agenda 20 minutos de consultoría gratis!' : 'Book your free 20-minute consultation!'}
            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
          </Button>
          {!isCalendlyConfigured && (
            <p className="text-xs text-muted-foreground mt-3">
              {language === 'es' ? '(Calendario en camino — por ahora te contactamos por el formulario)' : '(Scheduling coming soon — for now we\'ll reach out via the form)'}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
