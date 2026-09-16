import { lazy } from 'react';
import Header from '@/components/Header';
import HeroSectionVideo from '@/components/HeroSectionVideo';
import MarqueeLogos from '@/components/MarqueeLogos';
import StatsWidget from '@/components/StatsWidget';
import ServicesSection from '@/components/ServicesSection';
import BenefitsSection from '@/components/BenefitsSection';
import FloatingButtons from '@/components/FloatingButtons';
import MobileTabBar from '@/components/MobileTabBar';
import Deferred from '@/components/Deferred';

const MarketIntelSection = lazy(() => import('@/components/MarketIntelSection'));
const GlobalReachSection = lazy(() => import('@/components/GlobalReachSection'));
// recharts is ~400KB — only the charts section needs it, so it loads
// after the above-the-fold content instead of blocking it.
const ImpactSection = lazy(() => import('@/components/ImpactSection'));
// Plans, freight, team, FAQ, contact, footer: one chunk that loads right
// after first paint so the initial JS parse stays short on phones.
const HomeLowerSections = lazy(() => import('@/components/HomeLowerSections'));

export default function Home() {
  return (
    <div className="min-h-screen bg-primary pb-20 md:pb-0">
      <Header />
      <div id="inicio">
        <HeroSectionVideo />
      </div>
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
