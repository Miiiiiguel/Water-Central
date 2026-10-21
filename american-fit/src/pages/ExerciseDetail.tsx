import { ArrowDownRight, ArrowUpRight, Camera, Check, Dumbbell, Heart, Lightbulb, Plus, ShieldCheck, Timer, Wind, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { MUSCLE_LABEL, MuscleMap } from "@/components/body/MuscleMap";
import { DemoThumb, FormDemo } from "@/components/technique/FormDemo";
import { ClassArt } from "@/components/video/ClassArt";
import { InProduction, VideoPlayer } from "@/components/video/VideoPlayer";
import { Badge, Button, Sheet } from "@/components/ui";
import { EQUIPMENT_LABEL, getExercise, LEVEL_LABEL, PATTERN_LABEL } from "@/data/exercises";
import { actions, useApp } from "@/lib/store";
import { bestE1rm, lastPerformance } from "@/lib/training";
import type { Muscle } from "@/lib/types";
import { cn, fmtDayMonth, fromDayKey } from "@/lib/utils";
import NotFound from "./NotFound";

const PATTERN_HUE: Record<string, number> = {
  pierna: 352,
  bisagra: 28,
  empuje: 214,
  traccion: 260,
  core: 280,
  cardio: 18,
  movilidad: 160,
};

export default function ExerciseDetail() {
  const { id } = useParams<{ id: string }>();
  const ex = getExercise(id);
  const [, navigate] = useLocation();
  const favorites = useApp(s => s.favorites.exercises);
  const workouts = useApp(s => s.workouts);
  const active = useApp(s => s.active);
  const reminders = useApp(s => s.reminders);
  const [compare, setCompare] = useState(false);
  if (!ex) return <NotFound />;

  const fav = favorites.includes(ex.id);
  const last = lastPerformance(workouts, ex.id);
  const best = bestE1rm(workouts, ex.id);
  const levels: Partial<Record<Muscle, number>> = {};
  ex.secondary.forEach(m => (levels[m] = 0.4));
  ex.primary.forEach(m => (levels[m] = 1));
  const notifyKey = `video:${ex.id}`;

  const train = () => {
    if (active) {
      actions.addExercise(ex.id);
    } else {
      actions.startSession(ex.name, [{ id: ex.id, ...ex.defaults }]);
    }
    navigate("/entrenar/sesion");
  };

  return (
    <div>
      <Link href="/tecnica" className="mb-3 inline-flex items-center gap-1 text-[13px] font-medium text-muted hover:text-fg">
        ← Biblioteca
      </Link>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap gap-1.5">
            <Badge tone="brand">{PATTERN_LABEL[ex.pattern]}</Badge>
            <Badge>{LEVEL_LABEL[ex.level]}</Badge>
            {ex.equipment.map(e => (
              <Badge key={e}>{EQUIPMENT_LABEL[e]}</Badge>
            ))}
          </div>
          <h1 className="title-display text-[42px] sm:text-6xl">{ex.name}</h1>
          <p className="text-sm text-faint">{ex.nameEn}</p>
        </div>
        <button
          onClick={() => actions.toggleFavorite("exercises", ex.id)}
          className={cn("grid size-11 shrink-0 place-items-center rounded-full border", fav ? "border-brand/40 bg-brand/15 text-brand" : "border-line bg-ink-900 text-muted")}
          aria-label={fav ? "Quitar de favoritos" : "Guardar en favoritos"}
        >
          <Heart className="size-5" fill={fav ? "currentColor" : "none"} />
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="space-y-4 lg:sticky lg:top-6 lg:self-start">
          <FormDemo demoId={ex.demo} />
          <div>
            <div className="eyebrow mb-2">Video del coach</div>
            <VideoPlayer
              src={ex.video?.src}
              poster={ex.video?.poster}
              placeholder={
                <InProduction
                  art={<ClassArt hue={PATTERN_HUE[ex.pattern] ?? 352} word={PATTERN_LABEL[ex.pattern]} demo={ex.demo} />}
                  notified={reminders.includes(notifyKey)}
                  onNotify={() => actions.toggleReminder(notifyKey)}
                />
              }
            />
          </div>
        </div>

        <div className="space-y-5">
          <p className="text-[17px] leading-relaxed text-fg/90">{ex.summary}</p>

          <div className="grid grid-cols-3 gap-2">
            <Fact icon={<Dumbbell className="size-4" />} label="Series × reps" value={`${ex.defaults.sets} × ${ex.defaults.reps}`} />
            <Fact icon={<Timer className="size-4" />} label="Descanso" value={`${Math.round(ex.defaults.rest / 6) / 10} min`} />
            <Fact icon={<Wind className="size-4" />} label="Tempo" value={ex.tempo} />
          </div>

          <div className="flex gap-2">
            <Button className="flex-1" onClick={train}>
              <Plus className="size-4" /> {active ? "Añadir a mi entreno" : "Entrenar ahora"}
            </Button>
            <Button variant="secondary" onClick={() => setCompare(true)}>
              <Camera className="size-4" /> Compárate
            </Button>
          </div>

          {(last || best > 0) && (
            <div className="card flex items-center gap-4 p-4">
              <div className="min-w-0 flex-1">
                <div className="eyebrow">Tu historial</div>
                {last && (
                  <div className="mt-1 text-sm">
                    Última vez ({fmtDayMonth(fromDayKey(last.date))}):{" "}
                    <span className="tabular font-semibold">
                      {last.sets.map(s => (s.weight ? `${s.weight}×${s.reps}` : `${s.reps}`)).join(" · ")}
                    </span>
                  </div>
                )}
              </div>
              {best > 0 && (
                <div className="text-right">
                  <div className="tabular text-xl font-bold">{best} kg</div>
                  <div className="text-[11px] text-muted">1RM estimado</div>
                </div>
              )}
            </div>
          )}

          <Section title="Músculos trabajados">
            <div className="grid grid-cols-[1fr_1.1fr] items-center gap-4">
              <MuscleMap levels={levels} className="h-56" />
              <div className="space-y-3 text-sm">
                <div>
                  <div className="mb-1.5 flex items-center gap-2 text-xs text-muted">
                    <span className="size-2.5 rounded-full bg-brand" /> Principales
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {ex.primary.map(m => (
                      <span key={m} className="rounded-full bg-white/7 px-2.5 py-1 font-medium">
                        {MUSCLE_LABEL[m]}
                      </span>
                    ))}
                  </div>
                </div>
                {ex.secondary.length > 0 && (
                  <div>
                    <div className="mb-1.5 flex items-center gap-2 text-xs text-muted">
                      <span className="size-2.5 rounded-full bg-ember/60" /> Secundarios
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {ex.secondary.map(m => (
                        <span key={m} className="rounded-full bg-white/5 px-2.5 py-1 text-muted">
                          {MUSCLE_LABEL[m]}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Section>

          <Section title="Preparación">
            <ul className="space-y-2">
              {ex.setup.map(s => (
                <li key={s} className="flex gap-3 text-[15px] text-fg/85">
                  <Check className="mt-0.5 size-4 shrink-0 text-success" />
                  {s}
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Ejecución paso a paso">
            <ol className="space-y-3">
              {ex.steps.map((s, i) => (
                <li key={s} className="flex gap-3 text-[15px]">
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white/8 text-xs font-bold tabular">{i + 1}</span>
                  <span className="pt-0.5 text-fg/85">{s}</span>
                </li>
              ))}
            </ol>
          </Section>

          <Section title="Claves del coach" icon={<Lightbulb className="size-4 text-warn" />}>
            <div className="flex flex-wrap gap-2">
              {ex.cues.map(c => (
                <span key={c} className="rounded-full border border-warn/25 bg-warn/8 px-3 py-1.5 text-sm text-warn">
                  “{c}”
                </span>
              ))}
            </div>
          </Section>

          <Section title="Errores comunes">
            <div className="space-y-2.5">
              {ex.mistakes.map(m => (
                <div key={m.mistake} className="rounded-2xl border border-line bg-white/[0.02] p-3.5">
                  <div className="flex gap-2 text-[15px] font-semibold">
                    <XCircle className="mt-0.5 size-4 shrink-0 text-brand" /> {m.mistake}
                  </div>
                  <div className="mt-1.5 flex gap-2 text-sm text-muted">
                    <Check className="mt-0.5 size-4 shrink-0 text-success" /> {m.fix}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <div className="grid gap-3 sm:grid-cols-2">
            <Note icon={<Wind className="size-4 text-sky" />} title="Respiración" text={ex.breathing} />
            <Note icon={<ShieldCheck className="size-4 text-success" />} title="Seguridad" text={ex.safety} />
          </div>

          {(ex.easier?.length || ex.harder?.length) && (
            <Section title="Variantes y progresiones">
              <div className="grid gap-2 sm:grid-cols-2">
                {ex.easier?.map(id => <Variant key={id} id={id} kind="easier" />)}
                {ex.harder?.map(id => <Variant key={id} id={id} kind="harder" />)}
              </div>
            </Section>
          )}
        </div>
      </div>

      <CompareSheet open={compare} onClose={() => setCompare(false)} demoId={ex.demo} name={ex.name} />
    </div>
  );
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="card p-3">
      <div className="mb-1 text-muted">{icon}</div>
      <div className="truncate text-[15px] font-bold">{value}</div>
      <div className="text-[11px] text-muted">{label}</div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="card p-5">
      <h2 className="mb-3 flex items-center gap-2 font-bold">
        {icon}
        {title}
      </h2>
      {children}
    </section>
  );
}

function Note({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="card p-4">
      <div className="mb-1 flex items-center gap-2 text-sm font-bold">
        {icon} {title}
      </div>
      <p className="text-sm text-muted">{text}</p>
    </div>
  );
}

function Variant({ id, kind }: { id: string; kind: "easier" | "harder" }) {
  const v = getExercise(id);
  if (!v) return null;
  return (
    <Link href={`/tecnica/${v.id}`} className="card card-hover flex items-center gap-3 p-2.5 pr-4">
      <div className="h-16 w-20 shrink-0 rounded-xl bg-white/[0.03]">
        <DemoThumb demoId={v.demo} className="size-full" />
      </div>
      <div className="min-w-0 flex-1">
        <div className={cn("flex items-center gap-1 text-[11px] font-semibold uppercase", kind === "easier" ? "text-success" : "text-ember")}>
          {kind === "easier" ? <ArrowDownRight className="size-3.5" /> : <ArrowUpRight className="size-3.5" />}
          {kind === "easier" ? "Más fácil" : "Más difícil"}
        </div>
        <div className="truncate text-sm font-semibold">{v.name}</div>
      </div>
    </Link>
  );
}

/**
 * Self-review: record or pick a clip of your own set and watch it next to
 * the reference demo. Runs entirely on the device; nothing is uploaded.
 */
function CompareSheet({ open, onClose, demoId, name }: { open: boolean; onClose: () => void; demoId: string; name: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => () => void (url && URL.revokeObjectURL(url)), [url]);
  return (
    <Sheet open={open} onClose={onClose} title="Compara tu técnica" className="sm:max-w-3xl">
      <p className="mb-4 text-sm text-muted">
        Grábate de lado haciendo {name.toLowerCase()} y míralo junto a la demostración. El video se queda en tu teléfono.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-line bg-ink-950">
          {url ? (
            <video src={url} controls playsInline loop className="aspect-[4/3] w-full bg-black object-contain" />
          ) : (
            <label className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-2 text-center text-sm text-muted hover:text-fg">
              <Camera className="size-8" />
              Grabar o elegir video
              <input
                type="file"
                accept="video/*"
                capture="environment"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) setUrl(URL.createObjectURL(f));
                }}
              />
            </label>
          )}
        </div>
        <FormDemo demoId={demoId} />
      </div>
      <div className="mt-4 rounded-2xl border border-sky/25 bg-sky/8 p-3 text-sm text-sky-300">
        Con el plan Elite podrás enviar este video a un coach y recibir correcciones en 48 h.
      </div>
    </Sheet>
  );
}
