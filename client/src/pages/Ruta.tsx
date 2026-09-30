import { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, ArrowRight, Check, ChevronDown, Compass, MessageCircle, Search } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { estadoDe, type Herramienta, type Tarea } from '@/lib/ruta';
import { cargarAvance, guardarAvance } from '@/lib/rutaProgreso';
import { requestResearch } from '@/lib/research';
import { whatsappUrl } from '@/lib/contact';
import { openExternal } from '@/lib/native';

// La ruta exportadora: los 7 pasos para vender en EE. UU., con lo que
// falta en cada uno y la herramienta que lo resuelve. Se usa sin cuenta;
// con cuenta, el avance queda guardado para verlo desde cualquier equipo.

function HerramientaBoton({ h, es }: { h: Herramienta; es: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState('');
  const cls = 'tap-scale-sm inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-primary hover:border-accent';

  if (h.tipo === 'ruta') {
    return (
      <Link href={h.href} className={cls}>
        {es ? h.es : h.en} <ArrowRight size={12} />
      </Link>
    );
  }
  if (h.tipo === 'asesor') {
    const url = whatsappUrl(`Hola, ${h.mensaje}`);
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          e.preventDefault();
          void openExternal(url);
        }}
        className={cls}
      >
        <MessageCircle size={12} /> {es ? h.es : h.en}
      </a>
    );
  }
  // Buscar: la consulta la hace Marco Polo, con el producto que la persona escriba.
  if (!abierto) {
    return (
      <button type="button" onClick={() => setAbierto(true)} className={cls}>
        <Search size={12} /> {es ? h.es : h.en}
      </button>
    );
  }
  return (
    <form
      className="flex w-full max-w-sm gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const texto = q.trim();
        if (texto.length < 2) return;
        requestResearch({ source: h.fuente, query: texto, question: texto });
        setAbierto(false);
        setQ('');
      }}
    >
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={es ? 'Tu producto, ej.: café' : 'Your product, e.g. coffee'}
        className="min-w-0 flex-1 rounded-full border-[1.5px] border-gray-200 bg-white px-3 py-1.5 text-sm outline-none focus:border-accent"
      />
      <button type="submit" className="tap-scale-sm cursor-pointer rounded-full border-0 bg-primary px-3 py-1.5 text-xs font-bold text-white">
        {es ? 'Buscar' : 'Search'}
      </button>
    </form>
  );
}

function FilaTarea({ t, hecha, onCambiar, es }: { t: Tarea; hecha: boolean; onCambiar: () => void; es: boolean }) {
  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
      <label className="flex cursor-pointer items-start gap-3">
        <input type="checkbox" checked={hecha} onChange={onCambiar} className="sr-only" />
        <span
          aria-hidden
          className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-md border-[1.5px] transition-colors ${
            hecha ? 'border-green-600 bg-green-600 text-white' : 'border-gray-300 bg-white'
          }`}
        >
          {hecha && <Check size={14} strokeWidth={3} />}
        </span>
        <span className={`text-sm ${hecha ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{es ? t.es : t.en}</span>
      </label>
      {t.herramienta && !hecha && (
        <div className="pl-8 sm:pl-0">
          <HerramientaBoton h={t.herramienta} es={es} />
        </div>
      )}
    </li>
  );
}

