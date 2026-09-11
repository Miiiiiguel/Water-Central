import { motion } from 'framer-motion';
import { Quote, Star } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface Testimonial {
  name: string;
  company: string;
  quote: { es: string; en: string };
  result: string;
  /** Optional path/URL to a logo or headshot. Leave undefined to show initials instead. */
  avatar?: string;
}

// Add real client testimonials here — see the chat for what to send
// (name, brand, a short quote, and one concrete result). The section
// renders nothing until this has at least one entry, so it's safe to
// ship with this empty.
const testimonials: Testimonial[] = [];

export default function TestimonialsSection() {
  const { language } = useLanguage();

  if (testimonials.length === 0) return null;

  return (
    <section id="casos" className="py-20 md:py-32 bg-white relative overflow-hidden">
      <div className="container relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-2xl mx-auto mb-14"
        >
          <h2 className="text-4xl md:text-5xl font-black text-primary mb-4">
            {language === 'es' ? 'Marcas que ya' : 'Brands already'}
            <span className="text-accent"> {language === 'es' ? 'están vendiendo en USA' : 'selling in the US'}</span>
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((t, index) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="bg-white rounded-3xl border border-gray-100 app-shadow p-7 flex flex-col"
            >
              <Quote className="text-accent/30 mb-3" size={32} />
              <div className="flex gap-0.5 mb-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={14} className="fill-accent text-accent" />
                ))}
              </div>
              <p className="text-foreground leading-relaxed mb-6 flex-1">
                “{language === 'es' ? t.quote.es : t.quote.en}”
              </p>
              <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                {t.avatar ? (
                  <img src={t.avatar} alt={t.name} className="w-11 h-11 rounded-full object-cover" />
                ) : (
                  <span className="w-11 h-11 rounded-full bg-secondary text-accent font-bold flex items-center justify-center">
                    {t.name.charAt(0)}
                  </span>
                )}
                <div>
                  <p className="font-bold text-primary text-sm">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.company}</p>
                </div>
                <span className="ml-auto text-xs font-bold text-accent bg-secondary rounded-full px-3 py-1">
                  {t.result}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
