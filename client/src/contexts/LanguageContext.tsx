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
    'header.calculadora': 'Calculadora de fletes',
    'header.diagnostico': 'Diagnóstico',
    'header.pronostico': 'Pronóstico',
    'header.equipo': 'Equipo',
    'header.faq': 'FAQ',
    'header.contacto': 'Contacto',
    'header.prueba': 'Hablemos',

    // Hero
    'hero.badge': 'Cero promesas. Números.',
    'hero.title1': 'Vende tu marca',
    'hero.title2': 'en todo el mundo',
    'hero.title3': 'sin adivinar nada',
    'hero.subtitle': 'Estados Unidos, Europa, México, Canadá: donde esté tu comprador. Te decimos cuánto cuesta entrar, cuánto vuelve y en cuánto tiempo. Y si tu producto no da, también te lo decimos.',
    'hero.cta1': 'Quiero mi plan',
    'hero.cta2': 'Ver cómo funciona',
    'hero.stat1': '75+',
    'hero.stat1_label': 'Marcas creciendo con nosotros',
    'hero.stat2': '220',
    'hero.stat2_label': 'Destinos en todo el mundo',
    'hero.stat3': '24/7',
    'hero.stat3_label': 'Soporte experto',

    // Services
    'services.title': 'Todo lo que necesitas',
    'services.subtitle': 'para vender en cualquier país',
    'services.description': 'Marketplaces, logística y datos. Tu producto sale de Latinoamérica y llega a Estados Unidos, Europa o Asia sin que tengas que volverte experto en comercio exterior.',
    'services.service1': 'Nuevos canales de venta',
    'services.service1_desc': 'Amazon, TikTok Shop y Shopify. En USA, Europa o México: donde compre tu cliente.',
    'services.service2': 'Logística internacional',
    'services.service2_desc': 'Puerta a puerta, aéreo y marítimo, a 220 destinos. Tarifas reales, no estimados de cortesía.',
    'services.service3': 'Estrategia ecommerce',
    'services.service3_desc': 'Un plan con números: inversión, margen, precio y calendario. No un PDF bonito.',
    'services.service4': 'Prep Center en USA',
    'services.service4_desc': 'Recibimos, inspeccionamos, etiquetamos y despachamos a FBA o a tu cliente final.',
    'services.service5': 'Inteligencia de mercado',
    'services.service5_desc': 'Demanda, competencia y precios reales, país por país. Antes de que gastes un peso.',
    'services.service6': 'Análisis de tu oportunidad',
    'services.service6_desc': 'Cuánto tienes que invertir, cuánto puedes facturar y en cuánto tiempo. Por mercado.',
    'services.more_info': 'Más información',
    'services.explore_all': 'Habla con un especialista',

    // Benefits ("Todo lo que necesitas para crecer" block)
    'benefits.title': '¿Cuántas agencias te prometieron',
    'benefits.subtitle': 'y no te movieron una sola venta?',
    'benefits.benefit1': 'Estrategia con números',
    'benefits.benefit1_desc': 'Otras agencias suponen. Nosotros ponemos costos totales, retorno y fecha. Si no cierra, te lo decimos antes de que pongas la plata.',
    'benefits.benefit2': 'Canales que sí venden',
    'benefits.benefit2_desc': 'Olvídate de la página bonita que nadie visita. Marketplaces, redes y tienda propia trabajando juntos.',
    'benefits.benefit3': 'Crece fuera de tu país',
    'benefits.benefit3_desc': 'Deja de pelear por el mismo mercado local. El mismo producto vale más afuera: USA, Europa, México, Medio Oriente.',
    'benefits.benefit4': 'Datos, no corazonadas',
    'benefits.benefit4_desc': 'Demanda real, competencia real, precios reales. Nada de "creemos que funcionaría".',
    'benefits.benefit5': 'Margen, no vanity metrics',
    'benefits.benefit5_desc': 'Los likes no pagan nómina. Medimos lo que queda después de comisiones, flete e impuestos.',
  },
  en: {
    // Header
    'header.inicio': 'Home',
    'header.servicios': 'Services',
    'header.beneficios': 'How we help',
    'header.planes': 'Plans',
    'header.calculadora': 'Freight calculator',
    'header.diagnostico': 'Diagnosis',
    'header.pronostico': 'Forecast',
    'header.equipo': 'Team',
    'header.faq': 'FAQ',
    'header.contacto': 'Contact',
    'header.prueba': "Let's talk",

    // Hero
    'hero.badge': 'No promises. Numbers.',
    'hero.title1': 'Sell your brand',
    'hero.title2': 'worldwide',
    'hero.title3': 'without guessing',
    'hero.subtitle': 'The US, Europe, Mexico, Canada — wherever your buyer is. We tell you what it costs to enter, what comes back and how long it takes. And if your product will not work, we tell you that too.',
    'hero.cta1': 'Get my plan',
    'hero.cta2': 'See how it works',
    'hero.stat1': '75+',
    'hero.stat1_label': 'Brands growing with us',
    'hero.stat2': '220',
    'hero.stat2_label': 'Destinations worldwide',
    'hero.stat3': '24/7',
    'hero.stat3_label': 'Expert support',

    // Services
    'services.title': 'Everything you need',
    'services.subtitle': 'to sell in any country',
    'services.description': 'Marketplaces, logistics and data. Your product leaves Latin America and reaches the US, Europe or Asia without you becoming a trade expert first.',
    'services.service1': 'New sales channels',
    'services.service1_desc': 'Amazon, TikTok Shop and Shopify. In the US, Europe or Mexico — wherever your customer buys.',
    'services.service2': 'International logistics',
    'services.service2_desc': 'Door to door, air and ocean, to 220 destinations. Real rates, not courtesy estimates.',
    'services.service3': 'Ecommerce strategy',
    'services.service3_desc': 'A plan with numbers: investment, margin, price and a calendar. Not a pretty PDF.',
    'services.service4': 'US Prep Center',
    'services.service4_desc': 'We receive, inspect, label and ship your products to FBA or your end customer.',
    'services.service5': 'Market intelligence',
    'services.service5_desc': 'Real demand, competition and prices, country by country. Before you spend a dollar.',
    'services.service6': 'Opportunity analysis',
    'services.service6_desc': 'How much you must invest, how much you can bill and how long it takes. Per market.',
    'services.more_info': 'More information',
    'services.explore_all': 'Talk to a specialist',

    // Benefits
    'benefits.title': 'How many agencies promised you',
    'benefits.subtitle': 'and never moved a single sale?',
    'benefits.benefit1': 'Strategy with numbers',
    'benefits.benefit1_desc': 'Other agencies guess. We put total costs, return and a date on the table. If it does not add up, we say so before you spend.',
    'benefits.benefit2': 'Channels that actually sell',
    'benefits.benefit2_desc': 'Forget the pretty site nobody visits. Marketplaces, social and your own store working together.',
    'benefits.benefit3': 'Grow outside your country',
    'benefits.benefit3_desc': 'Stop fighting for the same local market. The same product is worth more abroad: US, Europe, Mexico, Middle East.',
    'benefits.benefit4': 'Data, not hunches',
    'benefits.benefit4_desc': 'Real demand, real competition, real prices. No more "we think this would work".',
    'benefits.benefit5': 'Margin, not vanity metrics',
    'benefits.benefit5_desc': 'Likes do not make payroll. We measure what is left after fees, freight and taxes.',
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

  // Keep <html lang> in sync — screen readers and search engines rely on
  // it, and it was hardcoded to "es" regardless of the toggle before this.
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

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
