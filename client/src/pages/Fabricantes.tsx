import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, Check, Factory, Loader2, Search } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { TarjetaFabricante } from '@/components/FabricantesPatrocinados';
import { directorioFabricantes, solicitarAparecer, type Fabricante } from '@/lib/fabricantes';
import { PAISES } from '@/lib/paises';

// /fabricantes: el directorio de fabricantes patrocinados (marcas,
// laboratorios y maquiladores que fabrican con la marca del cliente) y,
// abajo, el formulario para que un fabricante pida aparecer. La
// solicitud queda pendiente hasta que una cuenta maestra la aprueba en
// /admin/fabricantes.

const inputCls =
  'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-primary outline-none placeholder:text-gray-400 focus:border-accent focus:ring-2 focus:ring-accent/20';

function Solicitud({ es }: { es: boolean }) {
  const [empresa, setEmpresa] = useState('');
  const [contacto, setContacto] = useState('');
  const [correo, setCorreo] = useState('');
  const [telefono, setTelefono] = useState('');
  const [pais, setPais] = useState('CO');
  const [ciudad, setCiudad] = useState('');
  const [queFabrica, setQueFabrica] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    const r = await solicitarAparecer({ empresa, contacto_nombre: contacto, correo, telefono, pais, ciudad, que_fabrica: queFabrica });
    setEnviando(false);
    if (r.ok) setListo(true);
    else setError(r.message);
  };

  if (listo)
    return (
      <p className="flex items-center gap-2 rounded-2xl bg-green-50 p-4 font-semibold text-green-800">
        <Check size={18} />
        {es ? 'Recibimos tu solicitud. Te escribimos con los planes de pauta en menos de un día hábil.' : 'We got your request. We will write to you with the listing plans within one business day.'}
      </p>
    );

  return (
    <form onSubmit={enviar} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <input value={empresa} onChange={(e) => setEmpresa(e.target.value)} required minLength={2} placeholder={es ? 'Empresa' : 'Company'} aria-label={es ? 'Empresa' : 'Company'} className={inputCls} />
      <input value={contacto} onChange={(e) => setContacto(e.target.value)} required minLength={2} placeholder={es ? 'Tu nombre' : 'Your name'} aria-label={es ? 'Tu nombre' : 'Your name'} className={inputCls} />
      <input value={correo} onChange={(e) => setCorreo(e.target.value)} required type="email" placeholder={es ? 'Correo' : 'Email'} aria-label={es ? 'Correo' : 'Email'} className={inputCls} />
      <input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="WhatsApp" aria-label="WhatsApp" className={inputCls} />
      <select value={pais} onChange={(e) => setPais(e.target.value)} aria-label={es ? 'País' : 'Country'} className={inputCls}>
        {PAISES.filter((p) => p.iso !== 'US').map((p) => (
          <option key={p.iso} value={p.iso}>{es ? p.es : p.en}</option>
        ))}
      </select>
      <input value={ciudad} onChange={(e) => setCiudad(e.target.value)} placeholder={es ? 'Ciudad' : 'City'} aria-label={es ? 'Ciudad' : 'City'} className={inputCls} />
      <textarea
        value={queFabrica}
        onChange={(e) => setQueFabrica(e.target.value)}
        required
        minLength={5}
        rows={3}
        placeholder={es ? 'Qué fabrican (ej.: shampoo, cremas y maquillaje con marca propia; pedido mínimo 500 unidades; registro Invima)' : 'What you make (e.g. private-label shampoo, creams and makeup; minimum 500 units)'}
        aria-label={es ? 'Qué fabrican' : 'What you make'}
        className={`${inputCls} sm:col-span-2`}
      />
      {error && <p role="alert" className="text-sm font-semibold text-red-600 sm:col-span-2">{error}</p>}
      <button type="submit" disabled={enviando} className="tap-scale-sm inline-flex w-fit items-center gap-2 rounded-full bg-accent px-5 py-2.5 font-bold text-white disabled:opacity-60">
        {enviando && <Loader2 size={16} className="animate-spin" />}
        {es ? 'Quiero aparecer' : 'Get listed'}
      </button>
    </form>
  );
}

