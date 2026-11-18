import { Suspense, lazy, useEffect } from 'react';
import { scrollToAnchor } from '@/lib/scrollToAnchor';
import Header from '@/components/Header';
import HeroSectionVideo from '@/components/HeroSectionVideo';
import MarqueeLogos from '@/components/MarqueeLogos';
import StatsWidget from '@/components/StatsWidget';
import ServicesSection from '@/components/ServicesSection';
import BenefitsSection from '@/components/BenefitsSection';
import FloatingButtons from '@/components/FloatingButtons';
import MobileTabBar from '@/components/MobileTabBar';
import Deferred from '@/components/Deferred';
import { useLanguage } from '@/contexts/LanguageContext';

// La portada abre con la presentación y la calculadora ROI; todo lo
// demás va debajo, como servicios adicionales.
const RoiCalculator = lazy(() => import('./RoiCalculator'));
const MarketIntelSection = lazy(() => import('@/components/MarketIntelSection'));
const GlobalReachSection = lazy(() => import('@/components/GlobalReachSection'));
// recharts is ~400KB — only the charts section needs it, so it loads
// after the above-the-fold content instead of blocking it.
const ImpactSection = lazy(() => import('@/components/ImpactSection'));
// Plans, freight, team, FAQ, contact, footer: one chunk that loads right
// after first paint so the initial JS parse stays short on phones.
const HomeLowerSections = lazy(() => import('@/components/HomeLowerSections'));

/** El corte entre la calculadora y el resto de la portada. */
function ServiciosAdicionales() {
  const { language } = useLanguage();
  const es = language === 'es';
  return (
    <section id="servicios-adicionales" className="scroll-mt-20 bg-primary px-4 pb-4 pt-16 text-center md:pt-20">
      <span className="inline-flex items-center rounded-full bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-orange-300">
        {es ? 'Además de la calculadora' : 'Beyond the calculator'}
      </span>
      <h2 className="mx-auto mt-4 max-w-3xl text-3xl font-black text-white md:text-5xl">
        {es ? 'Servicios adicionales' : 'Additional services'}
      </h2>
      <p className="mx-auto mt-3 max-w-2xl text-base text-indigo-200 md:text-lg">
        {es
          ? 'Fletes internacionales, inteligencia de mercado, ruta exportadora y el equipo que te acompaña a vender en Estados Unidos.'
          : 'International freight, market intelligence, an export roadmap and the team that helps you sell in the US.'}
      </p>
    </section>
  );
}

export default function Home() {
  // Llegar con "/#contacto" desde otro sitio (el plugin de WordPress
  // manda así las páginas viejas) tiene que bajar a esa sección. El
  // navegador solo no lo hace: las secciones de abajo todavía no
  // existen cuando carga la página. Sólo anclas simples: el regreso del
  // login con Google también trae un "#", con el token adentro.
  //
  // Bajar una vez no alcanza: mientras terminan de cargar las secciones
  // de arriba (gráficos, imágenes) la página crece y la sección se corre
  // para abajo. Se vuelve a alinear un par de veces, salvo que la
  // persona ya se haya puesto a mover la página por su cuenta.
  useEffect(() => {
    const ancla = window.location.hash;
    if (!/^#[a-z][a-z0-9-]*$/.test(ancla)) return;
    scrollToAnchor(ancla, 5000);

    let tocada = false;
    const soltar = () => { tocada = true; };
    const eventos = ['wheel', 'touchstart', 'keydown', 'mousedown'] as const;
    eventos.forEach((e) => window.addEventListener(e, soltar, { passive: true }));
    const relojes = [1500, 3000, 4500].map((ms) =>
      window.setTimeout(() => {
        if (tocada) return;
        const el = document.querySelector(ancla);
        if (el && Math.abs(el.getBoundingClientRect().top) > 80) el.scrollIntoView({ block: 'start' });
      }, ms)
    );
    return () => {
      relojes.forEach((t) => window.clearTimeout(t));
      eventos.forEach((e) => window.removeEventListener(e, soltar));
    };
  }, []);

  return (
    <div className="min-h-screen bg-primary pb-20 md:pb-0">
      <Header />
      <div id="inicio">
        <HeroSectionVideo />
      </div>
      <div id="roi" className="scroll-mt-20">
        <Suspense fallback={<div className="min-h-screen bg-white" />}>
          <RoiCalculator embebido />
        </Suspense>
      </div>
      <ServiciosAdicionales />
      <MarqueeLogos />
      <StatsWidget />
      <div id="servicios">
        <ServicesSection />
      </div>
      {/* Todo lo de acá abajo se descarga cuando se está por ver. Quien
          lee el encabezado y se va a cotizar no se baja el globo 3D ni
          las gráficas: es más de un megabyte que nunca iba a mirar.
          Cada placeholder reserva el alto de su sección para que la
          página no salte cuando aparece. */}
      <Deferred id="inteligencia" placeholderClassName="min-h-[46rem] bg-white">
        <MarketIntelSection />
      </Deferred>
      <Deferred placeholderClassName="h-96 bg-primary">
        <GlobalReachSection />
      </Deferred>
      <div id="beneficios">
        <BenefitsSection />
      </div>
      <Deferred placeholderClassName="h-96 bg-white">
        <ImpactSection />
      </Deferred>
      <Deferred placeholderClassName="min-h-screen bg-white">
        <HomeLowerSections />
      </Deferred>
      <FloatingButtons />
      <MobileTabBar />
    </div>
  );
}
