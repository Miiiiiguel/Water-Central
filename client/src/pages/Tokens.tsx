import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, Check, ChevronDown, Coins, Sparkles } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { checkoutMessage, fetchCatalog, startCheckout, type CheckoutPlan } from '@/lib/checkout';
import { trackInitiateCheckout } from '@/lib/analytics';
import { isNative } from '@/lib/native';
import CheckoutSheet, { type CheckoutItem } from '@/components/CheckoutSheet';

// Los tokens: la forma de pagar las consultas de inteligencia de mercado
// cuando se acaban las gratis del día. Un gratis para probar y paquetes
// que abaratan el token cuanto más grandes son.
//
// Los precios que se muestran los dice el servidor (el catálogo). Lo
// escrito acá es sólo el respaldo si el catálogo no contesta.

interface Paquete {
  plan: CheckoutPlan;
  /** Tokens en total. */
  tokens: number;
  nombre: string;
  respaldo: string;
  destacado?: boolean;
  /** Sólo los planes: cuántos trae por mes y durante cuántos meses. */
  porMes?: number;
  meses?: number;
}

// Los paquetes no vencen. Los planes traen tokens cada mes y terminan;
// se gastan antes que los de paquete. Los números tienen que coincidir
// con server/catalog.ts (hay una prueba del catálogo que lo cuida).
const PAQUETES: Paquete[] = [
  { plan: 'tokens_10', tokens: 10, nombre: 'Mini', respaldo: 'USD 4.99' },
  { plan: 'tokens_25', tokens: 25, nombre: 'Starter', respaldo: 'USD 9.99' },
  { plan: 'creditos_marco_polo', tokens: 50, nombre: 'Básico', respaldo: 'USD 19' },
];

const PLANES: Paquete[] = [
  { plan: 'tokens_200', tokens: 200, nombre: 'Plan de 1 mes', respaldo: 'USD 49', porMes: 200, meses: 1, destacado: true },
  { plan: 'tokens_300', tokens: 300, nombre: 'Plan de 6 meses', respaldo: 'USD 69', porMes: 50, meses: 6 },
  { plan: 'tokens_600', tokens: 600, nombre: 'Plan de 6 meses', respaldo: 'USD 119', porMes: 100, meses: 6 },
];

const INCLUYE = {
  es: [
    'Consultas a TikTok Shop: productos, tiendas, creadores y videos que más venden',
    'Consultas de comercio exterior: quién importa y exporta, por producto y país',
    'Lectura de etiquetas con foto y partida arancelaria sugerida',
    'Si la consulta falla, el token vuelve solo',
  ],
  en: [
    'TikTok Shop lookups: top-selling products, shops, creators and videos',
    'Foreign-trade lookups: who imports and exports, by product and country',
    'Label reading from a photo with a suggested tariff code',
    'If the lookup fails, the token comes back',
  ],
};

const PREGUNTAS = {
  es: [
    { p: '¿Qué es un token?', r: 'Una consulta: una búsqueda en TikTok Shop o en comercio exterior, o la lectura de una etiqueta con foto. Cada cuenta tiene 2 consultas gratis por día; los tokens se usan cuando esas se acaban.' },
    { p: '¿Los tokens vencen?', r: 'Los de paquete no: quedan en tu cuenta hasta que los uses. Los de plan se entregan cada mes: lo que no uses en el mes no pasa al siguiente, y el plan termina a los 1 o 6 meses.' },
    { p: '¿En qué orden se gastan?', r: 'Primero las 2 gratis del día, después los tokens del mes de tu plan (vencen) y al final los de paquete (no vencen).' },
    { p: '¿Qué pasa si una consulta falla?', r: 'Si la fuente no responde o la foto no se pudo leer, el token se devuelve solo. Sólo se descuenta una consulta que trajo respuesta.' },
    { p: '¿Qué sigue siendo gratis?', r: 'El diagnóstico de madurez (la parte gratuita), la ruta exportadora, la calculadora de fletes y la calculadora de ROI con el arancel real.' },
    { p: '¿Cómo pago?', r: 'En Colombia, en pesos con Wompi (tarjeta, PSE, Nequi). Fuera de Colombia, con tarjeta internacional; tu banco hace la conversión.' },
  ],
  en: [
    { p: 'What is a token?', r: 'One lookup: a TikTok Shop or foreign-trade search, or reading a label from a photo. Every account gets 2 free lookups a day; tokens are used once those run out.' },
    { p: 'Do tokens expire?', r: 'Pack tokens do not: they stay in your account until used. Plan tokens arrive every month: what you do not use in a month does not carry over, and the plan ends after 1 or 6 months.' },
    { p: 'In what order are they spent?', r: 'First the 2 free ones of the day, then your plan\u2019s tokens for the month (they expire), and last your pack tokens (they do not).' },
    { p: 'What if a lookup fails?', r: 'If the source does not answer or the photo could not be read, the token comes back on its own. Only a lookup that returned an answer is charged.' },
    { p: 'What stays free?', r: 'The maturity diagnosis (the free part), the export roadmap, the freight calculator and the ROI calculator with the real duty.' },
    { p: 'How do I pay?', r: 'In Colombia, in pesos with Wompi (card, PSE, Nequi). Outside Colombia, with an international card; your bank converts.' },
  ],
};

