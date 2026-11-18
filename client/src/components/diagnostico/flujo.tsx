import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'wouter';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, Check, ChevronLeft, Loader2, Lock, MessageCircle, RotateCcw, ShieldCheck, Sparkles, X,
} from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { whatsappUrl } from '@/lib/contact';
import { isNative, openExternal, hapticTap } from '@/lib/native';
import { trackLead, trackInitiateCheckout } from '@/lib/analytics';
import {
  FLAT, OFFERS, SECTIONS, SCORED_QUESTIONS, TOTAL_QUESTIONS, gapsIn, isComplete, scorePct, tierFor, type Answer,
} from '@/lib/diagnosticContent';
import {
  confirmDiagnostic, createDiagnostic, getConfig, getDiagnostic, loadStored, loadWompiWidget, saveStored, wompiInit,
  wompiRedirectUrl, type Country, type DiagnosticConfig, type DiagnosticResult, type Lead,
} from '@/lib/diagnosticApi';

// El diagnóstico de madurez, como piezas para la ruta exportadora
// (pages/Ruta.tsx): quién eres, las preguntas una por una, y el
// resultado. La parte gratis (puntaje, nivel, un comentario por
// respuesta) se calcula acá; la parte paga (qué hacer con cada brecha)
// sólo llega del servidor después de que Wompi confirma el pago. El
// contenido es el del equipo, en español, palabra por palabra.

export type Step = 'intro' | 'quiz' | 'result';
export type EstadoPago = 'idle' | 'opening' | 'confirming' | 'pending';
type Stored = ReturnType<typeof loadStored>;

const EMPTY_LEAD: Lead = { empresa: '', nombre: '', celular: '', correo: '', pais: 'CO' };

const inputClass =
  'w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-primary outline-none transition-all placeholder:text-gray-400 focus:border-accent focus:ring-2 focus:ring-accent/20';

export const fade = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const },
};

// ---------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------

/**
 * The actions contain <a href="https://…">…</a> from the team's copy.
 * They're rendered as React anchors — never as raw HTML — so nothing
 * that isn't a plain https link can come out of them.
 */
export function RichText({ html }: { html: string }) {
  const parts = useMemo(() => {
    const out: ReactNode[] = [];
    const re = /<a\s+href="(https:\/\/[^"]+)"[^>]*>([^<]*)<\/a>/g;
    let last = 0;
    let m: RegExpExecArray | null;
    let i = 0;
    while ((m = re.exec(html))) {
      if (m.index > last) out.push(html.slice(last, m.index));
      const href = m[1];
      out.push(
        <a
          key={i++}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            if (!isNative) return;
            e.preventDefault();
            void openExternal(href);
          }}
          className="font-semibold text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent"
        >
          {m[2]}
        </a>
      );
      last = m.index + m[0].length;
    }
    if (last < html.length) out.push(html.slice(last));
    return out;
  }, [html]);
  return <>{parts}</>;
}

export function ScoreRing({ value, colorClass, chico = false }: { value: number; colorClass: string; chico?: boolean }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const dur = 1100;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(value * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  const R = 84;
  const C = 2 * Math.PI * R;
  return (
    <div className={`relative mx-auto ${chico ? 'h-40 w-40' : 'h-52 w-52'}`}>
      <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
        <circle cx="100" cy="100" r={R} fill="none" stroke="currentColor" strokeWidth="14" className="text-gray-100" />
        <circle
          cx="100"
          cy="100"
          r={R}
          fill="none"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C - (C * shown) / 100}
          className={`${colorClass} transition-[stroke-dashoffset] duration-100`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`${chico ? 'text-4xl' : 'text-5xl'} font-black tabular-nums text-primary`}>{shown}%</span>
        <span className="mt-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">nivel de madurez</span>
      </div>
    </div>
  );
}