export default function Fabricantes() {
  const { language } = useLanguage();
  const es = language === 'es';
  const [q, setQ] = useState('');
  const [buscado, setBuscado] = useState('');
  const [lista, setLista] = useState<Fabricante[] | null>(null);
  const [falla, setFalla] = useState(false);

  useEffect(() => {
    let vivo = true;
    void directorioFabricantes(buscado).then((r) => {
      if (!vivo) return;
      setFalla(r === null);
      setLista(r ?? []);
    });
    return () => {
      vivo = false;
    };
  }, [buscado]);

  return (
    <div className="min-h-screen bg-white pb-24 md:pb-0">
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between gap-3 md:h-20">
          <Link href="/" className="tap-scale-sm flex items-center gap-2 py-2 font-logo text-xl tracking-tight md:text-2xl">
            <ArrowLeft size={18} className="text-muted-foreground" />
            <span><span className="text-accent">easy</span><span className="text-primary">comex</span></span>
          </Link>
          <span className="hidden rounded-full border border-gray-200 bg-secondary/60 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary sm:block">
            {es ? 'Fabricantes' : 'Manufacturers'}
          </span>
        </div>
      </header>

      <main className="container max-w-4xl py-8 md:py-12">
        <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-orange-500/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-accent">
          <Factory size={13} /> {es ? 'Fabrícalo con tu marca' : 'Make it under your brand'}
        </span>
        <h1 className="text-3xl font-black leading-tight text-primary md:text-4xl">
          {es ? 'Fabricantes que hacen tu producto con tu propia marca' : 'Manufacturers that make your product under your own brand'}
        </h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          {es
            ? 'Laboratorios, maquiladores y marcas de Latinoamérica listos para fabricar lo que quieres vender. Escríbeles desde aquí.'
            : 'Labs, contract manufacturers and brands in Latin America ready to make what you want to sell. Write to them from here.'}
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setBuscado(q.trim());
          }}
          className="mt-6 flex gap-2"
        >
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 focus-within:border-accent">
            <Search size={16} className="text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={es ? '¿Qué producto quieres fabricar? (ej.: shampoo, camisetas)' : 'What do you want to make? (e.g. shampoo, t-shirts)'}
              aria-label={es ? 'Buscar fabricantes' : 'Search manufacturers'}
              className="w-full bg-transparent py-2.5 text-sm text-primary outline-none"
            />
          </div>
          <button type="submit" className="tap-scale-sm rounded-xl bg-primary px-4 font-bold text-white">
            {es ? 'Buscar' : 'Search'}
          </button>
        </form>

        <div className="mt-6 space-y-3">
          {lista === null && <Loader2 className="mx-auto mt-10 animate-spin text-accent" size={24} />}
          {lista?.map((f) => (
            <TarjetaFabricante key={f.id} f={f} es={es} contexto={buscado} lugar="directorio" />
          ))}
          {lista && lista.length === 0 && (
            <p className="rounded-2xl border border-dashed border-gray-200 p-6 text-center text-sm text-muted-foreground">
              {falla
                ? es ? 'No pudimos cargar el directorio. Intenta de nuevo en un momento.' : 'We could not load the directory. Try again shortly.'
                : buscado
                  ? es ? `Todavía no hay fabricantes para "${buscado}". Escríbenos y te ayudamos a encontrar uno.` : `No manufacturers for "${buscado}" yet. Write to us and we will help you find one.`
                  : es ? 'Pronto verás aquí los primeros fabricantes.' : 'The first manufacturers will show up here soon.'}
            </p>
          )}
        </div>

        <section id="aparecer" className="mt-14 scroll-mt-24 rounded-3xl border border-gray-100 bg-secondary/40 p-5 md:p-8">
          <h2 className="text-2xl font-black text-primary">{es ? '¿Eres fabricante? Aparece aquí' : 'Are you a manufacturer? Get listed'}</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            {es
              ? 'Sal de primero cuando un exportador investigue un producto que tú fabricas: en el asistente Marco Polo, en la calculadora de rentabilidad y en este directorio. Te llegan sus datos y su mensaje directo a tu correo.'
              : 'Show up first when an exporter researches a product you make: in the Marco Polo assistant, in the ROI calculator and in this directory. Their details and message go straight to your inbox.'}
          </p>
          <div className="mt-5">
            <Solicitud es={es} />
          </div>
        </section>
      </main>
    </div>
  );
}
