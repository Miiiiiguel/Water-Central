// Everything below the first two screens of the home page, bundled as one
// lazy chunk. The main bundle then only carries what is needed for the
// first paint (header, hero, stats, services); this chunk starts loading
// right after and mounts while the user is still reading the hero. On a
// throttled phone this cuts main-thread long tasks during load by ~40%.
//
// Section ids (#pronostico, #planes, #contacto) live here so anchor links
// and Marco Polo's "action" scrolls keep working.
import VSLPlayerSection from '@/components/VSLPlayerSection';
import VSLSection from '@/components/VSLSection';
import TestimonialsSection from '@/components/TestimonialsSection';
import PlansSection from '@/components/PlansSection';
import FreightSection from '@/components/FreightSection';
import TeamSection from '@/components/TeamSection';
import FAQSection from '@/components/FAQSection';
import ContactFormExpanded from '@/components/ContactFormExpanded';
import CTASection from '@/components/CTASection';
import Footer from '@/components/Footer';

export default function HomeLowerSections() {
  return (
    <>
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
    </>
  );
}
