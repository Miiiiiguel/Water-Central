import { useState, useEffect } from 'react';
import { Phone, MessageCircle, X, MessageSquare } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { WHATSAPP_NUMBER } from '@/lib/contact';

export default function FloatingButtons() {
  const { language } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [showPulse, setShowPulse] = useState(true);

  const whatsappNumber = WHATSAPP_NUMBER;
  const phoneNumber = `+${WHATSAPP_NUMBER}`;
  const whatsappMessage = language === 'es'
    ? 'Hola, quiero saber cómo puede ayudarme Easycomex a vender en Estados Unidos.'
    : 'Hi, I would like to know how Easycomex can help me sell in the United States.';

  useEffect(() => {
    if (isOpen) setShowPulse(false);
  }, [isOpen]);

  const actions = [
    {
      icon: MessageCircle,
      label: 'WhatsApp',
      href: `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`,
      color: 'bg-green-500 hover:bg-green-600',
      ariaLabel: 'Chat on WhatsApp',
    },
    {
      icon: MessageSquare,
      label: language === 'es' ? 'SMS' : 'Text Us',
      href: `sms:${phoneNumber}?body=${encodeURIComponent(whatsappMessage)}`,
      color: 'bg-orange-500 hover:bg-orange-600',
      ariaLabel: 'Send a text message',
    },
    {
      icon: Phone,
      label: language === 'es' ? 'Llamar' : 'Call Now',
      href: `tel:${phoneNumber}`,
      color: 'bg-orange-500 hover:bg-orange-600',
      ariaLabel: 'Call us now',
    },
  ];

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm transition-opacity duration-300"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Floating Button Container (desktop only — mobile uses the bottom tab bar's Contact button) */}
      <div className="hidden md:flex fixed bottom-6 right-6 md:bottom-8 md:right-8 z-50 flex-col items-end gap-3">
        {/* Action Buttons */}
        {isOpen && (
          <div className="flex flex-col gap-2 mb-2 animate-fade-in-up">
            {actions.map((action, index) => {
              const Icon = action.icon;
              return (
                <a
                  key={index}
                  href={action.href}
                  target={action.href.startsWith('http') ? '_blank' : undefined}
                  rel={action.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                  className={`flex items-center gap-3 px-4 py-3 ${action.color} text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105`}
                  style={{ animationDelay: `${index * 0.1}s` }}
                  aria-label={action.ariaLabel}
                >
                  <Icon size={20} className="flex-shrink-0" />
                  <span className="text-sm font-semibold whitespace-nowrap pr-1">{action.label}</span>
                </a>
              );
            })}
          </div>
        )}

        {/* Main Toggle Button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-full shadow-xl transition-all duration-300 hover:scale-110 flex items-center justify-center ${
            isOpen
              ? 'bg-gray-700 hover:bg-gray-800'
              : 'bg-accent hover:bg-accent/90'
          }`}
          aria-label={isOpen ? 'Close contact options' : 'Open contact options'}
          aria-expanded={isOpen}
        >
          {!isOpen && showPulse && (
            <span className="absolute inset-0 rounded-full bg-orange-500 animate-ping opacity-30" />
          )}
          {isOpen ? (
            <X size={24} className="text-white" />
          ) : (
            <MessageCircle size={24} className="text-white" />
          )}
        </button>
      </div>
    </>
  );
}
