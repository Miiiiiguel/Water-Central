import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';

export default function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="flex items-center gap-0.5 bg-gray-100 rounded-full p-0.5" role="group" aria-label="Language selector">
      <Button
        onClick={() => setLanguage('en')}
        variant={language === 'en' ? 'default' : 'ghost'}
        size="sm"
        className={`rounded-full px-3 py-1 text-xs font-semibold transition-all duration-200 h-7 ${
          language === 'en'
            ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-sm'
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
        }`}
        aria-label="Switch to English"
        aria-pressed={language === 'en'}
      >
        EN
      </Button>
      <Button
        onClick={() => setLanguage('es')}
        variant={language === 'es' ? 'default' : 'ghost'}
        size="sm"
        className={`rounded-full px-3 py-1 text-xs font-semibold transition-all duration-200 h-7 ${
          language === 'es'
            ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-sm'
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
        }`}
        aria-label="Cambiar a Español"
        aria-pressed={language === 'es'}
      >
        ES
      </Button>
    </div>
  );
}
