import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Check, Sparkles, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

interface Plan {
  step: number;
  title: { es: string; en: string };
  price: { es: string; en: string };
  features: { es: string[]; en: string[] };
  highlighted?: boolean;
  checkoutPlan?: string;
}

const plans: Plan[] = [
  {
    step: 1,
    title: { es: 'Diagnóstico de tu situación actual', en: 'Diagnosis of your current situation' },
    price: { es: 'Gratis · Madurez USD 6.90', en: 'Free · Maturity USD 6.90' },
    features: {
      es: ['Diagnóstico básico gratis', 'Diagnóstico de madurez con comentarios y próximos pasos (USD 6.90)'],
      en: ['Free basic diagnosis', 'Maturity diagnosis with feedback and next steps (USD 6.90)'],
    },
  },
  {
    step: 2,
    title: { es: 'Plan de crecimiento de ventas ecommerce en USA', en: 'US ecommerce sales growth plan' },
    price: { es: 'A medida', en: 'Custom' },
    features: {
      es: ['Impacto en facturación estimado para tu compañía', 'Logística internacional (Prep Center) + comisiones de canal'],
      en: ['Estimated revenue impact for your company', 'International logistics (Prep Center) + channel fees'],
    },
    highlighted: true,
  },
  {
    step: 3,
    title: { es: 'Análisis de mercado y competencia', en: 'Market & competitor analysis' },
    price: { es: 'USD 499', en: 'USD 499' },
    features: {
      es: ['Análisis personalizado de tu oportunidad en Amazon y TikTok Shop', '2 horas de asesoría 1 a 1 con nuestros especialistas'],
      en: ['Personalized opportunity analysis on Amazon and TikTok Shop', '2 hours of 1-on-1 advisory with our specialists'],
    },
    checkoutPlan: 'analisis_mercado',
  },
];

export default function PlansSection() {
  const { language } = useLanguage();
  const [isVisible, setIsVisible] = useState(false);
  const [checkingOut, setCheckingOut] = useState<number | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const handlePlanClick = async (plan: Plan) => {
    if (!plan.checkoutPlan) {
      const el = document.getElementById('contacto');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    setCheckoutError(null);
    setCheckingOut(plan.step);
    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: plan.checkoutPlan }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || 'checkout_failed');
      window.location.href = data.url;
    } catch {
      setCheckoutError(
        language === 'es'
          ? 'Los pagos con Stripe aún no están configurados en este entorno.'
          : 'Stripe payments are not configured in this environment yet.'
      );
      setCheckingOut(null);
    }
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold: 0.1 }
    );
    const el = document.getElementById('planes');
    if (el) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="py-20 md:py-32 bg-gradient-to-b from-white to-gray-50 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="container relative z-10">
        <div className={`text-center mb-12 md:mb-16 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500/10 border border-orange-500/30 rounded-full mb-6">
            <Sparkles size={16} className="text-orange-600" />
            <span className="text-orange-700 font-semibold text-sm">
              {language === 'es' ? 'Elige cómo quieres empezar' : 'Choose how you want to start'}
            </span>
          </div>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold text-primary mb-4">
            {language === 'es' ? 'Un plan para' : 'A plan for'}
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-orange-600">
              {language === 'es' ? 'cada etapa de tu marca' : 'every stage of your brand'}
            </span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {language === 'es'
              ? 'Desde un diagnóstico gratuito hasta un análisis completo de mercado: empieza donde tu marca esté hoy.'
              : "From a free diagnosis to a full market analysis: start wherever your brand is today."}
          </p>
        </div>

        <div className={`grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto transition-all duration-700 delay-200 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {plans.map((plan) => (
            <div
              key={plan.step}
              className={`relative rounded-2xl p-8 border flex flex-col ${
                plan.highlighted
                  ? 'bg-gradient-to-b from-primary to-indigo-950 text-white border-transparent shadow-glow-lg lg:-translate-y-4'
                  : 'bg-white border-gray-200 app-shadow'
              }`}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-orange-400 text-primary text-xs font-bold rounded-full shadow-glow">
                  {language === 'es' ? 'Más elegido' : 'Most chosen'}
                </span>
              )}
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold mb-6 ${
                  plan.highlighted ? 'bg-white/20 text-white' : 'bg-gradient-to-r from-orange-500 to-orange-600 text-white'
                }`}
              >
                {plan.step}
              </div>
              <h3 className={`text-xl font-bold mb-2 ${plan.highlighted ? 'text-white' : 'text-primary'}`}>
                {language === 'es' ? plan.title.es : plan.title.en}
              </h3>
              <p className={`text-2xl font-bold mb-6 ${plan.highlighted ? 'text-orange-200' : 'text-transparent bg-clip-text bg-gradient-to-r from-orange-600 to-orange-600'}`}>
                {language === 'es' ? plan.price.es : plan.price.en}
              </p>
              <ul className="space-y-3 mb-8 flex-1">
                {(language === 'es' ? plan.features.es : plan.features.en).map((feature, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check size={18} className={`flex-shrink-0 mt-0.5 ${plan.highlighted ? 'text-orange-300' : 'text-orange-600'}`} />
                    <span className={`text-sm ${plan.highlighted ? 'text-orange-50' : 'text-muted-foreground'}`}>{feature}</span>
                  </li>
                ))}
              </ul>
              <Button
                disabled={checkingOut === plan.step}
                className={
                  plan.highlighted
                    ? 'bg-white text-primary hover:bg-gray-100 border-0 font-bold'
                    : 'rounded-full bg-accent hover:bg-accent/90 text-white border-0'
                }
                onClick={() => handlePlanClick(plan)}
              >
                {checkingOut === plan.step ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  language === 'es' ? 'Empezar' : 'Get started'
                )}
              </Button>
              {checkoutError && checkingOut === null && plan.checkoutPlan && (
                <p className={`text-xs mt-2 ${plan.highlighted ? 'text-orange-200' : 'text-red-500'}`}>{checkoutError}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
