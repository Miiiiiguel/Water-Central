import { Mail, Phone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function Footer() {
  const { language } = useLanguage();
  const [isVisible, setIsVisible] = useState(false);
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const services = language === 'es'
    ? [
        { label: 'Nuevos canales de venta', href: '#servicios' },
        { label: 'Logística internacional', href: '#servicios' },
        { label: 'Prep Center en USA', href: '#servicios' },
        { label: 'Inteligencia de mercado', href: '#servicios' },
      ]
    : [
        { label: 'New sales channels', href: '#servicios' },
        { label: 'International logistics', href: '#servicios' },
        { label: 'US Prep Center', href: '#servicios' },
        { label: 'Market intelligence', href: '#servicios' },
      ];

  const company = language === 'es'
    ? [
        { label: 'Equipo', href: '#equipo' },
        { label: 'Planes', href: '#planes' },
        { label: 'Preguntas frecuentes', href: '#faq' },
        { label: 'Contacto', href: '#contacto' },
      ]
    : [
        { label: 'Team', href: '#equipo' },
        { label: 'Plans', href: '#planes' },
        { label: 'FAQ', href: '#faq' },
        { label: 'Contact', href: '#contacto' },
      ];

  const partners = language === 'es'
    ? [
        { label: '¿Quieres ser nuestro aliado?', href: '#contacto' },
        { label: 'Únete a nuestra red de afiliados', href: '#contacto' },
      ]
    : [
        { label: 'Want to be our partner?', href: '#contacto' },
        { label: 'Join our affiliate network', href: '#contacto' },
      ];

  const legal = language === 'es'
    ? [
        { label: 'Política de privacidad', href: '/privacidad' },
        { label: 'Términos y condiciones', href: '/terminos' },
      ]
    : [
        { label: 'Privacy Policy', href: '/privacidad' },
        { label: 'Terms & Conditions', href: '/terminos' },
      ];

  return (
    <footer className="bg-gradient-to-b from-slate-900 to-slate-950 text-gray-300 py-16 md:py-20 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl animate-float"></div>
        <div className="absolute top-0 left-0 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="container relative z-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8 mb-12">
          {/* Brand */}
          <div className={`lg:col-span-2 transition-all duration-700 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <div className="mb-4 hover-scale">
              <span className="font-logo text-2xl tracking-tight">
                <span className="text-accent">easy</span>
                <span className="text-white">comex</span>
              </span>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              {language === 'es'
                ? 'Llevamos tus productos e historias por el mundo de una manera responsable. Desbloqueamos tu verdadero potencial de ecommerce en Estados Unidos.'
                : 'We take your products and stories around the world responsibly. We unlock your true ecommerce potential in the United States.'}
            </p>
          </div>

          {/* Services */}
          <div className={`transition-all duration-700 delay-100 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <h4 className="font-semibold text-white mb-4">{language === 'es' ? 'Servicios' : 'Services'}</h4>
            <ul className="space-y-2 text-sm">
              {services.map((item) => (
                <li key={item.label}>
                  <a href={item.href} className="hover:text-orange-400 transition-colors hover:translate-x-1 inline-block transition-transform">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div className={`transition-all duration-700 delay-200 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <h4 className="font-semibold text-white mb-4">{language === 'es' ? 'Empresa' : 'Company'}</h4>
            <ul className="space-y-2 text-sm mb-6">
              {company.map((item) => (
                <li key={item.label}>
                  <a href={item.href} className="hover:text-orange-400 transition-colors hover:translate-x-1 inline-block transition-transform">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
            <ul className="space-y-2 text-sm">
              {partners.map((item) => (
                <li key={item.label}>
                  <a href={item.href} className="hover:text-orange-400 transition-colors hover:translate-x-1 inline-block transition-transform">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact */}
          <div className={`transition-all duration-700 delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <h4 className="font-semibold text-white mb-4">{language === 'es' ? 'Contacto' : 'Contact'}</h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-2 group">
                <Phone size={16} className="text-orange-400 flex-shrink-0 group-hover:scale-110 transition-transform" />
                <a href="https://api.whatsapp.com/send/?phone=573136380121" target="_blank" rel="noopener noreferrer" className="hover:text-orange-400 transition-colors">
                  (+57) 313 6380121
                </a>
              </li>
              <li className="flex items-center gap-2 group">
                <Mail size={16} className="text-orange-400 flex-shrink-0 group-hover:scale-110 transition-transform" />
                <a href="mailto:info@easycomex.com" className="hover:text-orange-400 transition-colors">
                  info@easycomex.com
                </a>
              </li>
              <li className="flex items-center gap-2 group">
                <Mail size={16} className="text-orange-400 flex-shrink-0 group-hover:scale-110 transition-transform" />
                <a href="mailto:gerencia@easycomex.com" className="hover:text-orange-400 transition-colors">
                  gerencia@easycomex.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-700 my-8"></div>

        <div className="flex flex-col md:flex-row justify-between items-center text-sm text-gray-400 gap-4">
          <p>&copy; {currentYear} Easycomex. {language === 'es' ? 'Todos los derechos reservados.' : 'All rights reserved.'}</p>
          <div className="flex flex-wrap justify-center gap-4 md:gap-6">
            {legal.map((item) => (
              <a key={item.label} href={item.href} className="hover:text-orange-400 transition-colors">
                {item.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
