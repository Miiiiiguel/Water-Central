import Header from '@/components/Header';
import HeroSectionVideo from '@/components/HeroSectionVideo';
import MarqueeLogos from '@/components/MarqueeLogos';
import StatsWidget from '@/components/StatsWidget';
import ServicesSection from '@/components/ServicesSection';
import BenefitsSection from '@/components/BenefitsSection';
import VSLSection from '@/components/VSLSection';
import PlansSection from '@/components/PlansSection';
import FreightSection from '@/components/FreightSection';
import TeamSection from '@/components/TeamSection';
import FAQSection from '@/components/FAQSection';
import ContactFormExpanded from '@/components/ContactFormExpanded';
import CTASection from '@/components/CTASection';
import Footer from '@/components/Footer';
import FloatingButtons from '@/components/FloatingButtons';
import MobileTabBar from '@/components/MobileTabBar';

export default function Home() {
  return (
    <div className="min-h-screen bg-white pb-20 md:pb-0">
      <Header />
      <div id="inicio">
        <HeroSectionVideo />
      </div>
      <MarqueeLogos />
      <StatsWidget />
      <div id="servicios">
        <ServicesSection />
      </div>
      <div id="beneficios">
        <BenefitsSection />
      </div>
      <div id="pronostico">
        <VSLSection />
      </div>
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
