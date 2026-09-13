import { lazy, Suspense } from 'react';
import Header from '@/components/Header';
import HeroSectionVideo from '@/components/HeroSectionVideo';
import MarqueeLogos from '@/components/MarqueeLogos';
import StatsWidget from '@/components/StatsWidget';
import ServicesSection from '@/components/ServicesSection';
import BenefitsSection from '@/components/BenefitsSection';
import FloatingButtons from '@/components/FloatingButtons';
import MobileTabBar from '@/components/MobileTabBar';

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
      <Suspense fallback={<div className="h-96 bg-primary" />}>
        <GlobalReachSection />
      </Suspense>
      <div id="beneficios">
        <BenefitsSection />
      </div>
      <Suspense fallback={<div className="h-96 bg-white" />}>
        <ImpactSection />
      </Suspense>
      <Suspense fallback={<div className="min-h-screen bg-white" />}>
        <HomeLowerSections />
      </Suspense>
      <FloatingButtons />
      <MobileTabBar />
    </div>
  );
}
