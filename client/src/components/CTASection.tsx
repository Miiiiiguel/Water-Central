import { MessageCircle, ArrowRight, Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

import { whatsappUrl } from '@/lib/contact';

const WHATSAPP_URL = whatsappUrl();

export default function CTASection() {
  const { language } = useLanguage();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold: 0.1 }
    );
    const el = document.getElementById('cta-section');
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const questions = language === 'es'
    ? ['¿La oportunidad de vender en otros países?', '¿No aprovechar nuevos canales de venta que pueden hacer tu producto viral?', '¿Aprender nuevas cosas?']
    : ['The chance to sell in other countries?', 'Missing new sales channels that could make your product go viral?', 'Learning new things?'];

  return (
    <section id="cta-section" className="py-20 md:py-32 relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-r from-primary via-indigo-900 to-primary"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-orange-500/20 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-orange-400/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="container relative z-10">
        <div className="max-w-3xl mx-auto text-center">
          <div
            className={`inline-flex items-center gap-2 px-4 py-2 bg-white/10 border border-white/30 rounded-full mb-6 backdrop-blur-lg transition-all duration-700 ${
              isVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            }`}
          >
            <Sparkles size={16} className="text-orange-300 animate-pulse" />
            <span className="text-white text-sm font-semibold">
              {language === 'es' ? '¿Qué puedes perder?' : 'What do you have to lose?'}
            </span>
          </div>

          <h2
            className={`text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-8 transition-all duration-700 delay-100 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
          >
            {language === 'es' ? 'Contáctanos.' : 'Contact us.'}
          </h2>

          <div
            className={`space-y-3 mb-12 text-left max-w-xl mx-auto transition-all duration-700 delay-200 ${
              isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
            }`}
          >
            {questions.map((q, index) => (
              <p key={index} className="text-orange-100 text-base md:text-lg">
                {q}
              </p>
            ))}
          </div>

          <div className={`transition-all duration-700 delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white hover:bg-orange-50 text-primary px-8 sm:px-10 py-5 text-base sm:text-lg font-bold inline-flex items-center gap-2 rounded-full app-shadow transition-all duration-300 hover:scale-105 group"
            >
              <MessageCircle size={22} />
              {language === 'es' ? 'Contáctanos ahora' : 'Contact us now'}
              <ArrowRight size={22} className="group-hover:translate-x-2 transition-transform" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
