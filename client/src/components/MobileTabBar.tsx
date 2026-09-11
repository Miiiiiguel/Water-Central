import { Home, Calculator, FileSearch, Users, MessageCircle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function MobileTabBar() {
  const { language } = useLanguage();

  const tabs = [
    { icon: Home, label: language === 'es' ? 'Inicio' : 'Home', href: '#inicio' },
    { icon: Calculator, label: language === 'es' ? 'Fletes' : 'Freight', href: '#calculadora' },
    { icon: MessageCircle, label: language === 'es' ? 'Contacto' : 'Contact', href: '#contacto', primary: true },
    { icon: FileSearch, label: language === 'es' ? 'Planes' : 'Plans', href: '#planes' },
    { icon: Users, label: language === 'es' ? 'Equipo' : 'Team', href: '#equipo' },
  ];

  const handleClick = (href: string) => {
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-xl border-t border-gray-100 pb-[env(safe-area-inset-bottom)]"
      aria-label="Navegación principal"
    >
      <div className="flex items-end justify-between px-2 pt-2 pb-2 max-w-md mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          if (tab.primary) {
            return (
              <button
                key={tab.label}
                onClick={() => handleClick(tab.href)}
                className="flex flex-col items-center gap-1 -mt-7 bg-transparent border-0 cursor-pointer"
                aria-label={tab.label}
              >
                <span className="w-14 h-14 rounded-full bg-accent text-white flex items-center justify-center app-shadow border-4 border-white">
                  <Icon size={22} strokeWidth={2.5} />
                </span>
                <span className="text-[10px] font-bold text-accent">{tab.label}</span>
              </button>
            );
          }
          return (
            <button
              key={tab.label}
              onClick={() => handleClick(tab.href)}
              className="flex flex-col items-center gap-1 px-2 py-1 text-muted-foreground hover:text-accent transition-colors bg-transparent border-0 cursor-pointer"
              aria-label={tab.label}
            >
              <Icon size={20} strokeWidth={2.25} />
              <span className="text-[10px] font-semibold">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
