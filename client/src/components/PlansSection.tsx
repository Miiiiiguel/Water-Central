import { Link } from 'wouter';
import { scrollToAnchor } from '@/lib/scrollToAnchor';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Check, Sparkles, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { trackInitiateCheckout } from '@/lib/analytics';
import { startCheckout as openCheckout, checkoutMessage, fetchCatalog, type CheckoutPlan } from '@/lib/checkout';
import { useAuth } from '@/contexts/AuthContext';
import { useSpotlight } from '@/lib/useSpotlight';
import { isNative, openExternal } from '@/lib/native';
import CheckoutSheet, { type CheckoutItem } from '@/components/CheckoutSheet';

interface Plan {
  step: number;
  title: { es: string; en: string };
  price: { es: string; en: string };
  features: { es: string[]; en: string[] };
  highlighted?: boolean;
  checkoutPlan?: string;
  // A second option inside a card whose main action is free: a route
  // of its own (the maturity diagnosis lives at /diagnostico).
  secondaryLink?: { href: string; label: { es: string; en: string } };
}

const plans: Plan[] = [
  {
    step: 1,
    title: { es: 'Diagnóstico: ¿tu marca aguanta salir?', en: 'Diagnosis: is your brand ready to go out?' },
    price: { es: 'Gratis · Plan de acción USD 9.99', en: 'Free · Action plan USD 9.99' },
    features: {
      es: ['17 preguntas, 3 minutos: tu nivel de madurez y un comentario por cada punto, gratis y sin llamada de ventas', 'Plan de acción por cada brecha: qué hacer, en qué orden y con qué herramientas (USD 9.99 · $39.900 COP)'],
      en: ['17 questions, 3 minutes: your maturity level and a comment on every point, free and with no sales call', 'An action plan for every gap: what to do, in what order and with which tools (USD 9.99 · $39.900 COP)'],
    },
    secondaryLink: {
      href: '/diagnostico',
      label: { es: 'Hacer el diagnóstico de madurez →', en: 'Take the maturity diagnosis →' },
    },
  },
  {
    step: 2,
    title: { es: 'Plan de crecimiento en los mercados que te sirven', en: 'Growth plan for the markets that fit you' },
    price: { es: 'A medida', en: 'Custom' },
    features: {
      es: ['Cuánto puedes facturar y en qué países, con números', 'Logística internacional, Prep Center y comisiones de cada canal'],
      en: ['How much you can bill and in which countries, with numbers', 'International logistics, Prep Center and each channel\u2019s fees'],
    },
    highlighted: true,
  },
  {
    step: 3,
    title: { es: 'Análisis de mercado y competencia', en: 'Market & competitor analysis' },
    price: { es: 'USD 499', en: 'USD 499' },
    features: {
      es: ['Tu oportunidad real en Amazon y TikTok Shop, mercado por mercado', '2 horas de asesoría 1 a 1 con especialistas, no con un becario'],
      en: ['Your real opportunity on Amazon and TikTok Shop, market by market', '2 hours of 1-on-1 advisory with specialists, not an intern'],
    },
    checkoutPlan: 'analisis_mercado',
  },
];

