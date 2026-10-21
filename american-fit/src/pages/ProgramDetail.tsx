import { CalendarDays, Check, ChevronDown, Clock, Dumbbell, Play, Target } from "lucide-react";
import { useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { DemoThumb } from "@/components/technique/FormDemo";
import { Avatar, Badge, Button } from "@/components/ui";
import { COACH_BY_ID } from "@/data/coaches";
import { getExercise, LEVEL_LABEL } from "@/data/exercises";
import { PROGRAM_BY_ID } from "@/data/programs";
import { GOAL_LABEL } from "@/lib/nutrition";
import { actions, useApp } from "@/lib/store";
import { cn } from "@/lib/utils";
import NotFound from "./NotFound";

export default function ProgramDetail() {
  const { id } = useParams<{ id: string }>();
  const p = PROGRAM_BY_ID[id];
  const [, navigate] = useLocation();
  const enrolled = useApp(s => s.enrolled);
  const active = useApp(s => s.active);
  const [open, setOpen] = useState<string | null>(p?.days[0]?.key ?? null);
  if (!p) return <NotFound />;
  const coach = COACH_BY_ID[p.coachId]!;
  const isMine = enrolled?.programId === p.id;

  const startDay = (key: string) => {
    if (!isMine) actions.enroll(p.id);
    if (!active) actions.startProgramDay(p.id, key);
    navigate("/entrenar/sesion");
  };

  return (
    <div>
      <Link href="/entrenar" className="mb-3 inline-flex text-[13px] font-medium text-muted hover:text-fg">
        ← Entrenar
      </Link>
      <section className="card grain relative mb-6 overflow-hidden p-6 sm:p-8">
        <div className="absolute inset-0" style={{ background: `radial-gradient(70% 90% at 100% 0%, hsl(${p.hue} 85% 55% / 0.35), transparent 60%), radial-gradient(60% 60% at 0% 100%, hsl(${(p.hue + 200) % 360} 80% 50% / 0.15), transparent 70%)` }} />
        <div className="relative">
          <div className="flex flex-wrap gap-1.5">
            <Badge tone="brand">{GOAL_LABEL[p.goal]}</Badge>
            <Badge>{LEVEL_LABEL[p.level]}</Badge>
            {isMine && <Badge tone="success">Tu programa</Badge>}
          </div>
          <h1 className="title-display mt-3 text-6xl sm:text-7xl">{p.name}</h1>
          <p className="mt-1 text-lg text-fg/90">{p.tagline}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {[
              [<CalendarDays key="c" className="size-4" />, `${p.weeks} semanas`],
              [<Dumbbell key="d" className="size-4" />, `${p.daysPerWeek} días/sem`],
              [<Clock key="t" className="size-4" />, `${p.minutes} min`],
            ].map(([icon, label], i) => (
              <div key={i} className="flex items-center gap-2 whitespace-nowrap rounded-xl bg-black/25 px-3 py-2 text-sm backdrop-blur [&_svg]:shrink-0">
                {icon}
                {label}
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            {isMine ? (
              <Button size="lg" onClick={() => navigate("/entrenar")}>
                <Play className="size-4" fill="currentColor" /> Ir a mi semana
              </Button>
            ) : (
              <Button size="lg" onClick={() => actions.enroll(p.id)}>
                <Target className="size-4" /> Empezar este programa
              </Button>
            )}
            {isMine && (
              <Button variant="ghost" onClick={() => actions.leaveProgram()}>
                Dejar programa
              </Button>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          <h2 className="text-lg font-bold">Sesiones</h2>
          {p.days.map(d => {
            const isOpen = open === d.key;
            return (
              <div key={d.key} className="card overflow-hidden">
                <button onClick={() => setOpen(isOpen ? null : d.key)} className="flex w-full items-center gap-4 p-4 text-left">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-white/6 font-bold">{d.key}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{d.name}</span>
                    <span className="block text-[13px] text-muted">
                      {d.focus} · {d.exercises.length} ejercicios
                    </span>
                  </span>
                  {isMine && enrolled!.done.includes(d.key) && <Check className="size-4 text-success" />}
                  <ChevronDown className={cn("size-5 text-muted transition-transform", isOpen && "rotate-180")} />
                </button>
                {isOpen && (
                  <div className="border-t border-line">
                    <ul className="divide-y divide-line">
                      {d.exercises.map(it => {
                        const ex = getExercise(it.id)!;
                        return (
                          <li key={it.id}>
                            <Link href={`/tecnica/${ex.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02]">
                              <div className="h-12 w-14 shrink-0">
                                <DemoThumb demoId={ex.demo} className="size-full" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-semibold">{ex.name}</div>
                                <div className="text-xs text-muted">Descanso {Math.round(it.rest / 6) / 10} min</div>
                              </div>
                              <span className="tabular text-sm font-semibold">
                                {it.sets} × {it.reps}
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                    <div className="p-3">
                      <Button className="w-full" onClick={() => startDay(d.key)} disabled={!!active}>
                        <Play className="size-4" fill="currentColor" /> {active ? "Termina tu entreno en curso" : `Empezar día ${d.key}`}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <aside className="space-y-4">
          <div className="card p-5">
            <h3 className="mb-2 font-bold">Sobre el programa</h3>
            <p className="text-sm leading-relaxed text-muted">{p.description}</p>
            <ul className="mt-4 space-y-2">
              {p.highlights.map(h => (
                <li key={h} className="flex gap-2 text-sm">
                  <Check className="mt-0.5 size-4 shrink-0 text-success" /> {h}
                </li>
              ))}
            </ul>
          </div>
          <Link href={`/coaches/${coach.id}`} className="card card-hover flex items-center gap-3 p-4">
            <Avatar name={coach.name} hue={coach.hue} size={48} />
            <div className="min-w-0">
              <div className="eyebrow">Tu coach</div>
              <div className="font-semibold">{coach.name}</div>
              <div className="truncate text-xs text-muted">{coach.role}</div>
            </div>
          </Link>
        </aside>
      </div>
    </div>
  );
}
