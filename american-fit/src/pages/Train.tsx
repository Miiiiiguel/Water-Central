import { ArrowRight, Check, ChevronRight, Clock, Dumbbell, Play, RefreshCw, Shuffle, Wand2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { MUSCLE_LABEL, MuscleMap } from "@/components/body/MuscleMap";
import { DemoThumb } from "@/components/technique/FormDemo";
import { Badge, Bar, Button, Chip, Empty, PageHeader, SectionHeader } from "@/components/ui";
import { COACH_BY_ID } from "@/data/coaches";
import { getExercise, LEVEL_LABEL } from "@/data/exercises";
import { PROGRAMS } from "@/data/programs";
import { GOAL_LABEL } from "@/lib/nutrition";
import { nextProgramDay } from "@/lib/selectors";
import { actions, useApp } from "@/lib/store";
import { FOCUS_LABEL, generateWorkout, recoveryLevels, type Focus } from "@/lib/training";
import type { Muscle } from "@/lib/types";
import { ProBadge } from "@/components/monetize";
import { canUseProgram } from "@/lib/access";
import { getState } from "@/lib/store";
import { cn, fmtDayMonth, fmtDuration, fromDayKey } from "@/lib/utils";

export default function Train() {
  const [, navigate] = useLocation();
  const profile = useApp(s => s.profile)!;
  const workouts = useApp(s => s.workouts);
  const enrolled = useApp(s => s.enrolled);
  const active = useApp(s => s.active);
  const userPlan = useApp(s => s.plan);
  const purchases = useApp(s => s.purchases);
  const [focus, setFocus] = useState<Focus>("auto");
  const [minutes, setMinutes] = useState(profile.minutes);
  const [seed, setSeed] = useState(() => Date.now());

  const next = nextProgramDay(enrolled);
  const recovery = useMemo(() => recoveryLevels(workouts), [workouts]);
  const plan = useMemo(() => generateWorkout(profile, workouts, focus, minutes, seed), [profile, workouts, focus, minutes, seed]);
  const ready = (Object.keys(MUSCLE_LABEL) as Muscle[])
    .map(m => ({ m, f: recovery[m] ?? 0 }))
    .sort((a, b) => a.f - b.f);
  const recent = [...workouts].sort((a, b) => b.startedAt - a.startedAt).slice(0, 5);

  const startGenerated = () => {
    actions.startSession(`Entreno ${FOCUS_LABEL[plan.focus].toLowerCase()}`, plan.exercises);
    navigate("/entrenar/sesion");
  };

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="Entrenamiento"
        title="Entrenar"
        actions={
          active ? (
            <Button onClick={() => navigate("/entrenar/sesion")}>
              <Play className="size-4" fill="currentColor" /> Continuar
            </Button>
          ) : undefined
        }
      />

      {next && (
        <section className="card grain relative overflow-hidden">
          <div className="absolute inset-0" style={{ background: `radial-gradient(80% 90% at 100% 0%, hsl(${next.program.hue} 85% 55% / 0.25), transparent 60%)` }} />
          <div className="relative p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="eyebrow">Tu programa · semana {next.week} de {next.program.weeks}</div>
                <h2 className="title-display mt-1 text-4xl">{next.program.name}</h2>
                <p className="text-sm text-muted">{next.program.tagline}</p>
              </div>
              <Link href={`/entrenar/programa/${next.program.id}`} className="grid size-10 shrink-0 place-items-center rounded-full bg-fg/8" aria-label="Ver programa">
                <ChevronRight className="size-5" />
              </Link>
            </div>
            <div className="mt-4 flex gap-2 overflow-x-auto no-scrollbar">
              {next.program.days.map(d => {
                const isNext = d.key === next.day.key;
                const done = enrolled!.done.filter(x => x === d.key).length;
                return (
                  <button
                    key={d.key}
                    onClick={() => {
                      if (!active) actions.startProgramDay(next.program.id, d.key);
                      navigate("/entrenar/sesion");
                    }}
                    className={cn(
                      "min-w-40 shrink-0 rounded-2xl border p-3 text-left transition",
                      isNext ? "border-brand/50 bg-brand/10" : "border-line bg-ink-900/70 hover:border-line-strong"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase text-muted">Día {d.key}</span>
                      {isNext ? <Badge tone="brand">Siguiente</Badge> : done > 0 && <Check className="size-4 text-success" />}
                    </div>
                    <div className="mt-1 text-sm font-semibold">{d.name}</div>
                    <div className="text-xs text-muted">{d.exercises.length} ejercicios</div>
                  </button>
                );
              })}
            </div>
            <div className="mt-4 flex items-center gap-3">
              <Bar value={next.completed / next.total} className="flex-1" />
              <span className="tabular text-xs text-muted">
                {next.completed}/{next.total} sesiones
              </span>
            </div>
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        {/* Generator */}
        <section className="card min-w-0 p-5">
          <div className="mb-1 flex items-center gap-2">
            <Wand2 className="size-5 text-sky" />
            <h2 className="text-lg font-bold">Entreno inteligente</h2>
          </div>
          <p className="mb-4 text-sm text-muted">Generado según tu recuperación muscular, material y nivel.</p>
          <div className="no-scrollbar -mx-1 mb-3 flex gap-2 overflow-x-auto px-1">
            {(Object.keys(FOCUS_LABEL) as Focus[]).map(f => (
              <Chip key={f} active={focus === f} onClick={() => setFocus(f)}>
                {f === "auto" && <Wand2 className="size-3.5" />}
                {FOCUS_LABEL[f]}
              </Chip>
            ))}
          </div>
          <div className="mb-4 flex items-center gap-2">
            <Clock className="size-4 text-muted" />
            {[20, 30, 45, 60, 75].map(m => (
              <button
                key={m}
                onClick={() => setMinutes(m)}
                className={cn("h-8 rounded-full px-3 text-sm font-semibold", minutes === m ? "bg-fg/12 text-fg" : "text-muted hover:text-fg")}
              >
                {m}′
              </button>
            ))}
          </div>
          <div className="rounded-2xl border border-line bg-ink-950/40">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div>
                <div className="text-sm font-semibold">{FOCUS_LABEL[plan.focus]}</div>
                <div className="text-xs text-muted">
                  {plan.exercises.length} ejercicios · ~{minutes} min
                </div>
              </div>
              <button onClick={() => setSeed(Date.now())} className="inline-flex items-center gap-1.5 rounded-full bg-fg/6 px-3 py-1.5 text-xs font-semibold text-muted hover:text-fg">
                <Shuffle className="size-3.5" /> Otra opción
              </button>
            </div>
            <ul className="divide-y divide-line">
              {plan.exercises.map(it => {
                const ex = getExercise(it.id)!;
                return (
                  <li key={it.id} className="flex items-center gap-3 px-3 py-2">
                    <div className="h-12 w-14 shrink-0">
                      <DemoThumb demoId={ex.demo} className="size-full" />
                    </div>
                    <Link href={`/tecnica/${ex.id}`} className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold">{ex.name}</div>
                      <div className="truncate text-xs text-muted">{ex.primary.map(m => MUSCLE_LABEL[m]).join(", ")}</div>
                    </Link>
                    <span className="tabular shrink-0 text-xs text-muted">
                      {it.sets} × {it.reps}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
          <Button className="mt-4 w-full" size="lg" onClick={startGenerated} disabled={!!active}>
            <Play className="size-4" fill="currentColor" /> {active ? "Ya tienes un entreno en curso" : "Empezar este entreno"}
          </Button>
        </section>

        {/* Recovery */}
        <section className="card min-w-0 p-5">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-lg font-bold">Mapa de recuperación</h2>
            <RefreshCw className="size-4 text-muted" />
          </div>
          <p className="mb-3 text-sm text-muted">Estimado con tus series de las últimas 72 h.</p>
          <MuscleMap levels={recovery} mode="recovery" className="mx-auto h-64 max-w-[280px]" />
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">
            {ready.slice(0, 8).map(({ m, f }) => (
              <div key={m} className="flex items-center gap-2 text-sm">
                <span className={cn("size-2 rounded-full", f >= 0.66 ? "bg-brand" : f >= 0.33 ? "bg-warn" : "bg-success")} />
                <span className="flex-1 truncate">{MUSCLE_LABEL[m]}</span>
                <span className="tabular text-muted">{Math.round((1 - f) * 100)}%</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section>
        <SectionHeader title="Programas" subtitle="Planes de varias semanas diseñados por coaches" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {PROGRAMS.map(p => (
            <Link key={p.id} href={`/entrenar/programa/${p.id}`} className="card card-hover group relative overflow-hidden p-5">
              <div className="absolute inset-0 opacity-80 transition-opacity group-hover:opacity-100" style={{ background: `radial-gradient(90% 80% at 100% 0%, hsl(${p.hue} 80% 55% / 0.22), transparent 60%)` }} />
              <div className="relative">
                <div className="flex items-center justify-between">
                  <Badge>{GOAL_LABEL[p.goal]}</Badge>
                  {enrolled?.programId === p.id ? <Badge tone="success">Activo</Badge> : !canUseProgram({ ...getState(), plan: userPlan, purchases }, p.id) && <ProBadge />}
                </div>
                <h3 className="title-display mt-3 text-3xl">{p.name}</h3>
                <p className="text-sm text-muted">{p.tagline}</p>
                <div className="mt-4 flex items-center gap-3 text-xs text-muted">
                  <span>{p.weeks} sem</span>
                  <span className="size-1 rounded-full bg-faint" />
                  <span>{p.daysPerWeek} días/sem</span>
                  <span className="size-1 rounded-full bg-faint" />
                  <span>{p.minutes} min</span>
                  <span className="size-1 rounded-full bg-faint" />
                  <span>{LEVEL_LABEL[p.level]}</span>
                </div>
                <div className="mt-3 text-xs text-faint">con {COACH_BY_ID[p.coachId]?.name}</div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <SectionHeader title="Entrenos recientes" href="/progreso" action="Progreso" />
        {recent.length === 0 ? (
          <Empty icon={<Dumbbell className="size-5" />} title="Aún no hay entrenos" text="Tu historial aparecerá aquí con volumen, récords y duración." />
        ) : (
          <div className="card divide-y divide-line">
            {recent.map(w => (
              <Link key={w.id} href={`/entrenar/resumen/${w.id}`} className="flex items-center gap-4 p-4 hover:bg-fg/[0.02]">
                <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-fg/6 text-center">
                  <div>
                    <div className="text-sm font-bold leading-none">{fromDayKey(w.date).getDate()}</div>
                    <div className="text-[9px] uppercase text-muted">{fmtDayMonth(fromDayKey(w.date)).split(" ")[1]}</div>
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{w.name}</div>
                  <div className="text-xs text-muted">
                    {fmtDuration(w.durationSec)} · {Math.round(w.volume).toLocaleString("es")} kg · {w.exercises.length} ejercicios
                  </div>
                </div>
                {w.prs.length > 0 && <Badge tone="warn">{w.prs.length} PR</Badge>}
                <ArrowRight className="size-4 text-muted" />
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
