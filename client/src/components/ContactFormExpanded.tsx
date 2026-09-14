import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Mail, Phone, Send, CheckCircle, Loader2 } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { trackLead } from '@/lib/analytics';

export default function ContactFormExpanded() {
  const { language } = useLanguage();
  const { getAccessToken } = useAuth();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    company: '',
    country: '',
    salesChannel: 'none',
    interests: [] as string[],
    message: '',
    subscribe: true,
    // Honeypot: invisible to people, filled in by dumb bots. Never rendered
    // visibly and never sent — if it has a value, the submit is a no-op.
    website: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [step, setStep] = useState(1);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData({ ...formData, [name]: checked });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleCheckbox = (interest: string) => {
    setFormData({
      ...formData,
      interests: formData.interests.includes(interest)
        ? formData.interests.filter((c) => c !== interest)
        : [...formData.interests, interest],
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);

    // Goes through the server (rate-limited, validated, honeypot-checked
    // there too) — see server/leads.ts. The honeypot value is sent as-is
    // so the server can drop bot submissions without tipping them off.
    const token = getAccessToken();
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          first_name: formData.firstName,
          last_name: formData.lastName,
          email: formData.email,
          phone: formData.phone,
          company: formData.company,
          country: formData.country,
          sales_channel: formData.salesChannel,
          interests: formData.interests,
          message: formData.message,
          website: formData.website,
        }),
      });
      if (res.status === 503) {
        console.log('Form submitted (backend not configured yet):', formData);
      } else if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setSubmitError(data.error || (language === 'es' ? 'No se pudo enviar. Intenta de nuevo.' : 'Could not send. Please try again.'));
        setSubmitting(false);
        return;
      }
    } catch {
      setSubmitError(language === 'es' ? 'Sin conexión. Intenta de nuevo.' : 'No connection. Please try again.');
      setSubmitting(false);
      return;
    }

    trackLead({ content_name: 'contact_form', interests: formData.interests.join(',') });
    setSubmitting(false);
    setSubmitted(true);
    setTimeout(() => {
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        company: '',
        country: '',
        salesChannel: 'none',
        interests: [] as string[],
        message: '',
        subscribe: true,
        website: '',
      });
      setStep(1);
      setSubmitted(false);
    }, 3000);
  };

  const interests = [
    { id: 'channels', label: language === 'es' ? 'Nuevos canales de venta' : 'New sales channels' },
    { id: 'logistics', label: language === 'es' ? 'Logística internacional' : 'International logistics' },
    { id: 'strategy', label: language === 'es' ? 'Estrategia ecommerce' : 'Ecommerce strategy' },
    { id: 'prep-center', label: language === 'es' ? 'Prep Center en USA' : 'US Prep Center' },
    { id: 'market-intel', label: language === 'es' ? 'Inteligencia de mercado' : 'Market intelligence' },
    { id: 'opportunity', label: language === 'es' ? 'Análisis de mi oportunidad' : 'Opportunity analysis' },
  ];

  const contactInfo = [
    {
      icon: Phone,
      label: language === 'es' ? 'Teléfono / WhatsApp' : 'Phone / WhatsApp',
      value: '(+57) 313 6380121',
      href: 'https://api.whatsapp.com/send/?phone=573136380121',
    },
    {
      icon: Mail,
      label: 'Email',
      value: 'info@easycomex.com',
      href: 'mailto:info@easycomex.com',
    },
  ];

  return (
    <section className="py-20 md:py-32 bg-gradient-to-b from-gray-50 to-white relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="container relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Contact Info */}
          <div className="animate-fade-in-left">
            <h2 className="font-display text-5xl md:text-6xl font-bold text-primary mb-4">
              {language === 'es' ? 'Obtén tu Plan de Crecimiento' : 'Get Your Growth Plan'}
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              {language === 'es'
                ? 'Llena esto y un especialista te escribe en menos de 24 horas con un diagnóstico real de tu oportunidad afuera. Gratis y sin vueltas.'
                : 'Fill this in and a specialist writes back within 24 hours with a real diagnosis of your opportunity abroad. Free, no runaround.'}
            </p>

            <div className="space-y-6 mb-12">
              {contactInfo.map((info, index) => {
                const Icon = info.icon;
                return (
                  <a
                    key={index}
                    href={info.href}
                    target={info.href.startsWith('http') ? '_blank' : undefined}
                    rel={info.href.startsWith('http') ? 'noopener noreferrer' : undefined}
                    className="flex items-start gap-4 p-4 rounded-lg hover:bg-gray-50 transition-all duration-300 group"
                  >
                    <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-glow group-hover:shadow-glow-lg transition-all">
                      <Icon className="text-white" size={24} />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">{info.label}</p>
                      <p className="text-muted-foreground group-hover:text-accent transition-colors">{info.value}</p>
                    </div>
                  </a>
                );
              })}
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-orange-500" />
                <span className="text-sm font-medium text-foreground">
                  {language === 'es' ? 'Diagnóstico sin costo' : 'No-cost diagnosis'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-orange-500" />
                <span className="text-sm font-medium text-foreground">
                  {language === 'es' ? 'Sin obligación' : 'No obligation'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-orange-500" />
                <span className="text-sm font-medium text-foreground">
                  {language === 'es' ? 'Respuesta en 24 horas' : 'Response within 24 hours'}
                </span>
              </div>
            </div>
          </div>

          {/* Contact Form - Multi-Step */}
          <div className="animate-fade-in-right">
            <form onSubmit={handleSubmit} className="bg-white rounded-3xl border border-gray-100 p-8 app-shadow">
              <div className="flex gap-2 mb-8">
                {[1, 2, 3].map((s) => (
                  <div
                    key={s}
                    className={`h-2 flex-1 rounded-full transition-all duration-300 ${
                      s <= step ? 'bg-gradient-to-r from-orange-500 to-orange-600' : 'bg-gray-200'
                    }`}
                  />
                ))}
              </div>

              <div className="space-y-6">
                {step === 1 && (
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-foreground mb-2">
                        {language === 'es' ? 'Nombre' : 'First Name'} *
                      </label>
                      <input
                        type="text"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all duration-300"
                        placeholder={language === 'es' ? 'Tu nombre' : 'Your first name'}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-foreground mb-2">
                        {language === 'es' ? 'Apellido' : 'Last Name'} *
                      </label>
                      <input
                        type="text"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all duration-300"
                        placeholder={language === 'es' ? 'Tu apellido' : 'Your last name'}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-foreground mb-2">Email *</label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all duration-300"
                        placeholder={language === 'es' ? 'tu@email.com' : 'your@email.com'}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-foreground mb-2">
                        {language === 'es' ? 'Teléfono / WhatsApp' : 'Phone / WhatsApp'} *
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all duration-300"
                        placeholder="+57 300 000 0000"
                      />
                    </div>
                  </>
                )}

                {step === 2 && (
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-foreground mb-2">
                        {language === 'es' ? 'Nombre de tu marca / empresa' : 'Your brand / company name'} *
                      </label>
                      <input
                        type="text"
                        name="company"
                        value={formData.company}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all duration-300"
                        placeholder={language === 'es' ? 'Tu marca' : 'Your brand'}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-foreground mb-2">
                        {language === 'es' ? 'País' : 'Country'} *
                      </label>
                      <input
                        type="text"
                        name="country"
                        value={formData.country}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all duration-300"
                        placeholder={language === 'es' ? 'Tu país' : 'Your country'}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-foreground mb-2">
                        {language === 'es' ? '¿Ya vendes en algún canal?' : 'Do you already sell on any channel?'} *
                      </label>
                      <select
                        name="salesChannel"
                        value={formData.salesChannel}
                        onChange={handleChange}
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all duration-300"
                      >
                        <option value="none">{language === 'es' ? 'Todavía no vendo online' : "I don't sell online yet"}</option>
                        <option value="amazon">Amazon</option>
                        <option value="tiktok">TikTok Shop</option>
                        <option value="shopify">Shopify</option>
                        <option value="multiple">{language === 'es' ? 'Varios canales' : 'Multiple channels'}</option>
                      </select>
                    </div>
                  </>
                )}

                {step === 3 && (
                  <>
                    <div>
                      <label className="block text-sm font-semibold text-foreground mb-4">
                        {language === 'es' ? '¿En qué te gustaría que te ayudemos?' : 'What would you like help with?'} *
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        {interests.map((interest) => (
                          <label
                            key={interest.id}
                            className="flex items-center gap-2 p-3 border border-gray-300 rounded-lg hover:border-orange-500 hover:bg-orange-50 cursor-pointer transition-all duration-300"
                          >
                            <input
                              type="checkbox"
                              checked={formData.interests.includes(interest.id)}
                              onChange={() => handleCheckbox(interest.id)}
                              className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                            />
                            <span className="text-sm font-medium text-foreground">{interest.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-foreground mb-2">
                        {language === 'es' ? 'Mensaje Adicional' : 'Additional Message'}
                      </label>
                      <textarea
                        name="message"
                        value={formData.message}
                        onChange={handleChange}
                        rows={4}
                        className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all duration-300 resize-none"
                        placeholder={language === 'es' ? 'Cuéntanos más sobre tu marca...' : 'Tell us more about your brand...'}
                      ></textarea>
                    </div>

                    <div className="absolute -left-[9999px] top-0 h-0 w-0 overflow-hidden" aria-hidden="true">
                      <label htmlFor="contact-website">Website</label>
                      <input
                        id="contact-website"
                        type="text"
                        name="website"
                        value={formData.website}
                        onChange={handleChange}
                        tabIndex={-1}
                        autoComplete="off"
                      />
                    </div>

                    <label className="flex items-center gap-2 p-3 border border-gray-300 rounded-lg hover:border-orange-500 hover:bg-orange-50 cursor-pointer transition-all duration-300">
                      <input
                        type="checkbox"
                        name="subscribe"
                        checked={formData.subscribe}
                        onChange={handleChange}
                        className="w-4 h-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                      />
                      <span className="text-sm font-medium text-foreground">
                        {language === 'es'
                          ? 'Sí, deseo recibir tips de crecimiento ecommerce y ofertas especiales'
                          : 'Yes, I want to receive ecommerce growth tips and special offers'}
                      </span>
                    </label>
                  </>
                )}

                <div className="flex gap-3 pt-4">
                  {step > 1 && (
                    <Button type="button" onClick={() => setStep(step - 1)} variant="outline" className="flex-1">
                      {language === 'es' ? 'Atrás' : 'Back'}
                    </Button>
                  )}
                  {step < 3 ? (
                    <Button
                      type="button"
                      onClick={() => setStep(step + 1)}
                      className="flex-1 rounded-full bg-accent hover:bg-accent/90 text-white border-0"
                    >
                      {language === 'es' ? 'Siguiente' : 'Next'}
                    </Button>
                  ) : (
                    <Button
                      type="submit"
                      disabled={submitting}
                      className="tap-scale flex-1 rounded-full bg-accent hover:bg-accent/90 text-white border-0 shadow-glow-lg hover:shadow-glow-lg transition-all duration-300 hover:scale-105 flex items-center justify-center gap-2"
                    >
                      {submitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                      {language === 'es' ? 'Enviar' : 'Submit'}
                    </Button>
                  )}
                </div>

                {submitError && (
                  <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-red-700 text-sm text-center">{submitError}</div>
                )}
                {submitted && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-center animate-fade-in-up flex items-center justify-center gap-2">
                    <CheckCircle size={20} />
                    {language === 'es'
                      ? '¡Formulario enviado! Te contactaremos en 24 horas.'
                      : 'Form submitted! We will contact you within 24 hours.'}
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