export default function Tokens() {
  const { language } = useLanguage();
  const { user, getAccessToken } = useAuth();
  const es = language === 'es';
  const [precios, setPrecios] = useState<Record<string, { cop: string | null; usd: string | null; centavos: number | null }>>({});
  const [hoja, setHoja] = useState<CheckoutItem | null>(null);
  const [comprando, setComprando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<number | null>(0);

  useEffect(() => {
    let vivo = true;
    void fetchCatalog().then((items) => {
      if (!vivo) return;
      const m: typeof precios = {};
      for (const it of items) m[it.plan] = { cop: it.displayCop, usd: it.displayUsd, centavos: it.amountInCents };
      setPrecios(m);
    });
    return () => {
      vivo = false;
    };
  }, []);

  const precioDe = (p: Paquete) => {
    const x = precios[p.plan];
    return { principal: x?.usd ?? p.respaldo, secundario: x?.cop ?? null };
  };

  const porToken = (p: Paquete) => {
    const usd = precios[p.plan]?.usd ?? p.respaldo;
    const n = parseFloat(usd.replace(/[^0-9.]/g, ''));
    return Number.isFinite(n) && n > 0 ? `USD ${(n / p.tokens).toFixed(2)} ${es ? 'por token' : 'per token'}` : null;
  };

  const elegir = (p: Paquete) => {
    setError(null);
    const { principal, secundario } = precioDe(p);
    setHoja({
      plan: p.plan,
      title: p.porMes ? `${p.nombre} · ${p.tokens} tokens` : `${p.tokens} tokens · ${p.nombre}`,
      features: INCLUYE[language],
      priceLabel: secundario ? `${secundario} · ${principal}` : principal,
    });
  };

  const tarjeta = (p: Paquete) => {
    const { principal, secundario } = precioDe(p);
    const unidad = porToken(p);
    return (
      <div
        key={p.plan}
        className={`relative flex flex-col rounded-3xl border p-6 ${
          p.destacado ? 'border-transparent bg-gradient-to-b from-primary to-indigo-950 text-white shadow-glow-lg' : 'border-gray-100 bg-white app-shadow'
        }`}
      >
        {p.destacado && (
          <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-orange-400 px-3 py-1 text-[11px] font-bold text-primary">
            {es ? 'El más elegido' : 'Most popular'}
          </span>
        )}
        <p className={`text-sm font-bold uppercase tracking-wider ${p.destacado ? 'text-indigo-200' : 'text-muted-foreground'}`}>{p.nombre}</p>
        <p className={`mt-2 flex items-center gap-2 text-3xl font-black ${p.destacado ? 'text-white' : 'text-primary'}`}>
          <Coins size={22} className="text-accent" />
          {p.tokens} tokens
        </p>
        {p.porMes && p.meses && (
          <p className={`mt-1 text-xs font-semibold ${p.destacado ? 'text-indigo-200' : 'text-muted-foreground'}`}>
            {p.meses === 1
              ? es ? `${p.porMes} tokens para usar en 1 mes` : `${p.porMes} tokens to use within 1 month`
              : es ? `${p.porMes} tokens por mes durante ${p.meses} meses` : `${p.porMes} tokens a month for ${p.meses} months`}
          </p>
        )}
        <p className={`mt-1 text-lg font-bold ${p.destacado ? 'text-white' : 'text-foreground'}`}>{principal}</p>
        {secundario && <p className={`text-xs ${p.destacado ? 'text-indigo-200' : 'text-muted-foreground'}`}>{secundario}</p>}
        {unidad && <p className={`mt-1 text-xs font-semibold ${p.destacado ? 'text-orange-300' : 'text-accent'}`}>{unidad}</p>}
        <ul className="mt-4 flex-1 space-y-1.5 text-sm">
          {INCLUYE[language].map((f) => (
            <li key={f} className="flex gap-2">
              <Check size={16} className="mt-0.5 flex-none text-accent" />
              <span className={p.destacado ? 'text-indigo-100' : 'text-muted-foreground'}>{f}</span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => elegir(p)}
          className={`tap-scale mt-5 inline-flex cursor-pointer items-center justify-center rounded-full border-0 px-5 py-2.5 text-sm font-bold ${
            p.destacado ? 'bg-accent text-white' : 'bg-primary text-white'
          }`}
        >
          {es ? 'Empieza ahora' : 'Get started'}
        </button>
      </div>
    );
  };

  const confirmar = async () => {
    if (!hoja) return;
    setComprando(true);
    setError(null);
    trackInitiateCheckout({ plan: hoja.plan });
    try {
      const r = await startCheckout(hoja.plan as CheckoutPlan, getAccessToken());
      if (!r.ok) {
        setError(checkoutMessage(r.reason, es));
        setComprando(false);
        return;
      }
      if (isNative) {
        setComprando(false);
        setHoja(null);
      }
    } catch {
      setError(checkoutMessage('red', es));
      setComprando(false);
    }
  };

  return (
    <div className="min-h-screen bg-white pb-24 md:pb-0">
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between gap-3 md:h-20">
          <Link href="/" className="tap-scale-sm flex items-center gap-2 py-2 font-logo text-xl tracking-tight md:text-2xl">
            <ArrowLeft size={18} className="text-muted-foreground" />
            <span><span className="text-accent">easy</span><span className="text-primary">comex</span></span>
          </Link>
          <span className="hidden rounded-full border border-gray-200 bg-secondary/60 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary sm:block">
            {es ? 'Tokens' : 'Tokens'}
          </span>
        </div>
      </header>

      <div className="container">
        <section className="pb-2 pt-8 text-center md:pt-12">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-orange-500/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-accent">
            <Sparkles size={13} />
            {es ? 'Planes' : 'Plans'}
          </span>
          <h1 className="mx-auto max-w-[22ch] text-3xl font-black leading-[1.08] text-primary sm:text-4xl md:text-5xl">
            {es ? 'Datos reales de mercado, pagando sólo lo que consultas' : 'Real market data, paying only for what you look up'}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">
            {es
              ? 'Cada cuenta tiene 2 consultas gratis por día: búsquedas de mercado o lecturas de etiqueta. Cuando necesitas más, cada una usa un token.'
              : 'Every account gets 2 free lookups a day: market searches or label reads. When you need more, each one uses a token.'}
          </p>
        </section>

        <div className="mx-auto mt-10 max-w-6xl text-center">
          <h2 className="text-2xl font-black text-primary md:text-3xl">{es ? 'Paquetes: no vencen' : 'Packs: never expire'}</h2>
        </div>
        <section className="mx-auto my-8 grid max-w-6xl grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {/* Gratis */}
          <div className="flex flex-col rounded-3xl border border-gray-100 bg-white p-6 app-shadow">
            <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">{es ? 'Gratis' : 'Free'}</p>
            <p className="mt-2 text-3xl font-black text-primary">$0</p>
            <p className="mt-1 text-sm text-muted-foreground">{es ? '2 consultas por día' : '2 lookups a day'}</p>
            <p className="mt-4 flex-1 text-sm text-muted-foreground">
              {es ? 'Crea tu cuenta y prueba TikTok Shop, comercio exterior y la lectura de etiquetas sin costo.' : 'Create your account and try TikTok Shop, foreign-trade data and label reading at no cost.'}
            </p>
            <Link
              href={user ? '/dashboard' : '/registro'}
              className="tap-scale mt-5 inline-flex items-center justify-center rounded-full border-[1.5px] border-primary px-5 py-2.5 text-sm font-bold text-primary"
            >
              {user ? (es ? 'Ir a mi cuenta' : 'Go to my account') : es ? 'Pruébalo ahora' : 'Try it now'}
            </Link>
          </div>

          {PAQUETES.map(tarjeta)}
        </section>

        <div className="mx-auto mt-14 max-w-6xl text-center">
          <h2 className="text-2xl font-black text-primary md:text-3xl">{es ? 'Planes: tokens cada mes' : 'Plans: tokens every month'}</h2>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground">
            {es
              ? 'Más baratos por token. Cada mes del plan trae sus tokens; lo que no uses en el mes no se acumula. Se gastan antes que los de paquete.'
              : 'Cheaper per token. Each month of the plan brings its tokens; what you do not use in a month does not carry over. They are spent before pack tokens.'}
          </p>
        </div>
        <section className="mx-auto my-8 grid max-w-6xl grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PLANES.map(tarjeta)}
        </section>

        <p className="mx-auto mb-10 mt-6 max-w-3xl text-center text-xs text-muted-foreground">
          {es
            ? 'Para comprar tokens necesitas una cuenta: quedan acreditados en ella apenas se aprueba el pago.'
            : 'You need an account to buy tokens: they are credited to it as soon as the payment is approved.'}
        </p>

        <section className="mx-auto mb-16 max-w-3xl">
          <h2 className="mb-5 text-2xl font-black text-primary">{es ? 'Preguntas frecuentes' : 'FAQ'}</h2>
          <div className="divide-y divide-gray-100 rounded-2xl border border-gray-100 bg-white app-shadow">
            {PREGUNTAS[language].map((q, i) => (
              <div key={q.p}>
                <button
                  type="button"
                  aria-expanded={abierta === i}
                  onClick={() => setAbierta(abierta === i ? null : i)}
                  className="flex w-full cursor-pointer items-center justify-between gap-3 border-0 bg-transparent px-5 py-4 text-left font-bold text-primary"
                >
                  {q.p}
                  <ChevronDown size={18} className={`flex-none transition-transform ${abierta === i ? 'rotate-180' : ''}`} />
                </button>
                {abierta === i && <p className="px-5 pb-4 text-sm text-muted-foreground">{q.r}</p>}
              </div>
            ))}
          </div>
        </section>
      </div>

      <CheckoutSheet
        item={hoja}
        open={Boolean(hoja)}
        busy={comprando}
        error={error}
        onConfirm={() => void confirmar()}
        onClose={() => {
          setHoja(null);
          setComprando(false);
        }}
      />
    </div>
  );
}
