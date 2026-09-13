import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Calculator, CheckCircle, Send, Loader2 } from 'lucide-react';
import { trackLead } from '@/lib/analytics';

export default function FreightSection() {
  const { language } = useLanguage();
  const { user, getAccessToken } = useAuth();
  const [form, setForm] = useState({
    email: '',
    origin: '',
    destination: '',
    weight: '',
    clientType: 'brand',
    website: '', // honeypot — see ContactFormExpanded
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);

    const weight = Number(form.weight);
    const token = getAccessToken();
    try {
      const res = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          email: user?.email ?? (form.email || undefined),
          origin: form.origin,
          destination: form.destination,
          weight_kg: Number.isFinite(weight) && weight > 0 ? weight : null,
          client_type: form.clientType,
          website: form.website,
        }),
      });
      if (res.status === 503) {
        console.log('Freight quote submitted (backend not configured yet):', form);
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

    trackLead({ content_name: 'freight_calculator', client_type: form.clientType });
    setSubmitting(false);
    setSubmitted(true);
  };

  return (
    <section id="calculadora" className="py-20 md:py-32 bg-gradient-to-b from-gray-50 to-white relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="container relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
          {/* Copy */}
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500/10 border border-orange-500/30 rounded-full mb-6">
              <Calculator size={16} className="text-orange-600" />
              <span className="text-orange-700 font-semibold text-sm">
                {language === 'es' ? 'Calculadora de fletes internacionales' : 'International freight calculator'}
              </span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-primary mb-6">
              {language === 'es' ? '¿Cuánto cuesta enviar tu producto a USA?' : 'How much does it cost to ship your product to the US?'}
            </h2>
            <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
              {language === 'es'
                ? 'Ingresa origen, destino, peso y tipo de cliente y te enviamos tu tarifa estimada de flete internacional puerta a puerta.'
                : 'Enter origin, destination, weight and client type and we will send you your estimated door-to-door international freight rate.'}
            </p>
            <div className="space-y-3">
              {[
                language === 'es' ? 'Transporte aéreo y marítimo' : 'Air and ocean freight',
                language === 'es' ? 'Envíos puerta a puerta' : 'Door-to-door shipping',
                language === 'es' ? '220 destinos internacionales' : '220 international destinations',
              ].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-orange-500 flex-shrink-0" />
                  <span className="text-sm font-medium text-foreground">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Form */}
          <div className="bg-white rounded-3xl border border-gray-100 p-8 app-shadow">
            {submitted ? (
              <div className="text-center py-10">
                <CheckCircle className="w-14 h-14 text-orange-500 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-primary mb-2">
                  {language === 'es' ? '¡Listo!' : 'All set!'}
                </h3>
                <p className="text-muted-foreground">
                  {language === 'es'
                    ? 'Recibimos tus datos. Un especialista te contactará con tu tarifa estimada en menos de 24 horas.'
                    : 'We received your details. A specialist will contact you with your estimated rate within 24 hours.'}
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      {language === 'es' ? 'Origen' : 'Origin'}
                    </label>
                    <input
                      type="text"
                      name="origin"
                      value={form.origin}
                      onChange={handleChange}
                      required
                      placeholder={language === 'es' ? 'Ej. Bogotá, Colombia' : 'E.g. Bogotá, Colombia'}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all duration-300"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">
                      {language === 'es' ? 'Destino' : 'Destination'}
                    </label>
                    <input
                      type="text"
                      name="destination"
                      value={form.destination}
                      onChange={handleChange}
                      required
                      placeholder={language === 'es' ? 'Ej. Miami, USA' : 'E.g. Miami, USA'}
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all duration-300"
                    />
                  </div>
                </div>

                {!user && (
                  <div>
                    <label className="block text-sm font-semibold text-foreground mb-2">Email</label>
                    <input
                      type="email"
                      name="email"
                      value={form.email}
                      onChange={handleChange}
                      required
                      placeholder="tu@email.com"
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all duration-300"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    {language === 'es' ? 'Peso estimado (kg)' : 'Estimated weight (kg)'}
                  </label>
                  <input
                    type="number"
                    min="0"
                    name="weight"
                    value={form.weight}
                    onChange={handleChange}
                    required
                    placeholder="50"
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all duration-300"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-foreground mb-2">
                    {language === 'es' ? 'Tipo de cliente' : 'Client type'}
                  </label>
                  <select
                    name="clientType"
                    value={form.clientType}
                    onChange={handleChange}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all duration-300"
                  >
                    <option value="brand">{language === 'es' ? 'Marca / Ecommerce' : 'Brand / Ecommerce'}</option>
                    <option value="individual">{language === 'es' ? 'Persona natural' : 'Individual'}</option>
                    <option value="freight-forwarder">{language === 'es' ? 'Otro operador logístico' : 'Other freight forwarder'}</option>
                  </select>
                </div>

                <div className="absolute -left-[9999px] top-0 h-0 w-0 overflow-hidden" aria-hidden="true">
                  <label htmlFor="freight-website">Website</label>
                  <input
                    id="freight-website"
                    type="text"
                    name="website"
                    value={form.website}
                    onChange={handleChange}
                    tabIndex={-1}
                    autoComplete="off"
                  />
                </div>

                {submitError && (
                  <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-red-700 text-sm text-center">{submitError}</div>
                )}

                <Button
                  type="submit"
                  disabled={submitting}
                  className="tap-scale w-full rounded-full bg-accent hover:bg-accent/90 text-white border-0 py-6 text-base font-semibold shadow-glow hover:shadow-glow-lg transition-all duration-300 flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                  {language === 'es' ? 'Calcular mi envío' : 'Calculate my shipment'}
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
