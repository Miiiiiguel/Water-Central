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

// Diagnóstico de madurez — three screens: who you are, seventeen
// questions one at a time, then the result. The free part (score, level,
// a comment per answer) is computed right here; the paid part (what to
// do about each gap) only ever arrives from the server after Wompi
// confirms the payment. The content is the team's, in Spanish, verbatim.

type Step = 'intro' | 'quiz' | 'result';
type Stored = ReturnType<typeof loadStored>;

const EMPTY_LEAD: Lead = { empresa: '', nombre: '', celular: '', correo: '', pais: 'CO' };

const inputClass =
  'w-full rounded-2xl border border-gray-200 bg-white px-4 py-3 text-primary outline-none transition-all placeholder:text-gray-400 focus:border-accent focus:ring-2 focus:ring-accent/20';

const fade = {
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
function RichText({ html }: { html: string }) {
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

function ScoreRing({ value, colorClass }: { value: number; colorClass: string }) {
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
    <div className="relative mx-auto h-52 w-52">
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
        <span className="text-5xl font-black tabular-nums text-primary">{shown}%</span>
        <span className="mt-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">nivel de madurez</span>
      </div>
    </div>
  );
}

function Tag({ children, tone }: { children: ReactNode; tone: 'ok' | 'gap' | 'act' | 'neutral' }) {
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

function IntroScreen({ lead, onChange, onStart, es }: { lead: Lead; onChange: (l: Lead) => void; onStart: () => void; es: boolean }) {
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
      <section className="pb-4 pt-8 md:pt-12">
        <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-orange-500/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-accent">
          <Sparkles size={13} />
          {es ? 'Diagnóstico gratuito · 3 minutos' : 'Free diagnosis · 3 minutes'}
        </span>
        <h1 className="max-w-[18ch] text-3xl font-black leading-[1.08] text-primary sm:text-4xl md:text-5xl">
          {es ? (
            <>¿Qué tan preparada está tu marca para vender en <span className="text-accent">Estados Unidos</span>?</>
          ) : (
            <>How ready is your brand to sell in the <span className="text-accent">United States</span>?</>
          )}
        </h1>
        <p className="mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">
          {es
            ? '17 preguntas sobre tu marca, tu logística y tu marketing. Al final: tu nivel de madurez y un comentario por cada punto, sin costo y sin llamada de ventas.'
            : '17 questions about your brand, logistics and marketing. At the end: your maturity level and a comment on every point, free and with no sales call.'}
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
          <input type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} className="hidden" aria-hidden="true" />
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
    </motion.div>
  );
}

// ---------------------------------------------------------------------
// Screen 2 — one question at a time
// ---------------------------------------------------------------------

