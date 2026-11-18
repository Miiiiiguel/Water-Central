import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';
import { AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, ChevronDown, ClipboardCheck, Compass, Lock, MessageCircle, Route, Search, Sparkles } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { estadoDe, hechasPorDiagnostico, type Herramienta, type Tarea } from '@/lib/ruta';
import { cargarAvance, guardarAvance } from '@/lib/rutaProgreso';
import { FLAT, type Answer } from '@/lib/diagnosticContent';
import { IntroScreen, PlanDeAccion, QuizScreen, ResumenResultado, RichText, Servicios, useDiagnostico, type Diagnostico } from '@/components/diagnostico/flujo';
import { requestResearch } from '@/lib/research';
import { whatsappUrl } from '@/lib/contact';
import { openExternal } from '@/lib/native';

// La ruta exportadora a Estados Unidos, con el diagnóstico adentro.
//
// Tres etapas en una sola página:
//   1. El diagnóstico de madurez (gratis, 3 minutos): quién eres y 17
//      preguntas. Lo que responde "Sí" marca solo su tarea en la ruta.
//   2. La ruta de 7 pasos: cada tarea dice, según el diagnóstico, si la
//      tiene o es una brecha, por qué importa y qué herramienta la resuelve.
//   3. El plan de acción (pago): la acción recomendada de cada brecha
//      aparece dentro del paso donde va, junto a su tarea.
//
// Se usa sin cuenta; con cuenta, el avance queda guardado para verlo
// desde cualquier equipo. /diagnostico abre esta misma página: así siguen
// sirviendo los enlaces viejos y la vuelta del pago.

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

interface InfoDiagnostico {
  respuesta: Answer;
  comentario?: string;
  accion?: string;
  /** Hay plan de acción por comprar y esta tarea es una brecha. */
  bloqueada: boolean;
}

