import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Calculator, CheckCircle, Send } from 'lucide-react';

export default function FreightSection() {
  const { language } = useLanguage();
  const [form, setForm] = useState({
    origin: '',
    destination: '',
    weight: '',
    clientType: 'brand',
  });
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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

                <Button
                  type="submit"
                  className="w-full rounded-full bg-accent hover:bg-accent/90 text-white border-0 py-6 text-base font-semibold shadow-glow hover:shadow-glow-lg transition-all duration-300 flex items-center justify-center gap-2"
                >
                  <Send size={18} />
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
