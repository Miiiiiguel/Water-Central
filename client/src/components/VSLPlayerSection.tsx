import { useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Sparkles } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface VSLPlayerSectionProps {
  youtubeId?: string;
}

export default function VSLPlayerSection({ youtubeId }: VSLPlayerSectionProps) {
  const { language } = useLanguage();
  const [playing, setPlaying] = useState(false);

  return (
    <section id="vsl" className="py-20 md:py-32 bg-gradient-to-b from-gray-50 to-white relative overflow-hidden">
      <div className="container relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6 }}
          className="text-center max-w-2xl mx-auto mb-10"
        >
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-secondary rounded-full mb-5">
            <Sparkles size={14} className="text-accent" />
            <span className="text-accent text-xs font-bold uppercase tracking-wide">
              {language === 'es' ? 'Mira cómo lo hacemos' : 'See how we do it'}
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-primary">
            {language === 'es' ? 'De marca local a' : 'From local brand to'}
            <span className="text-accent"> {language === 'es' ? 'vendida en el mundo' : 'selling worldwide'}</span>
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7 }}
          className="max-w-4xl mx-auto"
        >
          <div className="relative rounded-3xl overflow-hidden app-shadow aspect-video bg-gradient-to-br from-primary via-indigo-950 to-primary">
            {youtubeId && playing ? (
              <iframe
                className="absolute inset-0 w-full h-full"
                src={`https://www.youtube.com/embed/${youtubeId}?autoplay=1`}
                title="Easycomex VSL"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <button
                onClick={() => youtubeId && setPlaying(true)}
                className="absolute inset-0 w-full h-full flex flex-col items-center justify-center gap-4 bg-transparent border-0 cursor-pointer group"
                aria-label="Play video"
              >
                <div className="absolute inset-0 opacity-20">
                  <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-accent rounded-full blur-3xl"></div>
                  <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-indigo-400 rounded-full blur-3xl"></div>
                </div>
                <span className="relative w-20 h-20 rounded-full bg-white flex items-center justify-center app-shadow group-hover:scale-110 transition-transform duration-300">
                  <Play size={30} className="text-accent fill-accent ml-1" />
                </span>
                <span className="relative text-white/80 text-sm font-semibold">
                  {youtubeId
                    ? (language === 'es' ? 'Reproducir video' : 'Play video')
                    : (language === 'es' ? 'Video muy pronto' : 'Video coming soon')}
                </span>
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
