import { motion } from "framer-motion";
import { ArrowRight, Bell, BellRing, ChevronRight, Droplets, Flame, Play, Plus, Radio, Sparkles, Timer, Utensils } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { MuscleMap } from "@/components/body/MuscleMap";
import { MacroRings } from "@/components/charts";
import { DemoThumb } from "@/components/technique/FormDemo";
import { ClassArt } from "@/components/video/ClassArt";
import { Avatar, Badge, Bar, Button, HScroll, SectionHeader } from "@/components/ui";
import { ARTICLES } from "@/data/articles";
import { COACH_BY_ID } from "@/data/coaches";
import { EXERCISES, getExercise } from "@/data/exercises";
import { CATEGORY_HUE, CATEGORY_LABEL, VIDEOS } from "@/data/media";
import { actions, getState, useApp } from "@/lib/store";
import { nextProgramDay, todayNutrition, upcomingLive, weekActivity } from "@/lib/selectors";
import { recoveryLevels, weeklyStreak } from "@/lib/training";
import { cn, dayKey, fmtLongDate, fmtTime, fmtWeekday, greeting } from "@/lib/utils";

function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

function countdown(to: Date, now: Date) {
  const s = Math.max(0, Math.round((to.getTime() - now.getTime()) / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h >= 24) return `${Math.floor(h / 24)} d`;
  return h ? `${h} h ${m} min` : `${m} min`;
}

const fade = (i: number) => ({
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  transition: { delay: 0.04 * i, duration: 0.45, ease: [0.22, 1, 0.36, 1] as const },
});

export default function Home() {
  const [, navigate] = useLocation();
  const now = useNow();
  const profile = useApp(s => s.profile)!;
  const enrolled = useApp(s => s.enrolled);
  const workouts = useApp(s => s.workouts);
  const active = useApp(s => s.active);
  const reminders = useApp(s => s.reminders);
  const nutrition = useApp(s => s.nutrition);
  const watched = useApp(s => s.watched);

  const next = nextProgramDay(enrolled);
  const streak = weeklyStreak(workouts, now);
  const recovery = useMemo(() => recoveryLevels(workouts), [workouts]);
  const week = weekActivity(getState(), now);
  const { totals, targets, water } = todayNutrition({ ...getState(), nutrition });
  const live = upcomingLive(now).slice(0, 6);
  const featured = live[0]!;
  const techniqueOfDay = EXERCISES[new Date().getDate() % EXERCISES.length]!;
  const continueVideos = VIDEOS.filter(v => watched[v.id]);
  const rowVideos = continueVideos.length ? continueVideos : VIDEOS.filter(v => v.isNew || v.isReplay);
  const firstEx = next ? getExercise(next.day.exercises[0]!.id) : undefined;

  const start = () => {
    if (!active && next) actions.startProgramDay(next.program.id, next.day.key);
    navigate("/entrenar/sesion");
  };

  return (
    <div className="space-y-8">
      <motion.section {...fade(0)} className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{fmtLongDate(now)}</p>
          <h1 className="title-display mt-1 text-[44px] sm:text-6xl">
            {greeting(now)}, <span className="text-gradient-brand">{profile.name.split(" ")[0]}</span>
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-2xl border border-line bg-ink-900 px-3 py-2">
          <Flame className="size-5 text-ember" />
          <div className="leading-tight">
            <div className="tabular text-lg font-bold">{streak}</div>
            <div className="text-[11px] text-muted">sem. seguidas</div>
          </div>
        </div>
      </motion.section>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        {/* Today's workout */}
        <motion.section {...fade(1)} className="card grain relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(90%_70%_at_100%_0%,rgb(255_59_78/0.28),transparent_60%)]" />
          <div className="relative grid grid-cols-[1fr_auto] gap-2 p-5">
            <div className="min-w-0">
              <Badge tone="brand">{active ? "En curso" : "Tu entreno de hoy"}</Badge>
              {next ? (
                <>
                  <h2 className="title-display mt-3 text-4xl">{active ? active.name : next.day.name}</h2>
                  <p className="mt-1 text-sm text-muted">
                    {next.program.name} · Semana {next.week} · {next.day.focus}
                  </p>
                  <ul className="mt-4 space-y-1.5 text-sm">
                    {next.day.exercises.slice(0, 4).map(it => (
                      <li key={it.id} className="flex items-center gap-2 text-fg/95">
                        <span className="size-1.5 rounded-full bg-brand" />
                        <span className="truncate">{getExercise(it.id)?.name}</span>
                        <span className="ml-auto shrink-0 tabular text-xs text-muted">
                          {it.sets}×{it.reps}
                        </span>
                      </li>
                    ))}
                    {next.day.exercises.length > 4 && (
                      <li className="text-xs text-muted">+{next.day.exercises.length - 4} ejercicios más</li>
                    )}
                  </ul>
                </>
              ) : (
                <>
                  <h2 className="title-display mt-3 text-4xl">Elige un programa</h2>
                  <p className="mt-1 text-sm text-muted">O genera un entreno a tu medida en segundos.</p>
                </>
              )}
            </div>
            {firstEx && (
              <div className="hidden w-36 sm:block">
                <DemoThumb demoId={firstEx.demo} animate className="h-44 w-full" />
              </div>
            )}
          </div>
          <div className="relative flex items-center gap-3 border-t border-line p-4">
            {next ? (
              <>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex justify-between text-xs text-muted">
                    <span>Progreso del programa</span>
                    <span className="tabular">
                      {next.completed}/{next.total}
                    </span>
                  </div>
                  <Bar value={next.completed / next.total} />
                </div>
                <Button onClick={start}>
                  <Play className="size-4" fill="currentColor" /> {active ? "Continuar" : "Empezar"}
                </Button>
              </>
            ) : (
              <Button onClick={() => navigate("/entrenar")} className="ml-auto">
                Ir a entrenar <ArrowRight className="size-4" />
              </Button>
            )}
          </div>
        </motion.section>

        {/* Live */}
        <motion.section {...fade(2)} className="card relative overflow-hidden">
          <Link href={`/live/${featured.c.id}`} className="block">
            <div className="relative h-36">
              <ClassArt hue={CATEGORY_HUE[featured.c.category]} word={CATEGORY_LABEL[featured.c.category]} category={featured.c.category} />
              <div className="absolute inset-0 bg-gradient-to-t from-ink-900 via-ink-900/30 to-transparent" />
              <div className="absolute left-4 top-4 flex gap-2">
                {featured.live ? <Badge tone="live">En vivo</Badge> : <Badge tone="neutral">En {countdown(featured.at, now)}</Badge>}
              </div>
            </div>
            <div className="-mt-6 relative px-4 pb-4">
              <h3 className="text-lg font-bold">{featured.c.title}</h3>
              <div className="mt-1 flex items-center gap-2 text-[13px] text-muted">
                <Avatar name={COACH_BY_ID[featured.c.coachId]!.name} hue={COACH_BY_ID[featured.c.coachId]!.hue} size={22} />
                {COACH_BY_ID[featured.c.coachId]!.name} · {featured.c.durationMin} min · {fmtTime(featured.at)}
              </div>
            </div>
          </Link>
          <div className="space-y-1 border-t border-line p-2">
            {live.slice(1, 4).map(({ c, at, live: isLive }) => {
              const on = reminders.includes(c.id);
              return (
                <div key={c.id} className="flex items-center gap-3 rounded-xl p-2 hover:bg-white/4">
                  <div className="w-12 shrink-0 text-center">
                    <div className="tabular text-sm font-bold">{fmtTime(at)}</div>
                    <div className="text-[11px] uppercase text-muted">{dayKey(at) === dayKey(now) ? "hoy" : fmtWeekday(at)}</div>
                  </div>
                  <Link href={`/live/${c.id}`} className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{c.title}</div>
                    <div className="truncate text-xs text-muted">
                      {COACH_BY_ID[c.coachId]?.name} · {c.durationMin} min
                    </div>
                  </Link>
                  {isLive ? (
                    <Badge tone="live">Live</Badge>
                  ) : (
                    <button
                      onClick={() => actions.toggleReminder(c.id)}
                      className={cn("grid size-9 place-items-center rounded-full", on ? "bg-success/15 text-success" : "bg-white/6 text-muted")}
                      aria-label={on ? "Quitar recordatorio" : "Recordarme"}
                    >
                      {on ? <BellRing className="size-4" /> : <Bell className="size-4" />}
                    </button>
                  )}
                </div>
              );
            })}
            <Link href="/live" className="flex items-center justify-center gap-1 rounded-xl p-2 text-[13px] font-medium text-muted hover:text-fg">
              <Radio className="size-4" /> Ver agenda completa
            </Link>
          </div>
        </motion.section>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Nutrition */}
        <motion.section {...fade(3)} className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-bold">Nutrición de hoy</h3>
            <Link href="/nutricion" className="text-muted hover:text-fg" aria-label="Abrir nutrición">
              <ChevronRight className="size-5" />
            </Link>
          </div>
          <MacroRings
            size={116}
            center={
              <div>
                <div className="tabular text-xl font-bold">{Math.max(0, targets.kcal - totals.kcal).toLocaleString("es")}</div>
                <div className="text-[11px] text-muted">kcal restantes</div>
              </div>
            }
            items={[
              { label: "Proteína", value: totals.protein, target: targets.protein, color: "var(--color-protein)" },
              { label: "Carbos", value: totals.carbs, target: targets.carbs, color: "var(--color-carbs)" },
              { label: "Grasa", value: totals.fat, target: targets.fat, color: "var(--color-fat)" },
            ]}
          />
          <div className="mt-4 flex gap-2">
            <Button variant="secondary" size="sm" className="flex-1" onClick={() => navigate("/nutricion")}>
              <Utensils className="size-4" /> Registrar comida
            </Button>
            <Button variant="secondary" size="sm" onClick={() => actions.addWater(dayKey(), 250)} aria-label="Sumar 250 ml de agua">
              <Droplets className="size-4 text-sky" /> {(water / 1000).toLocaleString("es", { maximumFractionDigits: 2 })} L
              <Plus className="size-3.5" />
            </Button>
          </div>
        </motion.section>

        {/* Recovery */}
        <motion.section {...fade(4)} className="card p-5">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-bold">Recuperación muscular</h3>
            <Link href="/entrenar" className="text-muted hover:text-fg" aria-label="Abrir entrenar">
              <ChevronRight className="size-5" />
            </Link>
          </div>
          <MuscleMap levels={recovery} mode="recovery" className="mx-auto h-48 max-w-[240px]" />
          <div className="mt-3 flex justify-center gap-4 text-xs text-muted">
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-success" /> Listo</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-warn" /> Recuperando</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-brand" /> Fatigado</span>
          </div>
        </motion.section>

        {/* Technique of the day */}
        <motion.section {...fade(5)} className="card card-hover relative overflow-hidden md:col-span-2 lg:col-span-1">
          <Link href={`/tecnica/${techniqueOfDay.id}`} className="block p-5">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-sky" />
              <span className="eyebrow text-sky-300">Técnica del día</span>
            </div>
            <div className="mt-2 grid grid-cols-[1fr_120px] items-center gap-2">
              <div>
                <h3 className="text-xl font-bold">{techniqueOfDay.name}</h3>
                <p className="mt-1 line-clamp-3 text-sm text-muted">{techniqueOfDay.summary}</p>
                <div className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-fg">
                  Ver cómo se hace <ArrowRight className="size-4" />
                </div>
              </div>
              <DemoThumb demoId={techniqueOfDay.demo} animate className="h-36 w-full" />
            </div>
          </Link>
        </motion.section>
      </div>

      {/* Week strip */}
      <motion.section {...fade(6)} className="card flex items-center justify-between gap-2 p-4">
        {week.map(d => (
          <div key={d.key} className="flex flex-1 flex-col items-center gap-1.5">
            <span className="text-xs uppercase text-muted">{fmtWeekday(d.date).slice(0, 2)}</span>
            <span
              className={cn(
                "grid size-9 place-items-center rounded-full text-sm font-semibold",
                d.trained ? "bg-gradient-brand text-white" : "bg-white/5 text-faint",
                d.key === dayKey(now) && !d.trained && "ring-1 ring-fg/40"
              )}
            >
              {d.trained ? <Flame className="size-4" /> : d.date.getDate()}
            </span>
          </div>
        ))}
      </motion.section>

      {/* Videos */}
      <motion.section {...fade(7)}>
        <SectionHeader title={continueVideos.length ? "Continuar viendo" : "Nuevo en American Fit"} href="/videos" />
        <HScroll>
          {rowVideos.map(v => (
            <Link key={v.id} href={`/videos/${v.id}`} className="w-64 shrink-0 snap-start sm:w-72">
              <div className="relative aspect-video overflow-hidden rounded-2xl border border-line">
                <ClassArt hue={CATEGORY_HUE[v.category]} word={CATEGORY_LABEL[v.category]} category={v.category} />
                <div className="absolute bottom-2 left-2 flex gap-1.5">
                  {v.isReplay && <Badge tone="brand">Repetición</Badge>}
                  {v.isNew && <Badge tone="sky">Nuevo</Badge>}
                </div>
                <span className="absolute bottom-2 right-2 rounded-md bg-black/60 px-1.5 py-0.5 text-xs font-semibold tabular">
                  {v.durationMin} min
                </span>
              </div>
              <div className="mt-2 truncate text-sm font-semibold">{v.title}</div>
              <div className="truncate text-xs text-muted">{COACH_BY_ID[v.coachId]?.name}</div>
            </Link>
          ))}
        </HScroll>
      </motion.section>

      {/* Guide */}
      <motion.section {...fade(8)}>
        <SectionHeader title="Aprende" subtitle="Guías cortas basadas en evidencia" href="/nutricion" action="Más guías" />
        <div className="grid gap-3 sm:grid-cols-2">
          {ARTICLES.slice(0, 2).map(a => (
            <Link key={a.id} href={`/nutricion/guias/${a.id}`} className="card card-hover flex items-center gap-4 p-4">
              <div className="grid size-14 shrink-0 place-items-center rounded-2xl" style={{ background: `hsl(${a.hue} 70% 50% / 0.16)` }}>
                <Timer className="size-6" style={{ color: `hsl(${a.hue} 90% 66%)` }} />
              </div>
              <div className="min-w-0">
                <div className="font-semibold">{a.title}</div>
                <div className="line-clamp-1 text-[13px] text-muted">{a.summary}</div>
                <div className="mt-0.5 text-xs text-faint">{a.minutes} min de lectura</div>
              </div>
            </Link>
          ))}
        </div>
      </motion.section>
    </div>
  );
}
