import { useLanguage } from '@/contexts/LanguageContext';

const partners = ['Meta', 'Instagram', 'YouTube', 'Amazon', 'TikTok Shop', 'Shopify', 'Walmart', 'USPS'];
const track = [...partners, ...partners];

export default function MarqueeLogos() {
  const { language } = useLanguage();

  return (
    <div className="bg-white pb-8 pt-2 relative overflow-hidden">
      <p className="text-center text-xs md:text-sm font-bold text-muted-foreground uppercase tracking-widest mb-6">
        {language === 'es' ? 'Trabajamos con los principales marketplaces y aliados' : 'We work with the top marketplaces and partners'}
      </p>
      <div className="relative overflow-hidden mask-fade">
        <div className="flex w-max gap-3 animate-marquee">
          {track.map((name, i) => (
            <span
              key={`${name}-${i}`}
              className="flex-shrink-0 px-6 py-3 rounded-2xl bg-secondary/60 border border-orange-100 text-primary font-black text-sm md:text-base whitespace-nowrap"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
