import { useEffect, useMemo, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Calculator, CheckCircle, Loader2, MessageCircle, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { trackLead } from '@/lib/analytics';
import { whatsappUrl } from '@/lib/contact';
import { isNative, openExternal } from '@/lib/native';

// Calculadora de fletes — the real one. The tariff table lives on the
// server (server/freight.ts + freightData.json); this form collects
// destination, client type and packages, asks /api/freight/quote and
// shows the price in COP with the same breakdown the WordPress
// calculator gave: billable weight (real vs volumetric), zone, base,
// discount, final.

interface Destination {
  id: string;
  es: string;
  en: string;
  code: string;
}

interface Pkg {
  weight: string;
  length: string;
  width: string;
  height: string;
  quantity: string;
}

interface Quote {
  customer_type: string;
  destination: string;
  zone: string;
  weights: { real: number; volumetric: number; billable: number };
  pricing: {
    is_multiplier: boolean;
    unit_rate: number;
    base_price: number;
    discount_percent: number;
    discount_amount: number;
    final_price: number;
  };
  currency: string;
}

const EMPTY_PKG: Pkg = { weight: '', length: '', width: '', height: '', quantity: '1' };
// Miami has its own zone in the table; it is the destination most
// clients ask about, so it is the default.
const DEFAULT_DESTINATION = '197';

const inputCls =
  'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-primary outline-none transition-all placeholder:font-normal placeholder:text-gray-400 focus:border-accent focus:ring-2 focus:ring-accent/20';

const cop = (n: number) => `$${Math.round(n).toLocaleString('es-CO')}`;

const CLIENT_TYPE_HELP: Record<string, { es: string; en: string }> = {
  Normal: { es: 'Envías de vez en cuando', en: 'You ship now and then' },
  Multiplicador: { es: 'Envías cada mes', en: 'You ship every month' },
  VIP: { es: 'Operación recurrente con nosotros', en: 'Ongoing operation with us' },
};

export default function FreightSection() {
  const { language } = useLanguage();
  const { user, getAccessToken } = useAuth();
  const es = language === 'es';

  const [destinations, setDestinations] = useState<Destination[] | null>(null);
  const [clientTypes, setClientTypes] = useState<string[]>(['Normal', 'Multiplicador', 'VIP']);
  const [loadError, setLoadError] = useState(false);

  const [destination, setDestination] = useState(DEFAULT_DESTINATION);
  const [clientType, setClientType] = useState('Normal');
  const [packages, setPackages] = useState<Pkg[]>([{ ...EMPTY_PKG }]);
  const [email, setEmail] = useState('');
  const [website, setWebsite] = useState(''); // honeypot — see ContactFormExpanded

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/freight/destinations')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { destinations: Destination[]; clientTypes: string[] }) => {
        if (cancelled) return;
        setDestinations(d.destinations);
        if (d.clientTypes?.length) setClientTypes(d.clientTypes);
      })
      .catch(() => !cancelled && setLoadError(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const sorted = useMemo(() => {
    if (!destinations) return [];
    return [...destinations].sort((a, b) => (es ? a.es : a.en).localeCompare(es ? b.es : b.en, es ? 'es' : 'en'));
  }, [destinations, es]);

  const setPkg = (i: number, key: keyof Pkg, value: string) =>
    setPackages((prev) => prev.map((p, n) => (n === i ? { ...p, [key]: value } : p)));

  const num = (s: string) => {
    const n = parseFloat(s);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (website) return;
    setSubmitting(true);
    setError(null);
    const body = {
      customerType: clientType,
      destination,
      packages: packages.map((p) => ({
        weight: num(p.weight),
        length: num(p.length),
        width: num(p.width),
        height: num(p.height),
        quantity: Math.max(1, Math.trunc(num(p.quantity)) || 1),
      })),
      email: user?.email ?? (email.trim() || undefined),
      lang: language,
    };
    if (!body.packages.some((p) => p.weight > 0 || (p.length > 0 && p.width > 0 && p.height > 0))) {
      setError(es ? 'Escribe el peso o las medidas de al menos un paquete.' : 'Enter the weight or dimensions of at least one package.');
      setSubmitting(false);
      return;
    }
    const token = getAccessToken();
    try {
      const res = await fetch('/api/freight/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || (es ? 'No pudimos cotizar. Intenta de nuevo.' : 'We could not quote that. Please try again.'));
        setSubmitting(false);
        return;
      }
      setQuote(data as Quote);
      trackLead({ content_name: 'freight_calculator', client_type: clientType, value: (data as Quote).pricing.final_price, currency: 'COP' });
    } catch {
      setError(es ? 'Sin conexión. Intenta de nuevo.' : 'No connection. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setQuote(null);
    setError(null);
  };

  const whatsapp = quote
    ? whatsappUrl(
        es
          ? `Hola Easycomex. Coticé un envío a ${quote.destination} (${quote.weights.billable} kg facturables, cliente ${quote.customer_type}) por ${cop(quote.pricing.final_price)} COP y quiero reservarlo.`
          : `Hi Easycomex. I quoted a shipment to ${quote.destination} (${quote.weights.billable} billable kg, ${quote.customer_type} client) at ${cop(quote.pricing.final_price)} COP and I want to book it.`
      )
    : '';

  const volWins = quote ? quote.weights.volumetric > quote.weights.real : false;

  return (
    <section id="calculadora" className="py-20 md:py-32 bg-gradient-to-b from-gray-50 to-white relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl animate-float"></div>
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="container relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-[5fr_7fr] gap-12 items-start max-w-6xl mx-auto">
          {/* Copy */}
          <div className="lg:sticky lg:top-28">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500/10 border border-orange-500/30 rounded-full mb-6">
              <Calculator size={16} className="text-orange-600" />
              <span className="text-orange-700 font-semibold text-sm">
                {es ? 'Calculadora de fletes internacionales' : 'International freight calculator'}
              </span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-primary mb-6">
              {es ? '¿Cuánto cuesta sacar tu producto del país?' : 'What does it cost to ship your product abroad?'}
            </h2>
            <p className="text-lg text-muted-foreground mb-8 leading-relaxed">
              {es
                ? 'El precio real, con nuestra tarifa, al instante. Sin "te escribimos": destino, peso y medidas, y sale el número.'
                : 'The real price, from our own rate table, instantly. No "we will get back to you": destination, weight, dimensions, and out comes the number.'}
            </p>
            <div className="space-y-3">
              {[
                es ? 'Tarifa puerta a puerta desde Colombia a 211 destinos' : 'Door-to-door rates from Colombia to 211 destinations',
                es ? 'Peso real vs. volumétrico, como lo cobra la aerolínea' : 'Real vs. volumetric weight, the way the airline charges it',
                es ? 'Descuento según qué tanto envías con nosotros' : 'A discount based on how much you ship with us',
              ].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-orange-500 flex-shrink-0" />
                  <span className="text-sm font-medium text-foreground">{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Form / result */}
          <div className="bg-white rounded-3xl border border-gray-100 p-6 md:p-8 app-shadow">
            {quote ? (
              <div>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-accent">{es ? 'Tu cotización' : 'Your quote'}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Colombia → <span className="font-semibold text-primary">{quote.destination}</span> · {es ? 'zona' : 'zone'} {quote.zone}
                    </p>
                  </div>
                  <span className="rounded-full bg-secondary px-3 py-1 text-xs font-bold text-primary">{quote.customer_type}</span>
                </div>

                <p className="mt-5 text-4xl font-black tabular-nums text-primary md:text-5xl">
                  {cop(quote.pricing.final_price)} <span className="text-base font-bold text-muted-foreground">COP</span>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {es ? 'Flete internacional puerta a puerta · IVA no incluido' : 'Door-to-door international freight · VAT not included'}
                </p>

                <dl className="mt-6 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl bg-secondary/50 p-4">
                    <dt className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{es ? 'Peso facturable' : 'Billable weight'}</dt>
                    <dd className="mt-1 text-lg font-black text-primary">{quote.weights.billable} kg</dd>
                    <dd className="text-xs text-muted-foreground">
                      {es ? 'real' : 'real'} {quote.weights.real} kg · {es ? 'volumétrico' : 'volumetric'} {quote.weights.volumetric} kg
                      {volWins && <span className="ml-1 font-semibold text-accent">{es ? '(manda el volumen)' : '(volume wins)'}</span>}
                    </dd>
                  </div>
                  <div className="rounded-2xl bg-secondary/50 p-4">
                    <dt className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{es ? 'Tarifa' : 'Rate'}</dt>
                    <dd className="mt-1 text-lg font-black text-primary">
                      {quote.pricing.is_multiplier ? `${cop(quote.pricing.unit_rate)} / kg` : cop(quote.pricing.base_price)}
                    </dd>
                    <dd className="text-xs text-muted-foreground">
                      {quote.pricing.is_multiplier ? (es ? 'por kilo facturable' : 'per billable kilo') : es ? 'tarifa plana de la banda' : 'flat band rate'}
                    </dd>
                  </div>
                  <div className="col-span-2 flex items-center justify-between rounded-2xl border border-green-100 bg-green-50 px-4 py-3">
                    <span className="text-sm font-semibold text-green-800">
                      {es ? `Descuento ${quote.customer_type}` : `${quote.customer_type} discount`} · {quote.pricing.discount_percent}%
                    </span>
                    <span className="font-black text-green-700">−{cop(quote.pricing.discount_amount)}</span>
                  </div>
                </dl>

                <div className="mt-6 grid gap-3 sm:grid-cols-2">
                  <a
                    href={whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => {
                      if (!isNative) return;
                      e.preventDefault();
                      void openExternal(whatsapp);
                    }}
                    className="tap-scale inline-flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 font-bold text-white shadow-glow hover:bg-accent/90"
                  >
                    <MessageCircle size={18} />
                    {es ? 'Reservar este envío' : 'Book this shipment'}
                  </a>
                  <button
                    type="button"
                    onClick={reset}
                    className="tap-scale inline-flex items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-6 py-3.5 font-bold text-primary hover:bg-secondary/60"
                  >
                    <RotateCcw size={16} />
                    {es ? 'Nueva cotización' : 'New quote'}
                  </button>
                </div>
                <p className="mt-4 text-xs text-muted-foreground">
                  {es
                    ? 'Precio válido para carga general. Mercancía peligrosa, perecederos o valores declarados altos se cotizan aparte.'
                    : 'Valid for general cargo. Dangerous goods, perishables or high declared values are quoted separately.'}
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="freight-destination" className="block text-sm font-semibold text-foreground mb-2">
                      {es ? 'Destino' : 'Destination'}
                    </label>
                    <select
                      id="freight-destination"
                      name="destination"
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      disabled={!destinations}
                      className={inputCls}
                    >
                      {!destinations && <option value={DEFAULT_DESTINATION}>{loadError ? (es ? 'No se pudo cargar la lista' : 'Could not load the list') : es ? 'Cargando destinos…' : 'Loading destinations…'}</option>}
                      {sorted.map((d) => (
                        <option key={d.id} value={d.id}>
                          {es ? d.es : d.en}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-muted-foreground">{es ? 'Origen: Colombia' : 'Origin: Colombia'}</p>
                  </div>
                  <div>
                    <label htmlFor="freight-client-type" className="block text-sm font-semibold text-foreground mb-2">
                      {es ? 'Tipo de cliente' : 'Client type'}
                    </label>
                    <select id="freight-client-type" name="clientType" value={clientType} onChange={(e) => setClientType(e.target.value)} className={inputCls}>
                      {clientTypes.map((t) => (
                        <option key={t} value={t}>
                          {t}
                          {CLIENT_TYPE_HELP[t] ? ` — ${es ? CLIENT_TYPE_HELP[t].es : CLIENT_TYPE_HELP[t].en}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="block text-sm font-semibold text-foreground">{es ? 'Paquetes' : 'Packages'}</span>
                    <span className="text-xs text-muted-foreground">{es ? 'kg y cm' : 'kg and cm'}</span>
                  </div>
                  <div className="space-y-2">
                    {packages.map((p, i) => (
                      <div key={i} className="grid grid-cols-[1.2fr_1fr_1fr_1fr_0.8fr_auto] items-center gap-1.5 sm:gap-2">
                        <input aria-label={es ? 'Peso en kg' : 'Weight in kg'} name={i === 0 ? 'weight' : `weight_${i}`} type="number" inputMode="decimal" min="0" step="0.1" placeholder="kg" value={p.weight} onChange={(e) => setPkg(i, 'weight', e.target.value)} className={inputCls} />
                        <input aria-label={es ? 'Largo en cm' : 'Length in cm'} type="number" inputMode="decimal" min="0" placeholder={es ? 'largo' : 'L'} value={p.length} onChange={(e) => setPkg(i, 'length', e.target.value)} className={inputCls} />
                        <input aria-label={es ? 'Ancho en cm' : 'Width in cm'} type="number" inputMode="decimal" min="0" placeholder={es ? 'ancho' : 'W'} value={p.width} onChange={(e) => setPkg(i, 'width', e.target.value)} className={inputCls} />
                        <input aria-label={es ? 'Alto en cm' : 'Height in cm'} type="number" inputMode="decimal" min="0" placeholder={es ? 'alto' : 'H'} value={p.height} onChange={(e) => setPkg(i, 'height', e.target.value)} className={inputCls} />
                        <input aria-label={es ? 'Cantidad' : 'Quantity'} type="number" inputMode="numeric" min="1" step="1" placeholder="×" value={p.quantity} onChange={(e) => setPkg(i, 'quantity', e.target.value)} className={inputCls} />
                        <button
                          type="button"
                          aria-label={es ? 'Quitar paquete' : 'Remove package'}
                          disabled={packages.length === 1}
                          onClick={() => setPackages((prev) => prev.filter((_, n) => n !== i))}
                          className="tap-target grid h-9 w-9 place-items-center rounded-xl text-muted-foreground hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => packages.length < 20 && setPackages((prev) => [...prev, { ...EMPTY_PKG }])}
                    className="tap-scale-sm mt-1 inline-flex min-h-[36px] items-center gap-1.5 py-2 text-sm font-semibold text-accent hover:underline"
                  >
                    <Plus size={14} />
                    {es ? 'Agregar otro paquete' : 'Add another package'}
                  </button>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {es ? 'Con el peso basta; las medidas afinan el cálculo si el paquete es voluminoso.' : 'Weight is enough; dimensions refine the price when the package is bulky.'}
                  </p>
                </div>

                {!user && (
                  <div>
                    <label htmlFor="freight-email" className="block text-sm font-semibold text-foreground mb-2">
                      Email <span className="font-normal text-muted-foreground">({es ? 'opcional, para enviarte la cotización' : 'optional, to send you the quote'})</span>
                    </label>
                    <input id="freight-email" type="email" name="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@email.com" autoComplete="email" className={inputCls} />
                  </div>
                )}

                <div className="absolute -left-[9999px] top-0 h-0 w-0 overflow-hidden" aria-hidden="true">
                  <label htmlFor="freight-website">Website</label>
                  <input id="freight-website" type="text" name="website" value={website} onChange={(e) => setWebsite(e.target.value)} tabIndex={-1} autoComplete="off" />
                </div>

                {error && <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-red-700 text-sm text-center">{error}</div>}

                <Button
                  type="submit"
                  disabled={submitting || !destinations}
                  className="tap-scale w-full rounded-full bg-accent hover:bg-accent/90 text-white border-0 py-6 text-base font-semibold shadow-glow hover:shadow-glow-lg transition-all duration-300 flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader2 size={18} className="animate-spin" /> : <Calculator size={18} />}
                  {es ? 'Calcular mi envío' : 'Calculate my shipment'}
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
