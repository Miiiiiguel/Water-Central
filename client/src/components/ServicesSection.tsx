import { ShoppingCart, Ship, TrendingUp, Warehouse, BarChart3, Target } from 'lucide-react';
import { scrollToAnchor } from '@/lib/scrollToAnchor';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';
import { useSpotlight } from '@/lib/useSpotlight';

export default function ServicesSection() {
  const { t } = useLanguage();
  const spotlight = useSpotlight();

  const services = [
    { icon: ShoppingCart, title: t('services.service1'), description: t('services.service1_desc') },
    { icon: Ship, title: t('services.service2'), description: t('services.service2_desc') },
    { icon: TrendingUp, title: t('services.service3'), description: t('services.service3_desc') },
    { icon: Warehouse, title: t('services.service4'), description: t('services.service4_desc') },
    { icon: BarChart3, title: t('services.service5'), description: t('services.service5_desc') },
    { icon: Target, title: t('services.service6'), description: t('services.service6_desc') },
  ];

  return (
    <section className="py-20 md:py-32 bg-gradient-to-b from-gray-50 via-white to-gray-50 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-10 right-10 w-72 h-72 bg-orange-100/60 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-20 left-1/4 w-96 h-96 bg-orange-50 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="container relative z-10">
        {/* Section Header */}
        <div className="text-center mb-16 animate-fade-in-down">
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-primary mb-6 lg:mb-8">
            {t('services.title')}
            <span className="block text-accent">
              {t('services.subtitle')}
            </span>
          </h2>
          <p className="text-base md:text-lg lg:text-xl text-muted-foreground max-w-3xl mx-auto">
            {t('services.description')}
          </p>
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 mb-16">
          {services.map((service, index) => {
            const Icon = service.icon;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.5, delay: (index % 3) * 0.1 }}
                whileHover={{ y: -6 }}
                {...spotlight}
                className="card-spotlight group bg-white rounded-3xl p-8 border border-gray-100 app-shadow hover:shadow-premium-lg transition-shadow duration-300"
              >
                <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center text-white mb-5 shadow-glow group-hover:shadow-glow-lg group-hover:scale-110 transition-all duration-300">
                  <Icon size={26} strokeWidth={2.25} />
                </div>
                <h3 className="text-lg md:text-xl font-bold text-primary mb-2">
                  {service.title}
                </h3>
                <p className="text-sm md:text-base text-muted-foreground leading-relaxed">{service.description}</p>
              </motion.div>
            );
          })}
        </div>

        {/* Bottom CTA */}
        <div className="text-center">
          <Button
            className="rounded-full bg-accent hover:bg-accent/90 text-white px-8 py-6 text-base font-bold border-0 app-shadow transition-all duration-300 hover:scale-105"
            onClick={() => {
              scrollToAnchor('#contacto');
            }}
          >
            {t('services.explore_all')}
          </Button>
        </div>
      </div>
    </section>
  );
}
