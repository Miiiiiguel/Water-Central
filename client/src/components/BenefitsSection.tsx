import { Compass, Share2, Rocket, LineChart, Gauge } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function BenefitsSection() {
  const [isVisible, setIsVisible] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const benefits = [
    { icon: Compass, title: t('benefits.benefit1'), description: t('benefits.benefit1_desc'), color: 'from-blue-500 to-cyan-500' },
    { icon: Share2, title: t('benefits.benefit2'), description: t('benefits.benefit2_desc'), color: 'from-cyan-500 to-blue-500' },
    { icon: Rocket, title: t('benefits.benefit3'), description: t('benefits.benefit3_desc'), color: 'from-blue-600 to-cyan-600' },
    { icon: LineChart, title: t('benefits.benefit4'), description: t('benefits.benefit4_desc'), color: 'from-cyan-600 to-blue-600' },
    { icon: Gauge, title: t('benefits.benefit5'), description: t('benefits.benefit5_desc'), color: 'from-blue-500 to-cyan-600' },
  ];

  return (
    <section className="py-20 md:py-32 bg-gradient-to-b from-white to-gray-50 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 right-10 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-20 left-10 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="container relative z-10">
        <div className={`text-center mb-16 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-primary mb-4">
            {t('benefits.title')}
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-blue-600">
              {t('benefits.subtitle')}
            </span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {benefits.map((benefit, index) => {
            const Icon = benefit.icon;
            return (
              <div
                key={index}
                className={`relative group transition-all duration-700 transform ${
                  isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                } ${index === 3 ? 'lg:col-start-1' : ''}`}
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${benefit.color} rounded-xl opacity-0 group-hover:opacity-10 transition-opacity duration-300 blur-lg`}
                ></div>

                <div className="relative bg-white rounded-xl p-8 border border-gray-200 hover:border-gray-300 hover:shadow-premium-lg transition-all duration-300 h-full">
                  <div className={`w-16 h-16 bg-gradient-to-br ${benefit.color} rounded-lg flex items-center justify-center mb-6 shadow-glow group-hover:shadow-glow-lg transition-all duration-300 group-hover:scale-110`}>
                    <Icon className="text-white" size={32} />
                  </div>

                  <h3 className="text-xl font-bold text-primary mb-3 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-cyan-500 group-hover:to-blue-600 transition-all">
                    {benefit.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">{benefit.description}</p>

                  <div className="absolute inset-0 rounded-xl border-2 border-transparent bg-gradient-to-r from-cyan-500 to-blue-600 opacity-0 group-hover:opacity-20 transition-opacity duration-300 pointer-events-none"></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
