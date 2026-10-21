import { Bell, BellRing, CalendarDays, Clock, Flame, Play, Radio, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { ClassArt } from "@/components/video/ClassArt";
import { Avatar, Badge, Button, Chip, HScroll, PageHeader, SectionHeader } from "@/components/ui";
import { COACH_BY_ID, COACHES } from "@/data/coaches";
import { LEVEL_LABEL } from "@/data/exercises";
import { CATEGORY_HUE, CATEGORY_LABEL, classesOn, isLiveNow, nextOccurrence, VIDEOS } from "@/data/media";
import { upcomingLive } from "@/lib/selectors";
import { actions, useApp } from "@/lib/store";
import type { ClassCategory, LiveClass } from "@/lib/types";
import { addDays, cn, dayKey, fmtDuration, fmtTime, fmtWeekday } from "@/lib/utils";

function useClock(ms = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/** Deterministic "people here" count so it doesn't jump on every render. */
export function audience(c: LiveClass, now: Date) {
  const base = 80 + ((c.id.length * 37 + c.startMin) % 140);
  return base + Math.round(Math.sin(now.getTime() / 60_000 + c.startMin) * 12);
}

export default function Live() {
  const now = useClock();
  const reminders = useApp(s => s.reminders);
  const [day, setDay] = useState(dayKey());
  const [cat, setCat] = useState<ClassCategory | null>(null);

  const upcoming = upcomingLive(now);
  const hero = upcoming[0]!;
  const heroCoach = COACH_BY_ID[hero.c.coachId]!;
  const days = Array.from({ length: 7 }, (_, i) => addDays(now, i));
  const schedule = useMemo(() => classesOn(new Date(day + "T12:00:00")).filter(c => !cat || c.category === cat), [day, cat]);
  const replays = VIDEOS.filter(v => v.isReplay);
  const secs = (hero.at.getTime() - now.getTime()) / 1000;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Clases en directo con coaches reales"
        title={
          <span className="inline-flex items-center gap-3">
            Live <span className="relative inline-flex size-3 rounded-full bg-brand animate-pulse-live" />
          </span>
        }
        actions={
          <Link href="/videos" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/7 px-3.5 text-[13px] font-semibold">
            <Play className="size-4" /> Videos
          </Link>
        }
      />

      {/* Hero */}
      <section className="relative overflow-hidden rounded-[28px] border border-line">
        <div className="absolute inset-0">
          <ClassArt hue={CATEGORY_HUE[hero.c.category]} word={CATEGORY_LABEL[hero.c.category]} category={hero.c.category} />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/75 to-ink-950/10" />
        <div className="relative max-w-xl p-6 sm:p-10">
          {hero.live ? (
            <Badge tone="live">En vivo ahora</Badge>
          ) : (
            <Badge tone="neutral">
              <Clock className="size-3" /> Próxima clase
            </Badge>
          )}
          <h2 className="title-display mt-3 text-5xl sm:text-7xl">{hero.c.title}</h2>
          <div className="mt-2 flex items-center gap-2 text-sm text-fg/80">
            <Avatar name={heroCoach.name} hue={heroCoach.hue} size={26} />
            {heroCoach.name} · {hero.c.durationMin} min · {LEVEL_LABEL[hero.c.level]}
          </div>
          <p className="mt-3 line-clamp-2 text-sm text-muted">{hero.c.description}</p>
          {!hero.live && (
            <div className="mt-5 flex gap-2">
              {fmtDuration(Math.max(0, secs))
                .split(":")
                .map((part, i, arr) => (
                  <div key={i} className="min-w-16 rounded-2xl bg-black/40 px-3 py-2 text-center backdrop-blur">
                    <div className="tabular title-display text-4xl">{part.padStart(2, "0")}</div>
                    <div className="text-[10px] uppercase text-muted">{arr.length === 3 ? ["horas", "min", "seg"][i] : ["min", "seg"][i]}</div>
                  </div>
                ))}
            </div>
          )}
          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              href={`/live/${hero.c.id}`}
              className="inline-flex h-12 items-center gap-2 rounded-full bg-gradient-brand px-6 font-semibold text-white shadow-[0_8px_24px_-8px_rgb(255_59_78/0.65)]"
            >
              <Radio className="size-4" /> {hero.live ? "Unirme ahora" : "Entrar a la sala"}
            </Link>
            {!hero.live && (
              <Button variant="secondary" size="lg" className="h-12" onClick={() => actions.toggleReminder(hero.c.id)}>
                {reminders.includes(hero.c.id) ? <BellRing className="size-4 text-success" /> : <Bell className="size-4" />}
                {reminders.includes(hero.c.id) ? "Te avisaremos" : "Recordarme"}
              </Button>
            )}
          </div>
          {hero.live && (
            <div className="mt-4 flex items-center gap-2 text-sm text-muted">
              <Users className="size-4" /> {audience(hero.c, now)} personas entrenando
            </div>
          )}
        </div>
      </section>

      {/* Schedule */}
      <section>
        <SectionHeader title="Agenda" subtitle="Reserva tu lugar y recibe un aviso antes de empezar" />
        <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
          {days.map(d => {
            const k = dayKey(d);
            const active = k === day;
            return (
              <button
                key={k}
                onClick={() => setDay(k)}
                className={cn(
                  "flex w-16 shrink-0 flex-col items-center rounded-2xl border py-2.5 transition",
                  active ? "border-fg bg-fg text-ink-950" : "border-line bg-ink-900 text-muted hover:text-fg"
                )}
              >
                <span className="text-[11px] font-semibold uppercase">{k === dayKey(now) ? "Hoy" : fmtWeekday(d)}</span>
                <span className="text-xl font-bold">{d.getDate()}</span>
                <span className={cn("mt-0.5 size-1 rounded-full", classesOn(d).length ? (active ? "bg-brand" : "bg-brand/70") : "bg-transparent")} />
              </button>
            );
          })}
        </div>
        <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
          <Chip active={!cat} onClick={() => setCat(null)}>
            Todas
          </Chip>
          {(Object.keys(CATEGORY_LABEL) as ClassCategory[]).map(c => (
            <Chip key={c} active={cat === c} onClick={() => setCat(cat === c ? null : c)}>
              {CATEGORY_LABEL[c]}
            </Chip>
          ))}
        </div>
        <div className="card divide-y divide-line">
          {schedule.length === 0 && <p className="p-8 text-center text-sm text-muted">No hay clases de este tipo ese día.</p>}
          {schedule.map(c => {
            const start = new Date(day + "T00:00:00");
            start.setMinutes(c.startMin);
            const end = new Date(start.getTime() + c.durationMin * 60_000);
            const isLive = dayKey(now) === day && isLiveNow(c, now) && nextOccurrence(c, now).getTime() === start.getTime();
            const past = end < now;
            const coach = COACH_BY_ID[c.coachId]!;
            const on = reminders.includes(c.id);
            return (
              <div key={c.id} className={cn("flex items-center gap-4 p-4", past && "opacity-45")}>
                <div className="w-14 shrink-0">
                  <div className="tabular text-lg font-bold leading-none">{fmtTime(start)}</div>
                  <div className="mt-1 text-[11px] text-muted">{c.durationMin} min</div>
                </div>
                <div className="h-10 w-1 shrink-0 rounded-full" style={{ background: `hsl(${CATEGORY_HUE[c.category]} 80% 58%)` }} />
                <Link href={`/live/${c.id}`} className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold">{c.title}</span>
                    {isLive && <Badge tone="live">Live</Badge>}
                  </div>
                  <div className="flex items-center gap-1.5 truncate text-xs text-muted">
                    <Avatar name={coach.name} hue={coach.hue} size={16} />
                    {coach.name} · {CATEGORY_LABEL[c.category]} · {LEVEL_LABEL[c.level]}
                    {c.kcal > 0 && (
                      <>
                        {" "}
                        · <Flame className="inline size-3" /> {c.kcal}
                      </>
                    )}
                  </div>
                </Link>
                {isLive ? (
                  <Link href={`/live/${c.id}`} className="rounded-full bg-gradient-brand px-4 py-2 text-xs font-bold text-white">
                    Unirme
                  </Link>
                ) : past ? (
                  <span className="text-xs text-muted">Terminada</span>
                ) : (
                  <button
                    onClick={() => actions.toggleReminder(c.id)}
                    className={cn("inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-semibold", on ? "bg-success/15 text-success" : "bg-white/7 text-muted hover:text-fg")}
                  >
                    {on ? <BellRing className="size-3.5" /> : <Bell className="size-3.5" />}
                    <span className="hidden sm:inline">{on ? "Reservada" : "Reservar"}</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <SectionHeader title="Repeticiones" subtitle="¿Te la perdiste? Hazla cuando quieras" href="/videos" />
        <HScroll>
          {replays.map(v => (
            <Link key={v.id} href={`/videos/${v.id}`} className="w-72 shrink-0 snap-start">
              <div className="relative aspect-video overflow-hidden rounded-2xl border border-line">
                <ClassArt hue={CATEGORY_HUE[v.category]} word={CATEGORY_LABEL[v.category]} category={v.category} />
                <Badge tone="brand" className="absolute left-2 top-2">
                  Repetición
                </Badge>
              </div>
              <div className="mt-2 truncate text-sm font-semibold">{v.title}</div>
              <div className="text-xs text-muted">
                {COACH_BY_ID[v.coachId]?.name} · {v.durationMin} min
              </div>
            </Link>
          ))}
        </HScroll>
      </section>

      <section>
        <SectionHeader title="Coaches" />
        <HScroll>
          {COACHES.map(c => (
            <Link key={c.id} href={`/coaches/${c.id}`} className="card card-hover w-40 shrink-0 snap-start p-4 text-center">
              <div className="mx-auto w-fit">
                <Avatar name={c.name} hue={c.hue} size={64} />
              </div>
              <div className="mt-3 truncate text-sm font-semibold">{c.name}</div>
              <div className="line-clamp-2 text-xs text-muted">{c.role}</div>
            </Link>
          ))}
        </HScroll>
      </section>

      <section className="card flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center">
        <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-sky/15">
          <CalendarDays className="size-6 text-sky" />
        </div>
        <div className="flex-1">
          <div className="font-semibold">{upcoming.filter(u => reminders.includes(u.c.id)).length} clases reservadas</div>
          <div className="text-sm text-muted">Te avisaremos 10 minutos antes. Las clases reservadas aparecen primero en tu inicio.</div>
        </div>
      </section>
    </div>
  );
}
