import { useState, useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import LanguageSwitcher from './LanguageSwitcher';

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { t } = useLanguage();

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

  const navItems = [
    { label: t('header.inicio'), href: '#inicio' },
    { label: t('header.servicios'), href: '#servicios' },
    { label: t('header.planes'), href: '#planes' },
    { label: t('header.calculadora'), href: '#calculadora' },
    { label: t('header.equipo'), href: '#equipo' },
    { label: t('header.faq'), href: '#faq' },
    { label: t('header.contacto'), href: '#contacto' },
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
          ? 'bg-white/95 backdrop-blur-xl border-b border-gray-200 shadow-sm'
          : 'bg-white/10 backdrop-blur-xl border-b border-white/20'
      }`}
    >
      <div className="container flex items-center justify-between h-16 md:h-20">
        {/* Logo */}
        <button 
          onClick={() => handleNavClick('#inicio')}
          className="flex items-center gap-2 group hover-scale flex-shrink-0 bg-transparent border-0 p-0 cursor-pointer"
        >
          <div className="w-9 h-9 md:w-10 md:h-10 bg-gradient-to-br from-blue-600 to-cyan-500 rounded-lg flex items-center justify-center shadow-glow group-hover:shadow-glow-lg transition-all">
            <span className="text-white font-bold text-base md:text-lg">E</span>
          </div>
          <span className="font-bold text-lg md:text-xl text-primary hidden sm:inline bg-gradient-to-r from-primary to-cyan-600 bg-clip-text text-transparent">
            easycomex
          </span>
        </button>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-6 xl:gap-8">
          {navItems.map((item, index) => (
            <button
              key={item.label}
              onClick={() => handleNavClick(item.href)}
              className="text-foreground hover:text-accent transition-colors text-sm font-medium relative group whitespace-nowrap bg-transparent border-0 p-0 cursor-pointer"
              style={{ transitionDelay: `${index * 50}ms` }}
            >
              {item.label}
              <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-accent to-cyan-600 group-hover:w-full transition-all duration-300"></span>
            </button>
          ))}
        </nav>

        {/* Right Section */}
        <div className="flex items-center gap-2 md:gap-4">
          {/* Language Switcher */}
          <LanguageSwitcher />

          {/* CTA Button */}
          <Button
            className="hidden md:inline-flex bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white border-0 shadow-glow hover:shadow-glow-lg transition-all duration-300 hover:scale-105 text-sm px-4 lg:px-6"
            onClick={handleCtaClick}
          >
            {t('header.prueba')}
          </Button>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors bg-transparent border-0 cursor-pointer"
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
          isOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <nav className="container py-4 flex flex-col gap-1 border-t border-gray-200 bg-white/95 backdrop-blur-xl">
          {navItems.map((item) => (
            <button
              key={item.label}
              onClick={() => handleNavClick(item.href)}
              className="text-foreground hover:text-accent hover:bg-cyan-50 transition-all py-3 px-4 rounded-lg font-medium text-left bg-transparent border-0 cursor-pointer w-full"
            >
              {item.label}
            </button>
          ))}
          <Button
            className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white border-0 mt-2 py-5"
            onClick={handleCtaClick}
          >
            {t('header.prueba')}
          </Button>
        </nav>
      </div>
    </header>
  );
}
