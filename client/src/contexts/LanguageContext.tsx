import { createContext, useContext, useState, ReactNode, useEffect } from 'react';

type Language = 'es' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const translations = {
  es: {
    // Header
    'header.inicio': 'Inicio',
    'header.servicios': 'Servicios',
    'header.beneficios': 'Cómo te ayudamos',
    'header.planes': 'Planes',
    'header.calculadora': 'Calculadora',
    'header.equipo': 'Equipo',
    'header.faq': 'FAQ',
    'header.contacto': 'Contacto',
    'header.prueba': 'Diagnóstico Gratis',

    // Hero
    'hero.badge': 'Finalmente una compañía que hace que las cosas pasen',
    'hero.title1': 'Lleva tu marca',
    'hero.title2': 'a vender en Estados Unidos',
    'hero.title3': 'de forma rápida y responsable',
    'hero.subtitle': 'Desbloqueamos tu verdadero potencial de ecommerce, analizando inversión, costos y el plan de acción que necesitas para tener éxito en Amazon, TikTok Shop y Shopify.',
    'hero.cta1': 'Obtén tu plan de crecimiento',
    'hero.cta2': 'Mira cómo lo hacemos',
    'hero.stat1': '75+',
    'hero.stat1_label': 'Marcas creciendo con nosotros',
    'hero.stat2': '220',
    'hero.stat2_label': 'Destinos internacionales',
    'hero.stat3': '24/7',
    'hero.stat3_label': 'Soporte experto',

    // Services
    'services.title': 'Todo lo que necesitas',
    'services.subtitle': 'para crecer en USA',
    'services.description': 'Trabajamos con los principales marketplaces y aliados para llevar tus productos e historias por el mundo de una manera responsable.',
    'services.service1': 'Nuevos canales de venta',
    'services.service1_desc': 'Te ayudamos a vender en Amazon, TikTok Shop y Shopify.',
    'services.service2': 'Logística internacional',
    'services.service2_desc': 'Envíos puerta a puerta, transporte aéreo y marítimo con los mejores tiempos y tarifas.',
    'services.service3': 'Estrategia ecommerce',
    'services.service3_desc': 'Creamos estrategias personalizadas basadas en datos y objetivos de crecimiento.',
    'services.service4': 'Prep Center en USA',
    'services.service4_desc': 'Recibimos, inspeccionamos, etiquetamos y enviamos tus productos a FBA o clientes finales.',
    'services.service5': 'Inteligencia de mercado',
    'services.service5_desc': 'Analizamos demanda, competencia, precios y tendencias para tomar mejores decisiones.',
    'services.service6': 'Análisis de tu oportunidad',
    'services.service6_desc': 'Evaluamos tu producto, inversión requerida y retorno potencial en el mercado americano.',
    'services.more_info': 'Más Información',
    'services.explore_all': 'Habla con un especialista',

    // Benefits ("Todo lo que necesitas para crecer" block)
    'benefits.title': '¿Estás listo para dejar de perder tu tiempo',
    'benefits.subtitle': 'con agencias que prometen y no cumplen?',
    'benefits.benefit1': 'Estrategia y planeación',
    'benefits.benefit1_desc': 'Mientras otras agencias suponen, nosotros planeamos y lideramos tu estrategia con costos totales, retorno de inversión, contenido y plan de acción.',
    'benefits.benefit2': 'Canales digitales y redes sociales',
    'benefits.benefit2_desc': 'Olvida las páginas bonitas que no venden. Un plan de ecommerce multicanal apoyado en redes sociales, marketplaces y tu página propia.',
    'benefits.benefit3': 'Acelera tu crecimiento',
    'benefits.benefit3_desc': 'Deja de botar dinero en campañas que no funcionan. Aprovechamos tu público y canales para un mejor retorno que vendiendo solo en Latinoamérica.',
    'benefits.benefit4': 'Inteligencia de mercado',
    'benefits.benefit4_desc': 'No más suposiciones. Datos e insights de valor que te ayudan a ver la oportunidad de forma clara.',
    'benefits.benefit5': 'Optimización de ingresos',
    'benefits.benefit5_desc': 'Termina la confusión con tus KPIs. Analizamos tu oportunidad, inversión y procesos para ser eficiente en el mercado americano.',
  },
  en: {
    // Header
    'header.inicio': 'Home',
    'header.servicios': 'Services',
    'header.beneficios': 'How we help',
    'header.planes': 'Plans',
    'header.calculadora': 'Calculator',
    'header.equipo': 'Team',
    'header.faq': 'FAQ',
    'header.contacto': 'Contact',
    'header.prueba': 'Free Diagnosis',

    // Hero
    'hero.badge': 'Finally, a company that makes things happen',
    'hero.title1': 'Take your brand',
    'hero.title2': 'to sell in the United States',
    'hero.title3': 'fast and the right way',
    'hero.subtitle': 'We unlock your true ecommerce potential by analyzing the investment, costs and action plan you need to succeed on Amazon, TikTok Shop and Shopify.',
    'hero.cta1': 'Get your growth plan',
    'hero.cta2': 'See how we do it',
    'hero.stat1': '75+',
    'hero.stat1_label': 'Brands growing with us',
    'hero.stat2': '220',
    'hero.stat2_label': 'International destinations',
    'hero.stat3': '24/7',
    'hero.stat3_label': 'Expert support',

    // Services
    'services.title': 'Everything you need',
    'services.subtitle': 'to grow in the USA',
    'services.description': 'We work with the top marketplaces and partners to take your products and stories around the world responsibly.',
    'services.service1': 'New sales channels',
    'services.service1_desc': 'We help you sell on Amazon, TikTok Shop and Shopify.',
    'services.service2': 'International logistics',
    'services.service2_desc': 'Door-to-door shipping, air and ocean freight with the best times and rates.',
    'services.service3': 'Ecommerce strategy',
    'services.service3_desc': 'We build personalized strategies based on data and growth goals.',
    'services.service4': 'US Prep Center',
    'services.service4_desc': 'We receive, inspect, label and ship your products to FBA or end customers.',
    'services.service5': 'Market intelligence',
    'services.service5_desc': 'We analyze demand, competition, pricing and trends for better decisions.',
    'services.service6': 'Opportunity analysis',
    'services.service6_desc': 'We evaluate your product, required investment and potential return in the US market.',
    'services.more_info': 'More Information',
    'services.explore_all': 'Talk to a specialist',

    // Benefits
    'benefits.title': 'Ready to stop wasting your time',
    'benefits.subtitle': 'with agencies that promise and don’t deliver?',
    'benefits.benefit1': 'Strategy and planning',
    'benefits.benefit1_desc': 'While other agencies guess, we plan and lead your strategy with total costs, ROI, content and an action plan.',
    'benefits.benefit2': 'Digital channels and social media',
    'benefits.benefit2_desc': 'Forget pretty websites that don’t sell. A multichannel ecommerce plan across social media, marketplaces and your own site.',
    'benefits.benefit3': 'Accelerate your growth',
    'benefits.benefit3_desc': 'Stop throwing money at campaigns that don’t work. We leverage your audience and channels for a better return than selling only in Latin America.',
    'benefits.benefit4': 'Market intelligence',
    'benefits.benefit4_desc': 'No more guesswork. Valuable data and insights to help you see the opportunity clearly.',
    'benefits.benefit5': 'Revenue optimization',
    'benefits.benefit5_desc': 'End the confusion with your KPIs. We analyze your opportunity, investment and processes to be efficient in the US market.',
  },
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('es');
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Detectar idioma solo en cliente
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('language');
        if (saved === 'es' || saved === 'en') {
          setLanguageState(saved);
        } else {
          const browserLang = navigator.language.split('-')[0];
          const detectedLang = browserLang === 'en' ? 'en' : 'es'; // Default ES for LatAm audience
          setLanguageState(detectedLang);
        }
      } catch (e) {
        // localStorage no disponible
      }
    }
    setIsInitialized(true);
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('language', lang);
      } catch (e) {
        // localStorage no disponible
      }
    }
  };

  const t = (key: string): string => {
    return translations[language][key as keyof typeof translations['es']] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    // Retornar un valor por defecto en lugar de lanzar error
    return {
      language: 'es' as Language,
      setLanguage: () => {},
      t: (key: string) => key,
    };
  }
  return context;
}
