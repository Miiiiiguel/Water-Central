import { Compass, Share2, Rocket, LineChart, Gauge } from 'lucide-react';
import { motion } from 'framer-motion';
import { useLanguage } from '@/contexts/LanguageContext';

export default function BenefitsSection() {
  const { t } = useLanguage();

  const benefits = [
    { icon: Compass, title: t('benefits.benefit1'), description: t('benefits.benefit1_desc') },
    { icon: Share2, title: t('benefits.benefit2'), description: t('benefits.benefit2_desc') },
    { icon: Rocket, title: t('benefits.benefit3'), description: t('benefits.benefit3_desc') },
    { icon: LineChart, title: t('benefits.benefit4'), description: t('benefits.benefit4_desc') },
    { icon: Gauge, title: t('benefits.benefit5'), description: t('benefits.benefit5_desc') },
  ];

  const [featured, ...rest] = benefits;
  const FeaturedIcon = featured.icon;

  return (
    <section className="py-20 md:py-32 bg-gradient-to-b from-white to-gray-50 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 right-10 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-20 left-10 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="container relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-primary mb-4">
            {t('benefits.title')}
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-orange-600">
              {t('benefits.subtitle')}
            </span>
          </h2>
        </motion.div>

        {/* Bento grid: one featured tile + four supporting tiles */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.6 }}
            whileHover={{ y: -6 }}
            className="md:col-span-2 relative rounded-3xl bg-gradient-to-br from-primary via-indigo-950 to-primary p-8 md:p-10 text-white overflow-hidden app-shadow"
          >
            <div className="absolute -top-20 -right-20 w-72 h-72 bg-accent/25 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute -bottom-24 -left-10 w-64 h-64 bg-indigo-400/15 rounded-full blur-3xl pointer-events-none"></div>
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center mb-6 shadow-glow-lg">
                <FeaturedIcon className="text-white" size={30} />
              </div>
              <h3 className="text-2xl md:text-3xl font-bold mb-3">{featured.title}</h3>
              <p className="text-white/70 leading-relaxed max-w-lg">{featured.description}</p>
            </div>
          </motion.div>

          {rest.map((benefit, index) => {
            const Icon = benefit.icon;
            return (
              <motion.div
                key={benefit.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.6, delay: (index + 1) * 0.08 }}
                whileHover={{ y: -6 }}
                className="group relative rounded-3xl bg-white border border-gray-100 app-shadow hover:shadow-premium-lg transition-shadow duration-300 p-8"
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center mb-5 shadow-glow group-hover:shadow-glow-lg transition-all duration-300 group-hover:scale-110">
                  <Icon className="text-white" size={24} />
                </div>
                <h3 className="text-lg font-bold text-primary mb-2">{benefit.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{benefit.description}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