export default function Ruta() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const es = language === 'es';
  const [hechas, setHechas] = useState<Set<string> | null>(null);
  const [desdeDiagnostico, setDesdeDiagnostico] = useState(false);
  const [enCuenta, setEnCuenta] = useState(false);
  const [abierto, setAbierto] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    void cargarAvance(user?.id ?? null).then((r) => {
      if (!vivo) return;
      setHechas(r.hechas);
      setDesdeDiagnostico(r.desdeDiagnostico);
      setEnCuenta(r.enCuenta);
      setAbierto(estadoDe(r.hechas).actual?.id ?? null);
      // Lo que vino del diagnóstico queda guardado como punto de partida.
      if (r.desdeDiagnostico || (r.enCuenta && r.hechas.size)) void guardarAvance(user?.id ?? null, r.hechas);
    });
    return () => {
      vivo = false;
    };
  }, [user?.id]);

  const estado = useMemo(() => (hechas ? estadoDe(hechas) : null), [hechas]);

  const cambiar = (id: string) => {
    if (!hechas) return;
    const nuevas = new Set(hechas);
    if (nuevas.has(id)) nuevas.delete(id);
    else nuevas.add(id);
    setHechas(nuevas);
    void guardarAvance(user?.id ?? null, nuevas).then(setEnCuenta);
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
            {es ? 'Ruta exportadora' : 'Export roadmap'}
          </span>
        </div>
      </header>

      <div className="container max-w-4xl">
        <section className="pb-2 pt-8 md:pt-10">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-orange-500/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-accent">
            <Compass size={13} />
            {es ? 'Tu ruta exportadora' : 'Your export roadmap'}
          </span>
          <h1 className="max-w-[20ch] text-3xl font-black leading-[1.08] text-primary sm:text-4xl md:text-5xl">
            {es ? '7 pasos para vender en Estados Unidos' : '7 steps to sell in the United States'}
          </h1>
          <p className="mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">
            {es
              ? 'Marca lo que ya tienes resuelto. En cada paso está la herramienta de Easycomex que te ayuda con lo que falta.'
              : 'Tick off what you already have. Each step shows the Easycomex tool that helps with what is missing.'}
          </p>
        </section>

        {estado && (
          <section className="my-7 rounded-3xl bg-gradient-to-br from-[#130B2E] via-primary to-[#1F2E73] p-6 text-white md:p-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold tracking-wide text-indigo-200">{es ? 'TU AVANCE' : 'YOUR PROGRESS'}</p>
                <p className="text-4xl font-black md:text-5xl">
                  {estado.pct}<span className="text-accent">%</span>
                </p>
                <p className="mt-1 text-sm text-indigo-200">
                  {estado.hechas} {es ? 'de' : 'of'} {estado.total} {es ? 'tareas' : 'tasks'}
                </p>
              </div>
              <p className="max-w-xs text-sm text-indigo-100">
                {estado.actual
                  ? `${es ? 'Estás en el paso' : 'You are on step'} ${estado.actual.n}: ${es ? estado.actual.titulo.es : estado.actual.titulo.en}`
                  : es ? 'Completaste la ruta. Ahora toca escalar.' : 'You completed the roadmap. Time to scale.'}
              </p>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-gradient-to-r from-orange-400 to-orange-500 transition-all duration-500" style={{ width: `${estado.pct}%` }} />
            </div>
            <p className="mt-4 text-xs text-indigo-200">
              {desdeDiagnostico
                ? es ? 'Marcamos como hecho lo que respondiste "Sí" en tu diagnóstico de madurez. ' : 'We ticked what you answered "Yes" in your maturity diagnosis. '
                : ''}
              {enCuenta
                ? es ? 'Tu avance queda guardado en tu cuenta.' : 'Your progress is saved to your account.'
                : es ? 'Tu avance queda en este navegador. ' : 'Your progress stays in this browser. '}
              {!enCuenta && !user && (
                <Link href="/registro" className="font-bold text-orange-300 underline">
                  {es ? 'Crea tu cuenta para verlo desde cualquier equipo.' : 'Create an account to see it anywhere.'}
                </Link>
              )}
            </p>
          </section>
        )}

        {estado && estado.hechas === 0 && !desdeDiagnostico && (
          <div className="mb-6 flex flex-col items-start justify-between gap-3 rounded-2xl border border-orange-100 bg-orange-50/60 p-5 sm:flex-row sm:items-center">
            <p className="text-sm text-primary">
              {es ? '¿No sabes por dónde empezar? El diagnóstico de madurez (3 minutos, gratis) marca lo que ya tienes.' : 'Not sure where to start? The maturity diagnosis (3 minutes, free) ticks what you already have.'}
            </p>
            <Link href="/diagnostico" className="tap-scale inline-flex flex-none items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-bold text-white">
              {es ? 'Hacer el diagnóstico' : 'Take the diagnosis'} <ArrowRight size={14} />
            </Link>
          </div>
        )}

        <ol className="mb-16 space-y-3">
          {estado?.porPaso.map(({ paso, hechas: h, total, completo }) => {
            const actual = estado.actual?.id === paso.id;
            const open = abierto === paso.id;
            return (
              <li key={paso.id} className={`rounded-3xl border bg-white app-shadow ${actual ? 'border-accent/40' : 'border-gray-100'}`}>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setAbierto(open ? null : paso.id)}
                  className="flex w-full cursor-pointer items-center gap-4 border-0 bg-transparent p-5 text-left"
                >
                  <span
                    className={`flex h-10 w-10 flex-none items-center justify-center rounded-2xl text-sm font-black ${
                      completo ? 'bg-green-600 text-white' : actual ? 'bg-accent text-white' : 'bg-secondary text-primary'
                    }`}
                  >
                    {completo ? <Check size={18} strokeWidth={3} /> : paso.n}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-primary">{es ? paso.titulo.es : paso.titulo.en}</span>
                    <span className="block text-xs text-muted-foreground">
                      {h}/{total} {es ? 'listas' : 'done'}
                      {actual && (es ? ' · estás aquí' : ' · you are here')}
                    </span>
                  </span>
                  <ChevronDown size={18} className={`flex-none text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
                {open && hechas && (
                  <div className="border-t border-gray-100 px-5 pb-4">
                    <p className="pt-3 text-sm text-muted-foreground">{es ? paso.objetivo.es : paso.objetivo.en}</p>
                    <ul className="divide-y divide-gray-100">
                      {paso.tareas.map((t) => (
                        <FilaTarea key={t.id} t={t} hecha={hechas.has(t.id)} onCambiar={() => cambiar(t.id)} es={es} />
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

