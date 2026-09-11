import { useLanguage } from '@/contexts/LanguageContext';
import { useEffect, useState } from 'react';

interface Member {
  name: string;
  role: { es: string; en: string };
}

const team: Member[] = [
  { name: 'Julián', role: { es: 'Co-Fundador & CEO', en: 'Co-Founder & CEO' } },
  { name: 'Pipe', role: { es: 'Co-Fundador & COO', en: 'Co-Founder & COO' } },
  { name: 'Felipe', role: { es: 'Cofundador Comercial', en: 'Co-Founder, Commercial' } },
];

export default function TeamSection() {
  const { language } = useLanguage();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold: 0.1 }
    );
    const el = document.getElementById('equipo');
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="equipo" className="py-16 md:py-24 lg:py-32 bg-gradient-to-b from-white to-gray-50 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-64 md:w-96 h-64 md:h-96 bg-cyan-500/10 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-0 left-0 w-64 md:w-96 h-64 md:h-96 bg-blue-600/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="container relative z-10">
        <div className={`text-center mb-12 md:mb-16 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-primary mb-3 md:mb-4">
            {language === 'es' ? 'El equipo Easycomex' : 'The Easycomex team'}
          </h2>
          <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
            {language === 'es'
              ? 'Las personas detrás de las marcas que crecen con nosotros.'
              : 'The people behind the brands growing with us.'}
          </p>
        </div>

        <div className={`grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-3xl mx-auto transition-all duration-700 delay-200 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {team.map((member) => (
            <div key={member.name} className="text-center group">
              <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white text-3xl font-bold shadow-glow group-hover:shadow-glow-lg group-hover:scale-105 transition-all duration-300">
                {member.name.charAt(0)}
              </div>
              <p className="font-bold text-foreground text-lg">{member.name}</p>
              <p className="text-sm text-muted-foreground">{language === 'es' ? member.role.es : member.role.en}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