export default function PlansSection() {
  const { language } = useLanguage();
  const { getAccessToken } = useAuth();
  const spotlight = useSpotlight();
  const [isVisible, setIsVisible] = useState(false);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  // El precio que se va a cobrar, dicho por el servidor. El texto escrito
  // en la tarjeta es el respaldo: si el catálogo contesta, manda él, y la
  // página no puede anunciar una cifra distinta de la que cobra.
  const [prices, setPrices] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    fetchCatalog()
      .then((items) => {
        if (cancelled) return;
        const next: Record<string, string> = {};
        for (const item of items) {
          if (item.displayCop) next[item.plan] = item.displayUsd ? `${item.displayCop} · ${item.displayUsd}` : item.displayCop;
        }
        setPrices(next);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const priceOf = (plan: Plan) =>
    (plan.checkoutPlan && prices[plan.checkoutPlan]) || (language === 'es' ? plan.price.es : plan.price.en);
  // The order summary shown before Stripe opens (see CheckoutSheet).
  const [sheetItem, setSheetItem] = useState<CheckoutItem | null>(null);

  const openSheet = (item: CheckoutItem) => {
    setCheckoutError(null);
    setSheetItem(item);
  };

  const startCheckout = async (checkoutPlan: string) => {
    setCheckoutError(null);
    setCheckingOut(checkoutPlan);
    trackInitiateCheckout({ plan: checkoutPlan });
    try {
      // When logged in, the server verifies this token itself and ties
      // the payment to the account — the client never sends a user id.
      const outcome = await openCheckout(checkoutPlan as CheckoutPlan, getAccessToken());
      if (!outcome.ok) {
        setCheckoutError(checkoutMessage(outcome.reason, language === 'es'));
        setCheckingOut(null);
        return;
      }
      if (isNative) {
        // En la app el pago salió al navegador del sistema; la hoja se
        // cierra y el dashboard se refresca al volver al frente.
        setCheckingOut(null);
        setSheetItem(null);
      }
      return;
    } catch {
      setCheckoutError(
        language === 'es'
          ? 'Los pagos con Stripe aún no están configurados en este entorno.'
          : 'Stripe payments are not configured in this environment yet.'
      );
      setCheckingOut(null);
    }
  };

  const handlePlanClick = (plan: Plan) => {
    if (plan.secondaryLink && !plan.checkoutPlan) {
      // The free diagnosis IS the product here — go straight to it.
      window.location.assign(plan.secondaryLink.href);
      return;
    }
    if (!plan.checkoutPlan) {
      scrollToAnchor('#contacto');
      return;
    }
    openSheet({
      plan: plan.checkoutPlan,
      title: language === 'es' ? plan.title.es : plan.title.en,
      features: language === 'es' ? plan.features.es : plan.features.en,
      priceLabel: priceOf(plan),
    });
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
              ? 'Del diagnóstico gratis al análisis completo de mercado. Empieza donde estés hoy y paga solo por lo que de verdad necesitas.'
              : "From a free diagnosis to a full market analysis. Start where you are today and pay only for what you actually need."}
          </p>
        </div>

        <div className={`grid grid-cols-1 lg:grid-cols-3 gap-8 max-w-6xl mx-auto transition-all duration-700 delay-200 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {plans.map((plan) => (
            <div
              key={plan.step}
              className={plan.highlighted ? 'gradient-border-animated shadow-glow-lg lg:-translate-y-4 transition-transform duration-300 lg:hover:-translate-y-5' : 'contents'}
            >
            <div
              {...spotlight}
              className={`card-spotlight relative rounded-3xl p-8 border flex flex-col h-full transition-transform duration-300 ${
                plan.highlighted
                  ? 'bg-gradient-to-b from-primary to-indigo-950 text-white border-transparent'
                  : 'bg-white border-gray-100 app-shadow hover:shadow-premium-lg hover:-translate-y-1'
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
                {priceOf(plan)}
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
                disabled={checkingOut !== null}
                className={
                  'tap-scale btn-shine ' + (plan.highlighted
                    ? 'rounded-full bg-white text-primary hover:bg-gray-100 border-0 font-bold'
                    : 'rounded-full bg-accent hover:bg-accent/90 text-white border-0')
                }
                onClick={() => handlePlanClick(plan)}
              >
                {plan.checkoutPlan && checkingOut === plan.checkoutPlan ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  language === 'es' ? 'Empezar' : 'Get started'
                )}
              </Button>
              {plan.secondaryLink && (
                <Link
                  href={plan.secondaryLink.href}
                  className="tap-scale-sm mt-3 flex w-full items-center justify-center py-2.5 text-sm font-semibold text-accent hover:underline"
                >
                  {language === 'es' ? plan.secondaryLink.label.es : plan.secondaryLink.label.en}
                </Link>
              )}
              {checkoutError && checkingOut === null && plan.checkoutPlan && (
                <p className={`text-xs mt-2 ${plan.highlighted ? 'text-orange-200' : 'text-red-500'}`}>{checkoutError}</p>
              )}
            </div>
            </div>
          ))}
        </div>
      </div>

      <CheckoutSheet
        item={sheetItem}
        open={sheetItem !== null}
        busy={checkingOut !== null}
        error={checkoutError}
        onConfirm={() => sheetItem && startCheckout(sheetItem.plan)}
        onClose={() => { if (checkingOut === null) setSheetItem(null); }}
      />
    </section>
  );
}