function FilaTarea({ t, hecha, onCambiar, es, info, onVerPlan }: { t: Tarea; hecha: boolean; onCambiar: () => void; es: boolean; info: InfoDiagnostico | null; onVerPlan: () => void }) {
  const brecha = info?.respuesta === 'no' && !hecha;
  return (
    <li className="py-3.5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <label className="flex cursor-pointer items-start gap-3">
          <input type="checkbox" checked={hecha} onChange={onCambiar} className="sr-only" />
          <span
            aria-hidden
            className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-md border-[1.5px] transition-colors ${
              hecha ? 'border-green-600 bg-green-600 text-white' : brecha ? 'border-red-300 bg-white' : 'border-gray-300 bg-white'
            }`}
          >
            {hecha && <Check size={14} strokeWidth={3} />}
          </span>
          <span>
            <span className={`text-sm ${hecha ? 'text-muted-foreground line-through' : 'font-semibold text-foreground'}`}>{es ? t.es : t.en}</span>
            {info?.respuesta === 'si' && (
              <span className="ml-2 inline-block rounded-full bg-green-50 px-2 py-0.5 align-middle text-[10px] font-black uppercase tracking-wider text-green-700">
                {es ? 'Cumple' : 'Done'}
              </span>
            )}
            {brecha && (
              <span className="ml-2 inline-block rounded-full bg-red-50 px-2 py-0.5 align-middle text-[10px] font-black uppercase tracking-wider text-red-600">
                {es ? 'Brecha' : 'Gap'}
              </span>
            )}
          </span>
        </label>
        {t.herramienta && !hecha && (
          <div className="flex-none pl-8 sm:pl-0">
            <HerramientaBoton h={t.herramienta} es={es} />
          </div>
        )}
      </div>
      {brecha && info?.comentario && (
        <p className="mt-2 pl-8 text-xs leading-relaxed text-muted-foreground">
          <span className="font-bold text-primary">{es ? 'Por qué importa: ' : 'Why it matters: '}</span>
          {info.comentario}
        </p>
      )}
      {brecha && info?.accion && (
        <div className="ml-8 mt-2 rounded-xl bg-orange-50/70 p-3.5 text-sm leading-relaxed text-primary">
          <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-accent">{es ? 'Acción recomendada' : 'Recommended action'}</span>
          <RichText html={info.accion} />
        </div>
      )}
      {brecha && !info?.accion && info?.bloqueada && (
        <button type="button" onClick={onVerPlan} className="ml-8 mt-2 inline-flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-xs font-bold text-accent hover:underline">
          <Lock size={12} /> {es ? 'Ver la acción recomendada para esta brecha' : 'See the recommended action for this gap'}
        </button>
      )}
    </li>
  );
}

/** Las tres etapas, arriba: dónde va la persona. */
function Etapas({ es, d, pct }: { es: boolean; d: Diagnostico; pct: number | null }) {
  const hecho = d.step === 'result';
  const etapas = [
    { icon: ClipboardCheck, titulo: es ? 'Diagnóstico' : 'Diagnosis', sub: hecho ? `${d.score}% · ${d.tier.name}` : es ? 'Gratis · 3 minutos' : 'Free · 3 minutes', ok: hecho, ancla: '#diagnostico' },
    { icon: Route, titulo: es ? 'Tu ruta en 7 pasos' : 'Your 7-step roadmap', sub: pct === null ? '…' : `${pct}% ${es ? 'completado' : 'complete'}`, ok: pct === 100, ancla: '#pasos' },
    {
      icon: Sparkles,
      titulo: es ? 'Plan de acción' : 'Action plan',
      sub: d.paid ? (es ? 'Desbloqueado' : 'Unlocked') : hecho ? (d.gaps.length ? `${d.gaps.length} ${es ? 'acciones para ti' : 'actions for you'}` : es ? 'Sin brechas' : 'No gaps') : es ? 'Después del diagnóstico' : 'After the diagnosis',
      ok: d.paid,
      ancla: hecho ? '#plan' : '#diagnostico',
    },
  ];
  return (
    <ol className="mt-6 grid grid-cols-3 gap-2">
      {etapas.map((e, i) => {
        const Icon = e.icon;
        return (
          <li key={e.titulo}>
            <a href={e.ancla} className="flex h-full flex-col items-center gap-2 rounded-2xl border border-gray-100 bg-white p-2.5 text-center app-shadow hover:border-accent/40 sm:flex-row sm:gap-3 sm:p-3.5 sm:text-left">
              <span className={`grid h-9 w-9 flex-none place-items-center rounded-xl sm:h-10 sm:w-10 ${e.ok ? 'bg-green-600 text-white' : 'bg-orange-500/10 text-accent'}`}>
                {e.ok ? <Check size={18} strokeWidth={3} /> : <Icon size={18} />}
              </span>
              <span className="min-w-0">
                <span className="hidden text-[10px] font-bold uppercase tracking-wider text-muted-foreground sm:block">{es ? 'Etapa' : 'Stage'} {i + 1}</span>
                <span className="block text-xs font-black leading-tight text-primary sm:truncate sm:text-sm">{e.titulo}</span>
                <span className="hidden truncate text-xs text-muted-foreground sm:block">{e.sub}</span>
              </span>
            </a>
          </li>
        );
      })}
    </ol>
  );
}

const bajarA = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

export default function Ruta() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const es = language === 'es';
  const [hechas, setHechas] = useState<Set<string> | null>(null);
  const [desdeDiagnostico, setDesdeDiagnostico] = useState(false);
  const [enCuenta, setEnCuenta] = useState(false);
  const [abierto, setAbierto] = useState<string | null>(null);
  const hechasRef = useRef<Set<string> | null>(null);
  hechasRef.current = hechas;
  /** Lo que marcó el diagnóstico antes de que terminara de cargar el avance. */
  const pendiente = useRef<Set<string> | null>(null);

  // Terminar el diagnóstico marca en la ruta todo lo que respondió "Sí".
  const alCompletar = useCallback(
    (answers: Answer[]) => {
      const delDiag = hechasPorDiagnostico(answers);
      const actuales = hechasRef.current;
      if (!actuales) {
        pendiente.current = delDiag;
        return;
      }
      const juntas = new Set([...Array.from(actuales), ...Array.from(delDiag)]);
      setHechas(juntas);
      setDesdeDiagnostico(true);
      setAbierto(estadoDe(juntas).actual?.id ?? null);
      void guardarAvance(user?.id ?? null, juntas).then(setEnCuenta);
    },
    [user?.id]
  );

  const d = useDiagnostico({ ruta: '/ruta', alCompletar });

  useEffect(() => {
    document.title = es ? 'Ruta exportadora a Estados Unidos · Easycomex' : 'Export roadmap to the United States · Easycomex';
  }, [es]);

  useEffect(() => {
    let vivo = true;
    void cargarAvance(user?.id ?? null).then((r) => {
      if (!vivo) return;
      let base = r.hechas;
      let delDiag = r.desdeDiagnostico;
      if (pendiente.current) {
        base = new Set([...Array.from(base), ...Array.from(pendiente.current)]);
        pendiente.current = null;
        delDiag = true;
      }
      setHechas(base);
      setDesdeDiagnostico(delDiag);
      setEnCuenta(r.enCuenta);
      setAbierto(estadoDe(base).actual?.id ?? null);
      // Lo que vino del diagnóstico queda guardado como punto de partida.
      if (delDiag || (r.enCuenta && base.size)) void guardarAvance(user?.id ?? null, base);
    });
    return () => {
      vivo = false;
    };
  }, [user?.id]);

  // Al pasar del formulario a las preguntas, o de las preguntas al
  // resultado, la pantalla sube al diagnóstico (no al entrar a la página).
  const primerPaso = useRef(true);
  useEffect(() => {
    if (primerPaso.current) {
      primerPaso.current = false;
      return;
    }
    bajarA('diagnostico');
  }, [d.step]);

  const estado = useMemo(() => (hechas ? estadoDe(hechas) : null), [hechas]);
  const respondido = d.step === 'result';

  const infoDe = (t: Tarea): InfoDiagnostico | null => {
    if (t.diag === undefined || !respondido) return null;
    const respuesta = d.scored[t.diag];
    if (!respuesta) return null;
    const q = FLAT[t.diag];
    return {
      respuesta,
      comentario: respuesta === 'no' ? q.comNo : q.comSi,
      accion: d.acciones.get(t.diag),
      bloqueada: respuesta === 'no' && !d.paid,
    };
  };

  const cambiar = (id: string) => {
    if (!hechas) return;
    const nuevas = new Set(hechas);
    if (nuevas.has(id)) nuevas.delete(id);
    else nuevas.add(id);
    setHechas(nuevas);
    void guardarAvance(user?.id ?? null, nuevas).then(setEnCuenta);
  };

  return (
    <div className="min-h-screen bg-white pb-24 md:pb-12">
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between gap-3 md:h-20">
          <Link href="/" className="tap-scale-sm flex items-center gap-2 py-2 font-logo text-xl tracking-tight md:text-2xl">
            <ArrowLeft size={18} className="text-muted-foreground" />
            <span><span className="text-accent">easy</span><span className="text-primary">comex</span></span>
          </Link>
          <span className="hidden rounded-full border border-gray-200 bg-secondary/60 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary sm:block">
            {es ? 'Ruta exportadora · Estados Unidos' : 'Export roadmap · United States'}
          </span>
        </div>
      </header>

      <div className="container max-w-5xl">
        <section className="pb-2 pt-8 md:pt-10">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-orange-500/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-accent">
            <Compass size={13} />
            {es ? 'Tu ruta exportadora' : 'Your export roadmap'}
          </span>
          <h1 className="max-w-[22ch] text-3xl font-black leading-[1.08] text-primary sm:text-4xl md:text-5xl">
            {es ? (
              <>Tu ruta para vender en <span className="text-accent">Estados Unidos</span></>
            ) : (
              <>Your roadmap to sell in the <span className="text-accent">United States</span></>
            )}
          </h1>
          <p className="mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">
            {es
              ? 'Empieza con un diagnóstico de 3 minutos. Con tus respuestas armamos tu ruta de 7 pasos: lo que ya tienes queda marcado y, en lo que falta, ves por qué importa y la herramienta que lo resuelve.'
              : 'Start with a 3-minute diagnosis. Your answers build your 7-step roadmap: what you already have is ticked and, for what is missing, you see why it matters and the tool that solves it.'}
          </p>
          <Etapas es={es} d={d} pct={estado?.pct ?? null} />
        </section>

        <section id="diagnostico" className="mt-8 scroll-mt-24">
          <AnimatePresence mode="wait" initial={false}>
            {d.step === 'intro' && (
              <div key="intro">
                <IntroScreen lead={d.lead} onChange={d.setLead} onStart={() => d.setStep('quiz')} es={es} />
                <button type="button" onClick={() => bajarA('pasos')} className="mb-2 cursor-pointer border-0 bg-transparent p-0 text-sm font-semibold text-muted-foreground underline hover:text-primary">
                  {es ? 'Prefiero ver la ruta y marcarla a mano' : 'I would rather see the roadmap and tick it myself'}
                </button>
              </div>
            )}
            {d.step === 'quiz' && (
              <QuizScreen key="quiz" answers={d.answers} onAnswer={d.setAnswer} onFinish={() => void d.finish()} onBackToIntro={() => d.setStep('intro')} es={es} />
            )}
            {d.step === 'result' && <ResumenResultado key="resultado" d={d} es={es} onVerRuta={() => bajarA('pasos')} />}
          </AnimatePresence>
        </section>

        {d.step !== 'quiz' && (
          <>
            {estado && (
              <section id="avance" className="mt-10 rounded-3xl bg-gradient-to-br from-[#130B2E] via-primary to-[#1F2E73] p-6 text-white md:p-8">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold tracking-wide text-indigo-200">{es ? 'TU AVANCE EN LA RUTA' : 'YOUR ROADMAP PROGRESS'}</p>
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
                    ? es ? 'Marcamos como hecho lo que respondiste "Sí" en tu diagnóstico. ' : 'We ticked what you answered "Yes" in your diagnosis. '
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

            <section id="pasos" className="mt-6 scroll-mt-24">
              <h2 className="mb-3 text-2xl font-black text-primary md:text-3xl">{es ? 'Los 7 pasos' : 'The 7 steps'}</h2>
              <ol className="space-y-3">
                {estado?.porPaso.map(({ paso, hechas: h, total, completo }) => {
                  const actual = estado.actual?.id === paso.id;
                  const open = abierto === paso.id;
                  const brechas = respondido ? paso.tareas.filter((t) => t.diag !== undefined && d.scored[t.diag] === 'no' && !hechas?.has(t.id)).length : 0;
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
                            {brechas > 0 && <span className="font-bold text-red-600"> · {brechas} {es ? (brechas === 1 ? 'brecha' : 'brechas') : brechas === 1 ? 'gap' : 'gaps'}</span>}
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
                              <FilaTarea key={t.id} t={t} hecha={hechas.has(t.id)} onCambiar={() => cambiar(t.id)} es={es} info={infoDe(t)} onVerPlan={() => bajarA('plan')} />
                            ))}
                          </ul>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
              {!respondido && (
                <button type="button" onClick={() => bajarA('diagnostico')} className="tap-scale mt-4 inline-flex cursor-pointer items-center gap-2 rounded-full border-0 bg-accent px-5 py-2.5 text-sm font-bold text-white">
                  {es ? 'Hacer el diagnóstico y marcarla sola' : 'Take the diagnosis and tick it automatically'} <ArrowRight size={14} />
                </button>
              )}
            </section>

            {respondido && (
              <section id="plan" className="mt-12 scroll-mt-24">
                <PlanDeAccion d={d} es={es} onVerRuta={() => bajarA('pasos')} />
              </section>
            )}

            <section className="mt-12">
              <p className="text-xs font-bold uppercase tracking-wider text-accent">{es ? 'Siguiente paso' : 'Next step'}</p>
              <h2 className="mt-2 mb-6 text-2xl font-black text-primary md:text-3xl">{es ? '¿Quieres que recorramos la ruta contigo?' : 'Want us to walk the roadmap with you?'}</h2>
              <Servicios d={respondido ? d : null} es={es} />
            </section>

            {d.result?.ref && (
              <p className="mt-10 border-t border-gray-100 pt-6 text-xs text-muted-foreground">
                {es ? 'Referencia de tu diagnóstico: ' : 'Your diagnosis reference: '}
                <code>{d.result.ref}</code>
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
