import { lazy, Suspense } from 'react';
import Header from '@/components/Header';
import HeroSectionVideo from '@/components/HeroSectionVideo';
import MarqueeLogos from '@/components/MarqueeLogos';
import StatsWidget from '@/components/StatsWidget';
import ServicesSection from '@/components/ServicesSection';
import BenefitsSection from '@/components/BenefitsSection';
import ImpactSection from '@/components/ImpactSection';
import VSLPlayerSection from '@/components/VSLPlayerSection';
import VSLSection from '@/components/VSLSection';
import PlansSection from '@/components/PlansSection';
import FreightSection from '@/components/FreightSection';
import TeamSection from '@/components/TeamSection';
import TestimonialsSection from '@/components/TestimonialsSection';
import FAQSection from '@/components/FAQSection';
import ContactFormExpanded from '@/components/ContactFormExpanded';
import CTASection from '@/components/CTASection';
import Footer from '@/components/Footer';
import FloatingButtons from '@/components/FloatingButtons';
import MobileTabBar from '@/components/MobileTabBar';

const GlobalReachSection = lazy(() => import('@/components/GlobalReachSection'));

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
      <ImpactSection />
      <VSLPlayerSection />
      <div id="pronostico">
        <VSLSection />
      </div>
      <TestimonialsSection />
      <div id="planes">
        <PlansSection />
      </div>
      <FreightSection />
      <TeamSection />
      <FAQSection />
      <div id="contacto">
        <ContactFormExpanded />
      </div>
      <CTASection />
      <Footer />
      <FloatingButtons />
      <MobileTabBar />
    </div>
  );
}
