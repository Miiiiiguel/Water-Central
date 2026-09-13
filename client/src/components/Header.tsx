import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { Menu, X, Calculator, FileSearch, TrendingUp, MessageCircle, UserCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import LanguageSwitcher from './LanguageSwitcher';

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { t, language } = useLanguage();
  const { user } = useAuth();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleResize = () => { if (window.innerWidth >= 1024) setIsOpen(false); };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toolPills = [
    { label: t('header.calculadora'), href: '#calculadora', icon: Calculator },
    { label: t('header.diagnostico'), href: '#planes', icon: FileSearch },
    { label: t('header.pronostico'), href: '#pronostico', icon: TrendingUp },
  ];

  const menuItems = [
    { label: t('header.inicio'), href: '#inicio' },
    { label: t('header.servicios'), href: '#servicios' },
    { label: t('header.equipo'), href: '#equipo' },
    { label: t('header.faq'), href: '#faq' },
  ];

  const handleNavClick = (href: string) => {
    setIsOpen(false);
    setTimeout(() => {
      const el = document.querySelector(href);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  };

  const handleCtaClick = () => {
    setIsOpen(false);
    setTimeout(() => {
      const contactEl = document.getElementById('contacto');
      if (contactEl) {
        contactEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  };

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-white/95 backdrop-blur-xl border-b border-gray-100 shadow-sm'
          : 'bg-white/70 backdrop-blur-xl border-b border-transparent'
      }`}
    >
      <div className="container flex items-center justify-between h-16 md:h-20 gap-3">
        {/* Logo */}
        <button
          onClick={() => handleNavClick('#inicio')}
          className="tap-scale-sm flex items-center group hover-scale flex-shrink-0 bg-transparent border-0 p-0 cursor-pointer"
        >
          <span className="font-logo text-2xl md:text-3xl tracking-tight leading-none">
            <span className="text-accent">easy</span>
            <span className="text-primary">comex</span>
          </span>
        </button>

        {/* Desktop tool pills */}
        <nav className="hidden lg:flex items-center gap-2 flex-1 justify-center">
          {toolPills.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.label}
                onClick={() => handleNavClick(item.href)}
                className="tap-scale-sm pill-nav-item flex items-center gap-2 rounded-full bg-secondary text-secondary-foreground hover:bg-orange-100 hover:scale-105 px-4 py-2.5 text-sm font-bold whitespace-nowrap bg-transparent border-0 cursor-pointer"
                style={{ backgroundColor: 'var(--secondary)' }}
              >
                <Icon size={16} strokeWidth={2.5} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Right Section */}
        <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
          <Link
            href={user ? '/dashboard' : '/login'}
            className="hidden sm:flex items-center gap-1.5 p-2 rounded-full hover:bg-orange-50 text-primary transition-colors"
            aria-label={user ? (language === 'es' ? 'Mi cuenta' : 'My account') : (language === 'es' ? 'Ingresar' : 'Log in')}
          >
            <UserCircle2 size={22} strokeWidth={2} />
          </Link>

          <LanguageSwitcher />

          <Button
            className="tap-scale hidden md:inline-flex rounded-full bg-primary hover:bg-primary/90 text-white border-0 app-shadow transition-all duration-300 hover:scale-105 text-sm font-bold px-5 lg:px-6 gap-2"
            onClick={handleCtaClick}
          >
            <MessageCircle size={16} strokeWidth={2.5} />
            {t('header.prueba')}
          </Button>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="lg:hidden p-2 hover:bg-orange-50 rounded-full transition-colors bg-transparent border-0 cursor-pointer"
            aria-label={isOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isOpen}
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div
        className={`lg:hidden overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? 'max-h-[640px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <nav className="container py-4 flex flex-col gap-4 border-t border-gray-100 bg-white/95 backdrop-blur-xl">
          <div className="flex flex-col gap-2">
            {toolPills.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  onClick={() => handleNavClick(item.href)}
                  className="flex items-center gap-3 text-secondary-foreground bg-secondary hover:bg-orange-100 transition-all py-3 px-4 rounded-2xl font-bold text-left border-0 cursor-pointer w-full"
                >
                  <Icon size={18} strokeWidth={2.5} />
                  {item.label}
                </button>
              );
            })}
          </div>
          <div className="flex flex-col gap-1 pt-2 border-t border-gray-100">
            {menuItems.map((item) => (
              <button
                key={item.label}
                onClick={() => handleNavClick(item.href)}
                className="text-foreground hover:text-accent hover:bg-orange-50 transition-all py-3 px-4 rounded-xl font-medium text-left bg-transparent border-0 cursor-pointer w-full"
              >
                {item.label}
              </button>
            ))}
            <Link
              href={user ? '/dashboard' : '/login'}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 text-foreground hover:text-accent hover:bg-orange-50 transition-all py-3 px-4 rounded-xl font-medium"
            >
              <UserCircle2 size={18} />
              {user ? (language === 'es' ? 'Mi cuenta' : 'My account') : (language === 'es' ? 'Ingresar' : 'Log in')}
            </Link>
          </div>
          <Button
            className="w-full rounded-full bg-primary hover:bg-primary/90 text-white border-0 mt-1 py-5 font-bold gap-2"
            onClick={handleCtaClick}
          >
            <MessageCircle size={18} strokeWidth={2.5} />
            {t('header.prueba')}
          </Button>
        </nav>
      </div>
    </header>
  );
}