function QuizScreen({
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
      if (e.key === 's' || e.key === 'S' || e.key === 'y' || e.key === 'Y') pick('si');
      if (e.key === 'n' || e.key === 'N') pick('no');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  const current = answers[i];

  return (
    <motion.div key="quiz" {...fade} className="mx-auto max-w-2xl pt-6 md:pt-10">
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
// Screen 3 — the result
// ---------------------------------------------------------------------

function ResultScreen({
  answers, lead, result, config, paying, payError, onPay, onRestart, es,
}: {
  answers: Answer[];
  lead: Lead;
  result: DiagnosticResult | null;
  config: DiagnosticConfig | null;
  paying: 'idle' | 'opening' | 'confirming' | 'pending';
  payError: string | null;
  onPay: () => void;
  onRestart: () => void;
  es: boolean;
}) {
  const score = result?.score ?? scorePct(answers);
  const tier = tierFor(score);
  const gaps = gapsIn(answers);
  const paid = Boolean(result?.paid);
  const price = result?.price ?? (config ? (lead.pais === 'CO' ? config.price.CO : config.price.INTL) : null);
  const canPay = Boolean(config?.enabled && result?.ref);

  const perSection = SECTIONS.map((s) => {
    const scored = s.q.filter((x) => x.type !== 'input');
    const yes = FLAT.filter((f) => f.section.n === s.n && f.type !== 'input' && answers[f.index] === 'si').length;
    return { ...s, yes, total: scored.length };
  });

  const wa = (text: string) => {
    const emp = lead.empresa ? ` (${lead.empresa})` : '';
    return whatsappUrl(`Hola Easycomex${emp}. Hice el diagnóstico de madurez (${score}%, ${tier.name}) y ${text}`);
  };

  return (
    <motion.div key="result" {...fade} className="pt-6 md:pt-10">
      {/* Score */}
      <section className="grid items-center gap-8 rounded-3xl border border-gray-100 bg-white p-6 app-shadow md:grid-cols-[auto_1fr] md:p-10">
        <ScoreRing value={score} colorClass={tier.ringClass} />
        <div>
          <span className={`inline-block rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider ${tier.badgeClass}`}>{tier.badge}</span>
          <h1 className="mt-3 text-3xl font-black text-primary md:text-4xl">{tier.name}</h1>
          <p className="mt-2 max-w-xl text-muted-foreground">{tier.body}</p>
          <div className="mt-5 grid gap-2 sm:grid-cols-5">
            {perSection.map((s) => (
              <div key={s.n} className="rounded-2xl border border-gray-100 bg-secondary/40 p-3">
                <p className="truncate text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{s.title}</p>
                <p className="mt-1 text-sm font-black text-primary">
                  {s.yes}/{s.total}
                </p>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-200">
                  <div className={`h-full rounded-full ${s.yes === s.total ? 'bg-green-500' : s.yes === 0 ? 'bg-red-400' : 'bg-accent'}`} style={{ width: `${(s.yes / s.total) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Free comments */}
      <section className="mt-10">
        <p className="text-xs font-bold uppercase tracking-wider text-accent">{es ? 'Sin costo' : 'Free'}</p>
        <h2 className="mt-2 text-2xl font-black text-primary md:text-3xl">{es ? 'Comentarios punto por punto' : 'Point-by-point comments'}</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          {es
            ? `${SCORED_QUESTIONS - gaps.length} puntos cubiertos, ${gaps.length} ${gaps.length === 1 ? 'brecha' : 'brechas'}. Esto es lo que significa cada respuesta.`
            : `${SCORED_QUESTIONS - gaps.length} points covered, ${gaps.length} ${gaps.length === 1 ? 'gap' : 'gaps'}. Here is what each answer means.`}
        </p>
        <div className="mt-6 grid gap-3">
          {FLAT.filter((q) => q.type !== 'input').map((q) => {
            const yes = answers[q.index] === 'si';
            return (
              <div key={q.index} className={`rounded-2xl border p-4 md:p-5 ${yes ? 'border-green-100 bg-white' : 'border-red-100 bg-red-50/30'}`}>
                <div className="flex items-start gap-3">
                  <Tag tone={yes ? 'ok' : 'gap'}>{yes ? 'Cumple' : 'Brecha'}</Tag>
                  <p className="font-bold text-primary">{q.t}</p>
                </div>
                <p className="mt-2 pl-0 text-sm text-muted-foreground md:pl-[4.5rem]">{yes ? q.comSi : q.comNo}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Actions — paid */}
      <section className="mt-10">
        <p className="text-xs font-bold uppercase tracking-wider text-accent">{es ? 'Plan de acción' : 'Action plan'}</p>
        <h2 className="mt-2 text-2xl font-black text-primary md:text-3xl">{es ? 'Qué hacer con cada brecha' : 'What to do about each gap'}</h2>

        {gaps.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-green-100 bg-green-50 p-6">
            <Tag tone="ok">{es ? 'Sin brechas' : 'No gaps'}</Tag>
            <p className="mt-3 font-bold text-primary">
              {es
                ? 'No detectamos brechas: tienes todos los puntos cubiertos. Tu siguiente paso es ejecutar con estrategia.'
                : 'We found no gaps: every point is covered. Your next step is to execute with strategy.'}
            </p>
          </div>
        ) : paid && result?.actions ? (
          <div className="mt-6 grid gap-3">
            <div className="flex items-center gap-2 rounded-2xl border border-green-100 bg-green-50 px-4 py-3 text-sm font-bold text-green-700">
              <Check size={16} />
              {es ? 'Acciones desbloqueadas. Este es tu plan de acción personalizado.' : 'Actions unlocked. This is your personalised action plan.'}
            </div>
            {result.actions.map((a, n) => (
              <div key={a.index} className="rounded-2xl border border-orange-100 bg-white p-5 app-shadow">
                <div className="flex items-start gap-3">
                  <span className="grid h-8 w-8 flex-none place-items-center rounded-xl bg-accent text-sm font-black text-white">{n + 1}</span>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{a.section}</p>
                    <p className="font-bold text-primary">{a.question}</p>
                  </div>
                </div>
                <div className="mt-3 rounded-xl bg-orange-50/60 p-4 text-sm leading-relaxed text-primary md:ml-11">
                  <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-accent">{es ? 'Acción recomendada' : 'Recommended action'}</span>
                  <RichText html={a.action} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="relative mt-6 overflow-hidden rounded-3xl border border-gray-100 bg-white">
            {/* A believable preview underneath — placeholder lines, not the real text. */}
            <div aria-hidden="true" className="select-none space-y-3 p-6 blur-[6px]">
              {gaps.slice(0, 3).map((g) => (
                <div key={g.index} className="rounded-2xl border border-orange-100 p-4">
                  <div className="h-3 w-2/3 rounded bg-gray-200" />
                  <div className="mt-3 h-2.5 w-full rounded bg-gray-100" />
                  <div className="mt-1.5 h-2.5 w-11/12 rounded bg-gray-100" />
                  <div className="mt-1.5 h-2.5 w-4/5 rounded bg-gray-100" />
                </div>
              ))}
            </div>
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-white/70 via-white/90 to-white p-6">
              <div className="w-full max-w-md text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary text-white">
                  <Lock size={22} />
                </div>
                <h3 className="mt-4 text-xl font-black text-primary md:text-2xl">{es ? 'Desbloquea tus acciones recomendadas' : 'Unlock your recommended actions'}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {es
                    ? 'Ya viste tus comentarios gratis. Detrás de este paso está tu plan: qué hacer, en qué orden y con qué herramientas para cada brecha.'
                    : 'You have seen your comments for free. Behind this step is your plan: what to do, in what order and with which tools, for each gap.'}
                </p>
                <p className="mt-3 inline-block rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-accent">
                  {gaps.length} {es ? (gaps.length === 1 ? 'acción específica para tu caso' : 'acciones específicas para tu caso') : gaps.length === 1 ? 'specific action for your case' : 'specific actions for your case'}
                </p>
                {price && (
                  <p className="mt-4 text-3xl font-black text-primary">
                    {price.display} <span className="text-sm font-semibold text-muted-foreground">/ {es ? 'pago único' : 'one-time'}</span>
                  </p>
                )}
                <button
                  type="button"
                  disabled={!canPay || paying !== 'idle'}
                  onClick={onPay}
                  className="tap-scale mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-accent px-6 py-4 font-bold text-white shadow-lg shadow-orange-500/25 hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {paying === 'opening' ? (
                    <><Loader2 size={18} className="animate-spin" /> {es ? 'Abriendo pago…' : 'Opening payment…'}</>
                  ) : paying === 'confirming' ? (
                    <><Loader2 size={18} className="animate-spin" /> {es ? 'Confirmando tu pago…' : 'Confirming your payment…'}</>
                  ) : (
                    <>{es ? 'Ver mis acciones' : 'See my actions'}{price ? ` · ${price.display}` : ''}</>
                  )}
                </button>
                {price && <p className="mt-2 text-xs text-muted-foreground">{price.note}</p>}
                {paying === 'pending' && (
                  <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-700">
                    {es
                      ? `Tu pago está en proceso. Apenas se confirme, las acciones aparecen aquí y te las enviamos a ${lead.correo}.`
                      : `Your payment is processing. As soon as it confirms, the actions appear here and we email them to ${lead.correo}.`}
                  </p>
                )}
                {payError && <p className="mt-3 text-xs font-semibold text-red-600">{payError}</p>}
                {!canPay && config && !config.enabled && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    {es ? 'Los pagos aún no están activos en este entorno. ' : 'Payments are not active in this environment yet. '}
                    <a href={wa('quiero recibir mis acciones recomendadas.')} target="_blank" rel="noopener noreferrer" className="font-bold text-accent underline">
                      {es ? 'Pídelas por WhatsApp' : 'Ask for them on WhatsApp'}
                    </a>
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Offers */}
      <section className="mt-12">
        <p className="text-xs font-bold uppercase tracking-wider text-accent">{es ? 'Siguiente paso' : 'Next step'}</p>
        <h2 className="mt-2 text-2xl font-black text-primary md:text-3xl">{es ? '¿Quieres que lo hagamos contigo?' : 'Want us to do it with you?'}</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
      </section>

      <div className="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-6 text-sm text-muted-foreground">
        <span>
          {result?.ref ? (es ? 'Referencia: ' : 'Reference: ') : ''}
          <code className="text-xs">{result?.ref ?? ''}</code>
        </span>
        <button type="button" onClick={onRestart} className="tap-scale-sm inline-flex items-center gap-1.5 font-semibold text-primary hover:text-accent">
          <RotateCcw size={14} />
          {es ? 'Hacer el diagnóstico de nuevo' : 'Take the diagnosis again'}
        </button>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------

export default function Diagnostico() {
  const { language } = useLanguage();
  const { getAccessToken } = useAuth();
  const es = language === 'es';

  const stored = useMemo<Stored>(() => loadStored(), []);
  const urlParams = useMemo(() => new URLSearchParams(typeof window !== 'undefined' ? window.location.search : ''), []);
  const urlRef = urlParams.get('ref');
  const urlTx = urlParams.get('id'); // Wompi appends ?id=<transaction> on the way back

  const [lead, setLead] = useState<Lead>(stored?.lead ?? EMPTY_LEAD);
  const [answers, setAnswers] = useState<(Answer | string)[]>(stored?.answers ?? FLAT.map(() => null));
  // A finished questionnaire comes back as the result even without a
  // server reference: the free part never needed the server.
  const [step, setStep] = useState<Step>(() =>
    urlRef || stored?.ref || (stored && isComplete(FLAT.map((q) => (q.type === 'input' ? null : stored.answers[q.index] === 'si' || stored.answers[q.index] === 'no' ? (stored.answers[q.index] as Answer) : null))))
      ? 'result'
      : 'intro'
  );
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [config, setConfig] = useState<DiagnosticConfig | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [paying, setPaying] = useState<'idle' | 'opening' | 'confirming' | 'pending'>('idle');
  const [payError, setPayError] = useState<string | null>(null);
  const pollRef = useRef<number | null>(null);

  const scored: Answer[] = useMemo(() => FLAT.map((q) => (q.type === 'input' ? null : answers[q.index] === 'si' || answers[q.index] === 'no' ? (answers[q.index] as Answer) : null)), [answers]);

  useEffect(() => {
    document.title = es ? 'Diagnóstico de madurez · Easycomex' : 'Maturity diagnosis · Easycomex';
    getConfig().then(setConfig).catch(() => setConfig({ enabled: false, publicKey: null, env: 'sandbox', price: { CO: { amountInCents: 3990000, currency: 'COP', display: '$39.900 COP', note: '' }, INTL: { amountInCents: 3990000, currency: 'COP', display: 'USD 9.99', note: '' } } }));
  }, [es]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [step]);

  // Keep the in-progress diagnosis around for a reload or a checkout trip.
  useEffect(() => {
    if (step === 'intro' && !stored) return;
    saveStored({ ref: result?.ref ?? stored?.ref ?? null, lead, answers, at: Date.now() });
  }, [lead, answers, result?.ref, step, stored]);

  // Coming back with a reference (from storage or the checkout redirect):
  // rebuild the result from the server, and confirm the transaction if
  // Wompi sent us one.
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
        if (urlTx && !r.paid) startPolling(ref);
        if (urlTx) window.history.replaceState({}, '', `/diagnostico?ref=${ref}`);
      } catch {
        if (cancelled) return;
        // Stale or unknown reference: start fresh rather than show a blank page.
        saveStored(null);
        setStep('intro');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        /* keep trying */
      }
      if (attempts >= 10) {
        setPaying('pending');
        return;
      }
      pollRef.current = window.setTimeout(tick, 3000);
    };
    void tick();
  }, []);

  useEffect(() => () => { if (pollRef.current) clearTimeout(pollRef.current); }, []);

  const finish = async () => {
    if (!isComplete(scored)) return;
    setSubmitting(true);
    setStep('result');
    trackLead({ source: 'diagnostico' });
    try {
      const created = await createDiagnostic(lead, answers, getAccessToken());
      const full = await getDiagnostic(created.ref);
      setResult(full);
    } catch {
      // The free result still shows; only paying needs the server.
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
      const redirectUrl = `${window.location.origin}/diagnostico?ref=${result.ref}`;
      if (isNative) {
        // The hosted page in the system browser; the app picks the
        // result up on return via ?ref=&id=.
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
          // Never unlock here: ask the server, which asks Wompi.
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
    window.history.replaceState({}, '', '/diagnostico');
    setStep('intro');
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
            {es ? 'Diagnóstico de madurez' : 'Maturity diagnosis'}
          </span>
        </div>
      </header>

      <div className="container">
        <AnimatePresence mode="wait" initial={false}>
          {step === 'intro' && <IntroScreen lead={lead} onChange={setLead} onStart={() => setStep('quiz')} es={es} />}
          {step === 'quiz' && (
            <QuizScreen
              answers={answers}
              onAnswer={(i, v) => setAnswers((prev) => prev.map((a, n) => (n === i ? v : a)))}
              onFinish={finish}
              onBackToIntro={() => setStep('intro')}
              es={es}
            />
          )}
          {step === 'result' && (
            <ResultScreen
              answers={scored}
              lead={lead}
              result={result}
              config={config}
              paying={paying}
              payError={payError}
              onPay={pay}
              onRestart={restart}
              es={es}
            />
          )}
        </AnimatePresence>
        {submitting && (
          <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 size={12} className="animate-spin" />
            {es ? 'Guardando tu diagnóstico…' : 'Saving your diagnosis…'}
          </p>
        )}
      </div>
    </div>
  );
}
