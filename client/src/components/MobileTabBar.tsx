import { useLocation } from 'wouter';
import { Home, FileSearch, UserCircle2, MessageCircle, Globe2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { hapticTap } from '@/lib/native';

export default function MobileTabBar() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const tabs = [
    { icon: Home, label: language === 'es' ? 'Inicio' : 'Home', action: () => scrollTo('#inicio') },
    { icon: Globe2, label: language === 'es' ? 'Mercados' : 'Markets', action: () => scrollTo('#inteligencia') },
    { icon: MessageCircle, label: language === 'es' ? 'Contacto' : 'Contact', action: () => scrollTo('#contacto'), primary: true },
    { icon: FileSearch, label: language === 'es' ? 'Planes' : 'Plans', action: () => scrollTo('#planes') },
    { icon: UserCircle2, label: user ? (language === 'es' ? 'Cuenta' : 'Account') : (language === 'es' ? 'Ingresar' : 'Log in'), action: () => navigate(user ? '/dashboard' : '/login') },
  ];

  function scrollTo(href: string) {
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

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
                onClick={() => { hapticTap(); tab.action(); }}
                className="tap-scale flex flex-col items-center gap-1 -mt-7 bg-transparent border-0 cursor-pointer"
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
              onClick={() => { hapticTap(); tab.action(); }}
              className="tap-scale-sm flex flex-col items-center gap-1 px-2 py-1 text-muted-foreground hover:text-accent transition-colors bg-transparent border-0 cursor-pointer"
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
