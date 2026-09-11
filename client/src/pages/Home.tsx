import Header from '@/components/Header';
import HeroSectionVideo from '@/components/HeroSectionVideo';
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

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <div id="inicio">
        <HeroSectionVideo />
      </div>
      <div id="servicios">
        <ServicesSection />
      </div>
      <div id="beneficios">
        <BenefitsSection />
      </div>
      <VSLSection />
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
    </div>
  );
}