export function Tag({ children, tone }: { children: ReactNode; tone: 'ok' | 'gap' | 'act' | 'neutral' }) {
  const cls = {
    ok: 'bg-green-50 text-green-700',
    gap: 'bg-red-50 text-red-600',
    act: 'bg-orange-50 text-accent',
    neutral: 'bg-secondary text-muted-foreground',
  }[tone];
  return <span className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${cls}`}>{children}</span>;
}

// ---------------------------------------------------------------------
// Screen 1 — who you are
// ---------------------------------------------------------------------

export function IntroScreen({ lead, onChange, onStart, es }: { lead: Lead; onChange: (l: Lead) => void; onStart: () => void; es: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [website, setWebsite] = useState(''); // honeypot

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (website) return; // bot
    if (lead.nombre.trim().length < 2) return setError(es ? 'Escribe tu nombre.' : 'Enter your name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.correo.trim())) return setError(es ? 'Ese correo no se ve bien.' : 'That email does not look right.');
    setError(null);
    void hapticTap();
    onStart();
  };

  const field = (key: keyof Lead) => ({
    value: lead[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => onChange({ ...lead, [key]: e.target.value }),
  });

  return (
    <motion.div key="intro" {...fade}>
      <section className="pb-4 pt-2">
        <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-orange-500/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-accent">
          <Sparkles size={13} />
          {es ? 'Diagnóstico gratuito · 3 minutos' : 'Free diagnosis · 3 minutes'}
        </span>
        <h2 className="max-w-[20ch] text-2xl font-black leading-[1.1] text-primary sm:text-3xl md:text-4xl">
          {es ? (
            <>¿Qué tan preparada está tu marca para vender en <span className="text-accent">Estados Unidos</span>?</>
          ) : (
            <>How ready is your brand to sell in the <span className="text-accent">United States</span>?</>
          )}
        </h2>
        <p className="mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">
          {es
            ? '17 preguntas sobre tu marca, tu logística y tu marketing. Al terminar: tu nivel de madurez, un comentario por cada punto y tu ruta de 7 pasos marcada con lo que ya tienes. Sin costo y sin llamada de ventas.'
            : '17 questions about your brand, logistics and marketing. At the end: your maturity level, a comment on every point and your 7-step roadmap ticked with what you already have. Free and with no sales call.'}
        </p>
        <div className="mt-6 grid max-w-md grid-cols-3 divide-x divide-gray-100 rounded-2xl border border-gray-100 bg-white app-shadow">
          {[
            [String(TOTAL_QUESTIONS), es ? 'preguntas' : 'questions'],
            [String(SECTIONS.length), es ? 'etapas' : 'stages'],
            ['0–100%', es ? 'madurez' : 'maturity'],
          ].map(([n, l]) => (
            <div key={l} className="px-3 py-4 text-center">
              <div className="text-xl font-black text-primary md:text-2xl">{n}</div>
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{l}</div>
            </div>
          ))}
        </div>
      </section>

      <form onSubmit={submit} noValidate className="my-8 max-w-2xl rounded-3xl border border-gray-100 bg-white p-6 app-shadow md:p-8">
        <div className="mb-5 flex items-start gap-3">
          <div className="grid h-10 w-10 flex-none place-items-center rounded-2xl bg-orange-500/10 text-accent">
            <ShieldCheck size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-primary">{es ? 'Datos de contacto' : 'Contact details'}</h2>
            <p className="text-sm text-muted-foreground">
              {es ? 'Para enviarte tu resultado y las acciones recomendadas.' : 'So we can send you your result and the recommended actions.'}
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="mb-1.5 block text-sm font-semibold text-muted-foreground">{es ? 'Empresa o marca' : 'Company or brand'}</span>
            <input type="text" autoComplete="organization" placeholder={es ? 'Tu empresa o marca' : 'Your company or brand'} className={inputClass} {...field('empresa')} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-muted-foreground">{es ? 'Nombre' : 'Name'} *</span>
            <input type="text" autoComplete="name" required placeholder={es ? 'Nombre y apellido' : 'First and last name'} className={inputClass} {...field('nombre')} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-muted-foreground">{es ? 'Celular' : 'Mobile'}</span>
            <input type="tel" autoComplete="tel" inputMode="tel" placeholder="+57 300 000 0000" className={inputClass} {...field('celular')} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-muted-foreground">{es ? 'Correo' : 'Email'} *</span>
            <input type="email" autoComplete="email" inputMode="email" required placeholder="correo@empresa.com" className={inputClass} {...field('correo')} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-muted-foreground">{es ? 'País de tu empresa' : 'Country of your company'}</span>
            <select className={inputClass} {...field('pais')}>
              <option value="CO">Colombia</option>
              <option value="US">{es ? 'Estados Unidos' : 'United States'}</option>
              <option value="OT">{es ? 'Otro país' : 'Other country'}</option>
            </select>
            <span className="mt-1 block text-xs text-muted-foreground">{es ? 'Define la moneda y los medios de pago.' : 'Sets the currency and payment methods.'}</span>
          </label>
          {/* Honeypot: invisible to people, irresistible to bots. */}
          {/* Trampa para bots: fuera de la pantalla, no oculta con
              `display:none`. Un bot rellena todo lo que encuentra en el
              DOM, pero muchos saltan lo que está en display:none — que
              es lo que este campo usaba, así que no atrapaba a nadie.
              Fuera de pantalla sí lo ven y caen. `aria-hidden` y
              `tabIndex={-1}` lo esconden de quien navega con lector de
              pantalla o con el teclado, que es a quien no queremos
              rechazar por error. */}
          <div className="absolute -left-[9999px] top-0 h-0 w-0 overflow-hidden" aria-hidden="true">
            <label htmlFor="diagnostic-website">Website</label>
            <input id="diagnostic-website" type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </div>
        </div>

        {error && <p className="mt-4 text-sm font-semibold text-red-600">{error}</p>}

        <button
          type="submit"
          className="tap-scale mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-6 py-4 text-base font-bold text-white shadow-lg shadow-orange-500/25 transition-colors hover:bg-orange-600"
        >
          {es ? 'Iniciar diagnóstico' : 'Start the diagnosis'}
          <ArrowRight size={18} />
        </button>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          {es ? 'Tus datos se usan solo para tu diagnóstico y seguimiento. No los compartimos.' : 'Your details are used only for your diagnosis and follow-up. We never share them.'}
        </p>
      </form>

      <RecoverBox es={es} />
    </motion.div>
  );
}

/**
 * "Ya compré mi plan y lo perdí."
 *
 * La referencia vive en el localStorage del navegador: quien cambia de
 * equipo, limpia el navegador o simplemente cierra la pestaña se queda
 * sin lo que pagó. La fila sigue en el servidor; esto es la puerta.
 *
 * El servidor contesta lo mismo exista o no ese correo, así que acá se
 * muestra ese mismo mensaje sin prometer que algo salió.
 */
function RecoverBox({ es }: { es: boolean }) {
  const [open, setOpen] = useState(false);
  const [correo, setCorreo] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  const enviar = async () => {
    setState('sending');
    setError(null);
    try {
      const res = await fetch('/api/diagnostic/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ correo }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? (es ? 'No se pudo enviar.' : 'Could not send.'));
        setState('idle');
        return;
      }
      setState('done');
    } catch {
      setError(es ? 'No hay conexión. Intenta de nuevo.' : 'No connection. Try again.');
      setState('idle');
    }
  };

  return (
    <div className="mx-auto mt-6 max-w-2xl text-center text-sm">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="text-muted-foreground underline hover:text-accent">
          {es ? '¿Ya compraste tu plan de acción y lo perdiste?' : 'Already bought your action plan and lost it?'}
        </button>
      ) : state === 'done' ? (
        <p className="rounded-2xl bg-orange-50 px-5 py-4 text-left text-muted-foreground">
          {es
            ? 'Si ese correo tiene un plan de acción pagado, ya va en camino. Revisa también la carpeta de spam.'
            : 'If that address has a paid action plan, it is on its way. Check your spam folder too.'}
        </p>
      ) : (
        <div className="rounded-2xl bg-gray-50 px-5 py-4 text-left">
          <p className="mb-2 font-semibold text-primary">{es ? 'Te reenviamos el enlace' : 'We will resend your link'}</p>
          <p className="mb-3 text-xs text-muted-foreground">
            {es ? 'Escribe el correo con el que pagaste.' : 'Enter the email you paid with.'}
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              placeholder="correo@empresa.com"
              className="min-w-0 flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={enviar}
              disabled={!correo.includes('@') || state === 'sending'}
              className="tap-scale-sm rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {state === 'sending' ? (es ? 'Enviando…' : 'Sending…') : es ? 'Enviar' : 'Send'}
            </button>
          </div>
          {error && <p className="mt-2 text-xs font-semibold text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Screen 2 — one question at a time
// ---------------------------------------------------------------------

export function QuizScreen({
  answers, onAnswer, onFinish, onBackToIntro, es,
}: {
  answers: (Answer | string)[];
  onAnswer: (index: number, value: Answer | string) => void;
  onFinish: () => void;
  onBackToIntro: () => void;
  es: boolean;
}) {
  // Resume where they left off: the first unanswered scored question.
  const firstOpen = FLAT.findIndex((q) => q.type !== 'input' && (answers[q.index] !== 'si' && answers[q.index] !== 'no'));
  const [i, setI] = useState(firstOpen === -1 ? 0 : firstOpen);
  const [dir, setDir] = useState(1);
  const q = FLAT[i];
  const last = i === TOTAL_QUESTIONS - 1;
  const answered = FLAT.filter((x) => x.type !== 'input' && (answers[x.index] === 'si' || answers[x.index] === 'no')).length;
  const progress = Math.round((answered / SCORED_QUESTIONS) * 100);

  const go = (next: number) => {
    setDir(next > i ? 1 : -1);
    setI(Math.max(0, Math.min(TOTAL_QUESTIONS - 1, next)));
  };

  const pick = (value: 'si' | 'no') => {
    void hapticTap();
    onAnswer(i, value);
    if (last) onFinish();
    else setTimeout(() => go(i + 1), 180);
  };

  const proceed = () => {
    if (last) onFinish();
    else go(i + 1);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (q.type === 'input') return;
      // En la ruta hay otros campos (buscar con Marco Polo): escribir ahí no responde.
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 's' || e.key === 'S' || e.key === 'y' || e.key === 'Y') pick('si');
      if (e.key === 'n' || e.key === 'N') pick('no');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  const current = answers[i];

  return (
    <motion.div key="quiz" {...fade} className="mx-auto max-w-2xl pt-2">
      <div className="mb-2 flex items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-accent">
            {es ? 'Etapa' : 'Stage'} {q.section.n} {es ? 'de' : 'of'} {SECTIONS.length}
          </p>
          <h2 className="text-lg font-black text-primary md:text-xl">{q.section.full}</h2>
        </div>
        <span className="flex-none rounded-full border border-gray-200 bg-secondary/60 px-3 py-1 text-xs font-bold tabular-nums text-primary">
          {i + 1} / {TOTAL_QUESTIONS}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
        <motion.div className="h-full rounded-full bg-accent" animate={{ width: `${progress}%` }} transition={{ duration: 0.4 }} />
      </div>

      <div className="relative mt-6 min-h-[300px]">
        <AnimatePresence mode="wait" initial={false} custom={dir}>
          <motion.div
            key={i}
            initial={{ opacity: 0, x: 24 * dir }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 * dir }}
            transition={{ duration: 0.22 }}
            data-question={i}
            className="rounded-3xl border border-gray-100 bg-white p-6 app-shadow md:p-8"
          >
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{q.section.title}</p>
            <h3 className="mt-2 text-xl font-bold leading-snug text-primary md:text-2xl">{q.t}</h3>

            {q.type === 'input' ? (
              <div className="mt-6">
                <input
                  type="text"
                  autoFocus
                  placeholder={q.placeholder}
                  value={typeof current === 'string' ? current : ''}
                  onChange={(e) => onAnswer(i, e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && proceed()}
                  className={inputClass}
                  maxLength={300}
                />
                {q.hint && <p className="mt-2 text-xs text-muted-foreground">{q.hint}</p>}
                <button
                  type="button"
                  onClick={proceed}
                  className="tap-scale mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-6 py-3.5 font-bold text-white hover:bg-orange-600"
                >
                  {last ? (es ? 'Ver mi resultado' : 'See my result') : es ? 'Continuar' : 'Continue'}
                  <ArrowRight size={18} />
                </button>
              </div>
            ) : (
              <div className="mt-6 grid grid-cols-2 gap-3">
                {(['si', 'no'] as const).map((v) => {
                  const active = current === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      aria-pressed={active}
                      onClick={() => pick(v)}
                      className={`tap-scale flex items-center justify-center gap-2 rounded-2xl border-2 px-4 py-5 text-lg font-black transition-colors ${
                        active
                          ? v === 'si'
                            ? 'border-green-500 bg-green-50 text-green-700'
                            : 'border-red-400 bg-red-50 text-red-600'
                          : 'border-gray-200 bg-white text-primary hover:border-accent hover:bg-orange-50/40'
                      }`}
                    >
                      {v === 'si' ? <Check size={20} /> : <X size={20} />}
                      {v === 'si' ? 'Sí' : 'No'}
                    </button>
                  );
                })}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <button
          type="button"
          onClick={() => (i === 0 ? onBackToIntro() : go(i - 1))}
          className="tap-scale-sm inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-muted-foreground hover:text-primary"
        >
          <ChevronLeft size={16} />
          {es ? 'Anterior' : 'Back'}
        </button>
        <p className="hidden text-xs text-muted-foreground sm:block">{es ? 'Atajos: S = sí · N = no' : 'Shortcuts: Y = yes · N = no'}</p>
      </div>
    </motion.div>
  );
}


// ---------------------------------------------------------------------
// El estado del diagnóstico: respuestas, resultado y pago
// ---------------------------------------------------------------------

/**
 * Todo lo que el diagnóstico guarda y hace, para usarlo dentro de otra
 * página. `ruta` es la dirección a la que vuelve la persona después de
 * pagar (Wompi agrega ?id=<transacción>) y la que queda en la barra.
 */
export function useDiagnostico({ ruta = '/ruta', alCompletar }: { ruta?: string; alCompletar?: (answers: Answer[]) => void } = {}) {
  const { getAccessToken } = useAuth();
  const { language } = useLanguage();
  const es = language === 'es';

  const stored = useMemo<Stored>(() => loadStored(), []);
  const urlParams = useMemo(() => new URLSearchParams(typeof window !== 'undefined' ? window.location.search : ''), []);
  const urlRef = urlParams.get('ref');
  const urlTx = urlParams.get('id'); // Wompi agrega ?id=<transacción> a la vuelta

  const [lead, setLead] = useState<Lead>(stored?.lead ?? EMPTY_LEAD);
  const [answers, setAnswers] = useState<(Answer | string)[]>(stored?.answers ?? FLAT.map(() => null));
  const soloSiNo = (arr: (Answer | string)[]) =>
    FLAT.map((q) => (q.type === 'input' ? null : arr[q.index] === 'si' || arr[q.index] === 'no' ? (arr[q.index] as Answer) : null));
  // Un cuestionario terminado vuelve como resultado aunque no tenga
  // referencia del servidor: la parte gratis nunca lo necesitó.
  const [step, setStep] = useState<Step>(() =>
    urlRef || stored?.ref || (stored && isComplete(soloSiNo(stored.answers))) ? 'result' : 'intro'
  );
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [config, setConfig] = useState<DiagnosticConfig | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [paying, setPaying] = useState<EstadoPago>('idle');
  const [payError, setPayError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  const scored: Answer[] = useMemo(() => soloSiNo(answers), [answers]);

  useEffect(() => {
    getConfig()
      .then(setConfig)
      .catch(() => setConfig({ enabled: false, publicKey: null, env: 'sandbox', price: { CO: { amountInCents: 3990000, currency: 'COP', display: '$39.900 COP', note: '' }, INTL: { amountInCents: 3990000, currency: 'COP', display: 'USD 9.99', note: '' } } }));
  }, []);

  // Lo que va respondiendo queda guardado para una recarga o el viaje al pago.
  useEffect(() => {
    if (step === 'intro' && !stored) return;
    saveStored({ ref: result?.ref ?? stored?.ref ?? null, lead, answers, at: Date.now() });
  }, [lead, answers, result?.ref, step, stored]);

  const startPolling = useCallback((ref: string) => {
    let attempts = 0;
    setPaying('confirming');
    const tick = async () => {
      attempts += 1;
      try {
        const r = await confirmDiagnostic(ref, null);
        if (r.paid) {
          setResult(r);
          setPaying('idle');
          return;
        }
      } catch {
        /* se sigue intentando */
      }
      if (attempts >= 10) {
        setPaying('pending');
        return;
      }
      pollRef.current = window.setTimeout(tick, 3000);
    };
    void tick();
  }, []);

  // Volver con una referencia (guardada o desde el pago): se rearma el
  // resultado desde el servidor y, si Wompi mandó una transacción, se confirma.
  useEffect(() => {
    const ref = urlRef || stored?.ref;
    if (!ref || step !== 'result' || result) return;
    let cancelled = false;
    (async () => {
      try {
        const r = urlTx ? await confirmDiagnostic(ref, urlTx) : await getDiagnostic(ref);
        if (cancelled) return;
        setResult(r);
        setAnswers((prev) => (scored.some((a) => a !== null) ? prev : r.answers));
        setLead((prev) => ({ ...prev, pais: r.pais, empresa: prev.empresa || r.empresa || '' }));
        if (!scored.some((a) => a !== null)) alCompletar?.(r.answers);
        if (urlTx && !r.paid) startPolling(ref);
        if (urlTx || urlRef) window.history.replaceState({}, '', `${ruta}?ref=${ref}`);
      } catch {
        if (cancelled) return;
        // Referencia vieja o desconocida: mejor empezar de nuevo que una página en blanco.
        if (!isComplete(scored)) {
          saveStored(null);
          setStep('intro');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => { if (pollRef.current) clearTimeout(pollRef.current); }, []);

  const setAnswer = (i: number, v: Answer | string) => setAnswers((prev) => prev.map((a, n) => (n === i ? v : a)));

  const finish = async () => {
    if (!isComplete(scored)) return;
    setSubmitting(true);
    setStep('result');
    alCompletar?.(scored);
    trackLead({ source: 'diagnostico' });
    try {
      const created = await createDiagnostic(lead, answers, getAccessToken());
      const full = await getDiagnostic(created.ref);
      setResult(full);
      window.history.replaceState({}, '', `${ruta}?ref=${created.ref}`);
    } catch {
      // El resultado gratis se ve igual; sólo pagar necesita el servidor.
      setResult(null);
    } finally {
      setSubmitting(false);
    }
  };

  const pay = async () => {
    if (!result?.ref) return;
    setPayError(null);
    setPaying('opening');
    trackInitiateCheckout({ plan: 'diagnostico_madurez', gateway: 'wompi' });
    try {
      const init = await wompiInit(result.ref);
      const redirectUrl = `${window.location.origin}${ruta}?ref=${result.ref}`;
      if (isNative) {
        // La página de pago en el navegador del sistema; la app recoge el
        // resultado a la vuelta con ?ref=&id=.
        await openExternal(wompiRedirectUrl(init, redirectUrl));
        setPaying('idle');
        return;
      }
      const WidgetCheckout = await loadWompiWidget();
      const checkout = new WidgetCheckout({
        currency: init.currency,
        amountInCents: init.amountInCents,
        reference: init.reference,
        publicKey: init.publicKey,
        signature: { integrity: init.signature },
        redirectUrl,
        customerData: {
          email: init.customer.email ?? undefined,
          fullName: init.customer.fullName ?? undefined,
          phoneNumber: init.customer.phone || undefined,
          phoneNumberPrefix: init.customer.phone ? '+57' : undefined,
        },
      });
      checkout.open((res) => {
        const tx = res.transaction;
        if (tx && tx.status === 'APPROVED') {
          // Nunca se desbloquea acá: se le pregunta al servidor, que le pregunta a Wompi.
          setPaying('confirming');
          confirmDiagnostic(result.ref, tx.id)
            .then((r) => {
              if (r.paid) {
                setResult(r);
                setPaying('idle');
              } else startPolling(result.ref);
            })
            .catch(() => startPolling(result.ref));
        } else {
          setPaying('idle');
        }
      });
    } catch (err) {
      const code = (err as { status?: number }).status;
      setPaying('idle');
      setPayError(
        code === 503
          ? es ? 'Los pagos aún no están configurados.' : 'Payments are not configured yet.'
          : es ? 'No pudimos abrir la pasarela. Intenta de nuevo o escríbenos por WhatsApp.' : 'We could not open the checkout. Try again or message us on WhatsApp.'
      );
    }
  };

  const restart = () => {
    if (pollRef.current) clearTimeout(pollRef.current);
    saveStored(null);
    setResult(null);
    setAnswers(FLAT.map(() => null));
    setPaying('idle');
    setPayError(null);
    window.history.replaceState({}, '', ruta);
    setStep('intro');
  };

  const score = result?.score ?? scorePct(scored);
  const tier = tierFor(score);
  const gaps = gapsIn(scored);
  /** La acción recomendada de cada pregunta, cuando ya se pagó. */
  const acciones = useMemo(() => new Map((result?.paid ? result.actions ?? [] : []).map((a) => [a.index, a.action])), [result]);
  const price = result?.price ?? (config ? (lead.pais === 'CO' ? config.price.CO : config.price.INTL) : null);

  return {
    step, setStep, lead, setLead, answers, setAnswer, scored, result, config, submitting, paying, payError,
    finish, pay, restart, score, tier, gaps, acciones, price,
    paid: Boolean(result?.paid),
    canPay: Boolean(config?.enabled && result?.ref),
  };
}

export type Diagnostico = ReturnType<typeof useDiagnostico>;

/** El mensaje de WhatsApp, con el puntaje para que el asesor no pregunte. */
export function whatsappDiagnostico(d: Diagnostico, texto: string) {
  const emp = d.lead.empresa ? ` (${d.lead.empresa})` : '';
  return whatsappUrl(`Hola Easycomex${emp}. Hice el diagnóstico de mi ruta exportadora (${d.score}%, ${d.tier.name}) y ${texto}`);
}

// ---------------------------------------------------------------------
// El resultado, en corto, arriba de la ruta
// ---------------------------------------------------------------------

export function ResumenResultado({ d, es, onVerRuta }: { d: Diagnostico; es: boolean; onVerRuta: () => void }) {
  const perSection = SECTIONS.map((s) => {
    const total = s.q.filter((x) => x.type !== 'input').length;
    const yes = FLAT.filter((f) => f.section.n === s.n && f.type !== 'input' && d.scored[f.index] === 'si').length;
    return { ...s, yes, total };
  });
  const cubiertos = SCORED_QUESTIONS - d.gaps.length;
  return (
    <motion.section key="resultado" {...fade} className="grid items-center gap-6 rounded-3xl border border-gray-100 bg-white p-6 app-shadow md:grid-cols-[auto_1fr] md:gap-8 md:p-8">
      <ScoreRing value={d.score} colorClass={d.tier.ringClass} chico />
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-block rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider ${d.tier.badgeClass}`}>{d.tier.badge}</span>
          <span className="text-xs font-bold text-muted-foreground">
            {cubiertos} {es ? 'cubiertos' : 'covered'} · {d.gaps.length} {es ? (d.gaps.length === 1 ? 'brecha' : 'brechas') : d.gaps.length === 1 ? 'gap' : 'gaps'}
          </span>
        </div>
        <h2 className="mt-2 text-2xl font-black text-primary md:text-3xl">{d.tier.name}</h2>
        <p className="mt-1.5 max-w-xl text-sm text-muted-foreground md:text-base">{d.tier.body}</p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {perSection.map((s) => (
            <div key={s.n} className="rounded-2xl border border-gray-100 bg-secondary/40 p-2.5">
              <p className="truncate text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{s.title}</p>
              <p className="mt-0.5 text-sm font-black text-primary">{s.yes}/{s.total}</p>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-200">
                <div className={`h-full rounded-full ${s.yes === s.total ? 'bg-green-500' : s.yes === 0 ? 'bg-red-400' : 'bg-accent'}`} style={{ width: `${(s.yes / s.total) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button type="button" onClick={onVerRuta} className="tap-scale inline-flex cursor-pointer items-center gap-2 rounded-full border-0 bg-primary px-5 py-2.5 text-sm font-bold text-white">
            {es ? 'Ver mi ruta paso a paso' : 'See my step-by-step roadmap'} <ArrowRight size={14} />
          </button>
          <button type="button" onClick={d.restart} className="tap-scale-sm inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-primary hover:border-accent">
            <RotateCcw size={14} /> {es ? 'Repetir diagnóstico' : 'Retake the diagnosis'}
          </button>
        </div>
        {d.submitting && (
          <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 size={12} className="animate-spin" /> {es ? 'Guardando tu diagnóstico…' : 'Saving your diagnosis…'}
          </p>
        )}
      </div>
    </motion.section>
  );
}

// ---------------------------------------------------------------------
// El plan de acción: lo que se paga
// ---------------------------------------------------------------------

export function PlanDeAccion({ d, es, onVerRuta }: { d: Diagnostico; es: boolean; onVerRuta: () => void }) {
  if (d.gaps.length === 0) {
    return (
      <div className="rounded-3xl border border-green-100 bg-green-50 p-6">
        <Tag tone="ok">{es ? 'Sin brechas' : 'No gaps'}</Tag>
        <p className="mt-3 font-bold text-primary">
          {es
            ? 'No detectamos brechas en tu diagnóstico. Sigue los pasos que te quedan en la ruta y empieza a escalar.'
            : 'Your diagnosis found no gaps. Follow the remaining steps of the roadmap and start scaling.'}
        </p>
      </div>
    );
  }
  if (d.paid) {
    return (
      <div className="flex flex-col items-start justify-between gap-4 rounded-3xl border border-green-100 bg-green-50 p-6 sm:flex-row sm:items-center">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 flex-none place-items-center rounded-2xl bg-green-600 text-white"><Check size={20} /></span>
          <div>
            <p className="font-black text-primary">{es ? 'Tu plan de acción está desbloqueado' : 'Your action plan is unlocked'}</p>
            <p className="text-sm text-muted-foreground">
              {es
                ? `Las ${d.gaps.length} acciones recomendadas están dentro de cada paso de tu ruta, junto a la tarea que resuelven. También te las enviamos a ${d.lead.correo || 'tu correo'}.`
                : `Your ${d.gaps.length} recommended actions are inside each step of your roadmap, next to the task they solve. We also emailed them to ${d.lead.correo || 'you'}.`}
            </p>
          </div>
        </div>
        <button type="button" onClick={onVerRuta} className="tap-scale inline-flex flex-none cursor-pointer items-center gap-2 rounded-full border-0 bg-primary px-5 py-2.5 text-sm font-bold text-white">
          {es ? 'Ir a mi ruta' : 'Go to my roadmap'} <ArrowRight size={14} />
        </button>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#130B2E] via-primary to-[#1F2E73] p-6 text-white md:p-8">
      <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-orange-300">
            <Lock size={12} /> {es ? 'Plan de acción' : 'Action plan'}
          </span>
          <h3 className="mt-3 text-2xl font-black md:text-3xl">
            {es ? `Qué hacer con tus ${d.gaps.length} ${d.gaps.length === 1 ? 'brecha' : 'brechas'}` : `What to do about your ${d.gaps.length} ${d.gaps.length === 1 ? 'gap' : 'gaps'}`}
          </h3>
          <p className="mt-2 max-w-xl text-sm text-indigo-100">
            {es
              ? 'Ya viste gratis tu nivel y por qué importa cada punto. El plan pone, dentro de cada paso de tu ruta, la acción concreta para cerrar cada brecha: qué hacer, en qué orden y con qué herramienta.'
              : 'You have seen your level and why each point matters for free. The plan puts, inside each step of your roadmap, the concrete action to close each gap: what to do, in what order and with which tool.'}
          </p>
          <ul className="mt-4 grid gap-1.5 text-sm text-indigo-100 sm:grid-cols-2">
            {[
              es ? `${d.gaps.length} acciones para tu caso` : `${d.gaps.length} actions for your case`,
              es ? 'Dentro de tu ruta, paso a paso' : 'Inside your roadmap, step by step',
              es ? 'Te llega también por correo' : 'Also sent to your email',
              es ? 'Pago único, sin suscripción' : 'One-time payment, no subscription',
            ].map((x) => (
              <li key={x} className="flex items-center gap-2"><Check size={14} className="text-orange-300" /> {x}</li>
            ))}
          </ul>
        </div>
        <div className="w-full rounded-2xl bg-white p-5 text-center text-primary md:w-72">
          {d.price && (
            <p className="text-3xl font-black">
              {d.price.display}
              <span className="block text-xs font-semibold text-muted-foreground">{es ? 'pago único' : 'one-time'}</span>
            </p>
          )}
          <button
            type="button"
            disabled={!d.canPay || d.paying !== 'idle'}
            onClick={() => void d.pay()}
            className="tap-scale mt-4 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border-0 bg-accent px-5 py-3.5 font-bold text-white shadow-lg shadow-orange-500/25 hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {d.paying === 'opening' ? (
              <><Loader2 size={18} className="animate-spin" /> {es ? 'Abriendo pago…' : 'Opening payment…'}</>
            ) : d.paying === 'confirming' ? (
              <><Loader2 size={18} className="animate-spin" /> {es ? 'Confirmando tu pago…' : 'Confirming your payment…'}</>
            ) : (
              <>{es ? 'Desbloquear mi plan' : 'Unlock my plan'}</>
            )}
          </button>
          {d.price?.note && <p className="mt-2 text-xs text-muted-foreground">{d.price.note}</p>}
          {d.paying === 'pending' && (
            <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-700">
              {es
                ? `Tu pago está en proceso. Apenas se confirme, las acciones aparecen en tu ruta y te las enviamos a ${d.lead.correo}.`
                : `Your payment is processing. As soon as it confirms, the actions appear in your roadmap and we email them to ${d.lead.correo}.`}
            </p>
          )}
          {d.payError && <p className="mt-3 text-xs font-semibold text-red-600">{d.payError}</p>}
          {!d.canPay && d.config && (
            <p className="mt-3 text-xs text-muted-foreground">
              {!d.config.enabled
                ? es ? 'Los pagos aún no están activos. ' : 'Payments are not active yet. '
                : !d.result?.ref
                  ? es ? 'No pudimos guardar tu diagnóstico para cobrarlo. ' : 'We could not save your diagnosis to charge it. '
                  : ''}
              <a
                href={whatsappDiagnostico(d, 'quiero recibir mi plan de acción.')}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => {
                  if (!isNative) return;
                  e.preventDefault();
                  void openExternal((e.currentTarget as HTMLAnchorElement).href);
                }}
                className="font-bold text-accent underline"
              >
                {es ? 'Pídelo por WhatsApp' : 'Ask for it on WhatsApp'}
              </a>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Si prefiere que lo hagamos con él
// ---------------------------------------------------------------------

export function Servicios({ d, es }: { d: Diagnostico | null; es: boolean }) {
  const wa = (texto: string) => (d ? whatsappDiagnostico(d, texto) : whatsappUrl(`Hola Easycomex, ${texto}`));
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {OFFERS.map((o) => (
        <div
          key={o.t}
          className={`relative flex flex-col rounded-3xl border p-5 ${
            o.feat ? 'border-accent bg-primary text-white app-shadow' : o.free ? 'border-green-200 bg-green-50/50' : 'border-gray-100 bg-white'
          }`}
        >
          {(o.feat || o.free) && (
            <span className={`absolute -top-2.5 left-4 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${o.feat ? 'bg-accent text-white' : 'bg-green-600 text-white'}`}>
              {o.feat ? (es ? 'Más solicitado' : 'Most requested') : es ? 'Sin costo' : 'Free'}
            </span>
          )}
          <h4 className={`text-base font-black ${o.feat ? 'text-white' : 'text-primary'}`}>{o.t}</h4>
          <p className={`mt-1.5 flex-1 text-sm ${o.feat ? 'text-white/75' : 'text-muted-foreground'}`}>{o.d}</p>
          <div className="mt-4 flex items-end justify-between">
            <span className={`text-xl font-black ${o.feat ? 'text-white' : 'text-primary'}`}>
              {o.free ? (es ? 'Gratis' : 'Free') : <><span className="text-xs font-bold text-muted-foreground">USD </span>{o.p.toLocaleString('es-CO')}</>}
            </span>
            <span className={`text-[11px] font-bold ${o.feat ? 'text-white/60' : 'text-muted-foreground'}`}>{o.eta}</span>
          </div>
          <a
            href={wa(o.free ? 'quiero agendar la llamada de 30 minutos.' : `me interesa: ${o.t} (USD ${o.p}).`)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => {
              if (!isNative) return;
              e.preventDefault();
              void openExternal((e.currentTarget as HTMLAnchorElement).href);
            }}
            className={`tap-scale mt-4 inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold ${
              o.feat ? 'bg-accent text-white hover:bg-orange-600' : 'bg-primary text-white hover:bg-primary/90'
            }`}
          >
            <MessageCircle size={16} />
            {o.free ? (es ? 'Agendar llamada' : 'Book the call') : es ? 'Quiero este servicio' : 'I want this'}
          </a>
        </div>
      ))}
    </div>
  );
}
