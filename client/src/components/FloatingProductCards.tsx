import { useState } from 'react';
import { X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface Product {
  emoji: string;
  name: { es: string; en: string };
  subtitleLeft: { es: string; en: string };
  subtitleRight: { es: string; en: string };
}

const products: Product[] = [
  { emoji: '☕', name: { es: 'Café de origen', en: 'Origin coffee' }, subtitleLeft: { es: 'Sierra Nevada', en: 'Sierra Nevada' }, subtitleRight: { es: 'Best seller', en: 'Best seller' } },
  { emoji: '💄', name: { es: 'Cosmética natural', en: 'Natural cosmetics' }, subtitleLeft: { es: 'Skincare', en: 'Skincare' }, subtitleRight: { es: 'Top rated', en: 'Top rated' } },
  { emoji: '🩱', name: { es: 'Fajas y shapewear', en: 'Shapewear' }, subtitleLeft: { es: 'Moda', en: 'Fashion' }, subtitleRight: { es: "Amazon's choice", en: "Amazon's choice" } },
  { emoji: '🍫', name: { es: 'Cacao y snacks', en: 'Cacao & snacks' }, subtitleLeft: { es: 'Alimentos', en: 'Food' }, subtitleRight: { es: 'Gourmet', en: 'Gourmet' } },
  { emoji: '👜', name: { es: 'Artesanías Wayuu', en: 'Wayuu crafts' }, subtitleLeft: { es: 'Accesorios', en: 'Accessories' }, subtitleRight: { es: 'Handmade', en: 'Handmade' } },
];

function ProductWidget({ platform, side }: { platform: 'tiktok' | 'amazon'; side: 'left' | 'right' }) {
  const { language } = useLanguage();
  const [closed, setClosed] = useState(false);
  if (closed) return null;

  const title = platform === 'tiktok'
    ? (language === 'es' ? 'TikTok Shop' : 'TikTok Shop')
    : 'Amazon';
  const subtitle = platform === 'tiktok'
    ? (language === 'es' ? 'Productos colombianos más vendidos' : "Colombia's top-selling products")
    : (language === 'es' ? 'Los mismos productos en Amazon' : 'The same products on Amazon');

  return (
    <div
      className={`hidden xl:block absolute top-1/2 -translate-y-1/2 ${side === 'left' ? 'left-4 2xl:left-10 -rotate-2' : 'right-4 2xl:right-10 rotate-2'} w-64 bg-white/95 backdrop-blur-md rounded-2xl shadow-premium-lg border border-white/60 p-4 z-20 animate-float`}
      style={{ animationDuration: side === 'left' ? '7s' : '8s', animationDelay: side === 'left' ? '0s' : '1s' }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-6 h-6 rounded-md bg-primary text-white flex items-center justify-center text-[10px] font-black">
            {platform === 'tiktok' ? '♪' : 'a'}
          </span>
          <div>
            <p className="text-xs font-black text-primary leading-tight">{title}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">{subtitle}</p>
          </div>
        </div>
        <button
          onClick={() => setClosed(true)}
          className="text-gray-300 hover:text-gray-500 transition-colors bg-transparent border-0 cursor-pointer p-0.5"
          aria-label="Cerrar"
        >
          <X size={14} />
        </button>
      </div>
      <div className="space-y-2.5">
        {products.map((p) => (
          <div key={p.name.es} className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-base flex-shrink-0">
              {p.emoji}
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-foreground truncate">{language === 'es' ? p.name.es : p.name.en}</p>
              <p className="text-[10px] text-muted-foreground truncate">
                {language === 'es'
                  ? (side === 'left' ? p.subtitleLeft.es : p.subtitleRight.es)
                  : (side === 'left' ? p.subtitleLeft.en : p.subtitleRight.en)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FloatingProductCards() {
  return (
    <>
      <ProductWidget platform="tiktok" side="left" />
      <ProductWidget platform="amazon" side="right" />
    </>
  );
}
