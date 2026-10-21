import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Dumbbell, Flame, HeartPulse, Home as HomeIcon, Scale, Sparkles, Target, Trophy } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { Logo } from "@/components/layout/AppShell";
import { DemoThumb } from "@/components/technique/FormDemo";
import { Button, Stepper, Toggle } from "@/components/ui";
import { EQUIPMENT_LABEL } from "@/data/exercises";
import { PROGRAMS } from "@/data/programs";
import { ACTIVITY_LABEL, GOAL_LABEL, targetsFor, tdee } from "@/lib/nutrition";
import { actions } from "@/lib/store";
import type { Activity, Equipment, Goal, Level, Place, Profile } from "@/lib/types";
import { cn } from "@/lib/utils";

const STEPS = ["Bienvenida", "Tú", "Objetivo", "Cuerpo", "Nivel", "Lugar", "Agenda", "Detalles", "Plan"];

function Option({
  selected,
  onClick,
  icon,
  title,
  text,
}: {
  selected: boolean;
  onClick: () => void;
  icon?: ReactNode;
  title: string;
  text?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition active:scale-[0.99]",
        selected ? "border-brand bg-brand/10" : "border-line bg-ink-900 hover:border-line-strong"
      )}
    >
      {icon && (
        <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", selected ? "bg-gradient-brand text-white" : "bg-white/6 text-muted")}>
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        {text && <span className="block text-[13px] text-muted">{text}</span>}
      </span>
      <span className={cn("grid size-6 shrink-0 place-items-center rounded-full border", selected ? "border-brand bg-brand" : "border-line-strong")}>
        {selected && <Check className="size-3.5 text-white" strokeWidth={3} />}
      </span>
    </button>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-ink-900 p-3 pl-4">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </div>
  );
}

const GOAL_ICON: Record<Goal, ReactNode> = {
  perder: <Flame className="size-5" />,
  musculo: <Dumbbell className="size-5" />,
  recomposicion: <Scale className="size-5" />,
  fuerza: <Trophy className="size-5" />,
  salud: <HeartPulse className="size-5" />,
};

const GOAL_TEXT: Record<Goal, string> = {
  perder: "Bajar grasa manteniendo el músculo",
  musculo: "Hipertrofia con superávit ligero",
  recomposicion: "Perder grasa y ganar músculo a la vez",
  fuerza: "Levantar más en los básicos",
  salud: "Moverte mejor y tener energía",
};

export default function Onboarding() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [demo, setDemo] = useState(true);
  const [p, setP] = useState<Profile>({
    name: "",
    sex: "hombre",
    age: 28,
    heightCm: 175,
    weightKg: 78,
    targetWeightKg: 74,
    goal: "recomposicion",
    level: "principiante",
    place: "gym",
    equipment: [],
    daysPerWeek: 3,
    minutes: 45,
    activity: "ligero",
    injuries: [],
    units: "kg",
    diet: "omnivora",
  });
  const up = (patch: Partial<Profile>) => setP(x => ({ ...x, ...patch }));

  const targets = useMemo(() => targetsFor(p), [p]);
  const recommended = useMemo(() => {
    const byPlace = PROGRAMS.filter(x => p.place === "ambos" || x.place === p.place || x.place === "ambos");
    return (
      byPlace.find(x => x.goal === p.goal && x.level === p.level) ??
      byPlace.find(x => x.goal === p.goal) ??
      byPlace.find(x => x.level === p.level) ??
      PROGRAMS[0]!
    );
  }, [p]);

  const canNext = step !== 1 || p.name.trim().length > 1;
  const go = (d: number) => {
    setDir(d);
    setStep(s => Math.max(0, Math.min(STEPS.length - 1, s + d)));
  };

  const finish = () => {
    actions.setProfile({ ...p, name: p.name.trim() });
    actions.enroll(recommended.id);
    if (demo) actions.seedDemo();
    navigate("/");
  };

  return (
    <div className="relative mx-auto flex min-h-dvh max-w-xl flex-col px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(70%_50%_at_80%_0%,rgb(255_59_78/0.18),transparent_70%),radial-gradient(60%_40%_at_0%_100%,rgb(60_123_255/0.14),transparent_70%)]" />
      <div className="flex h-12 items-center justify-between">
        {step > 0 ? (
          <button onClick={() => go(-1)} className="grid size-10 place-items-center rounded-full bg-white/6" aria-label="Atrás">
            <ArrowLeft className="size-5" />
          </button>
        ) : (
          <Logo />
        )}
        {step > 0 && (
          <div className="flex flex-1 justify-center gap-1.5 px-6">
            {STEPS.slice(1).map((_, i) => (
              <span key={i} className={cn("h-1 flex-1 rounded-full transition-colors", i < step ? "bg-brand" : "bg-white/10")} />
            ))}
          </div>
        )}
        {step > 0 && <span className="w-10 text-right text-xs text-muted tabular">{step}/{STEPS.length - 1}</span>}
      </div>

      <div className="relative flex-1">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            initial={{ opacity: 0, x: dir * 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir * -40 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="pt-6"
          >
            {step === 0 && (
              <div className="flex flex-col">
                <div className="relative -mx-5 mb-2 h-[min(340px,38dvh)] overflow-hidden">
                  <div className="absolute inset-0 bg-[radial-gradient(50%_60%_at_50%_60%,rgb(255_59_78/0.25),transparent_70%)]" />
                  <span className="title-display absolute inset-x-0 top-6 text-center text-[120px] text-white/[0.05]">AMERICAN</span>
                  <DemoThumb demoId="squat_barbell" animate className="relative mx-auto h-full" />
                </div>
                <h1 className="title-display text-6xl">
                  Entrena con <span className="text-gradient-brand">técnica perfecta</span>
                </h1>
                <p className="mt-3 text-[15px] leading-relaxed text-muted">
                  Demostraciones de cada ejercicio, planes que se adaptan a ti, nutrición inteligente y clases en vivo con coaches reales.
                </p>
                <div className="mt-6 grid grid-cols-3 gap-2 text-center text-xs text-muted">
                  {[
                    ["30+", "Ejercicios guiados"],
                    ["12", "Clases en vivo / sem"],
                    ["6", "Programas"],
                  ].map(([n, l]) => (
                    <div key={l} className="card p-3">
                      <div className="title-display text-3xl text-fg">{n}</div>
                      {l}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-5">
                <Title title="¿Cómo te llamas?" text="Así te saludarán tus coaches." />
                <input
                  autoFocus
                  value={p.name}
                  onChange={e => up({ name: e.target.value })}
                  placeholder="Tu nombre"
                  className="h-14 w-full rounded-2xl border border-line bg-ink-900 px-4 text-lg font-semibold outline-none focus:border-brand"
                />
                <div className="grid grid-cols-2 gap-3">
                  {(["hombre", "mujer"] as const).map(s => (
                    <Option key={s} selected={p.sex === s} onClick={() => up({ sex: s })} title={s === "hombre" ? "Hombre" : "Mujer"} />
                  ))}
                </div>
                <p className="text-xs text-faint">Usamos el sexo biológico solo para estimar tu metabolismo basal (fórmula Mifflin–St Jeor).</p>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-3">
                <Title title="¿Cuál es tu objetivo?" text="Ajustamos entrenamiento y calorías a esto." />
                {(Object.keys(GOAL_LABEL) as Goal[]).map(g => (
                  <Option key={g} selected={p.goal === g} onClick={() => up({ goal: g })} icon={GOAL_ICON[g]} title={GOAL_LABEL[g]} text={GOAL_TEXT[g]} />
                ))}
              </div>
            )}

            {step === 3 && (
              <div className="space-y-3">
                <Title title="Tus medidas" text="Para calcular tu gasto calórico y tus macros." />
                <Field label="Edad">
                  <Stepper value={p.age} onChange={v => up({ age: Math.round(v) })} suffix="años" />
                </Field>
                <Field label="Estatura">
                  <Stepper value={p.heightCm} onChange={v => up({ heightCm: v })} suffix="cm" />
                </Field>
                <Field label="Peso actual">
                  <Stepper value={p.weightKg} step={0.5} onChange={v => up({ weightKg: v })} suffix="kg" />
                </Field>
                <Field label="Peso objetivo">
                  <Stepper value={p.targetWeightKg} step={0.5} onChange={v => up({ targetWeightKg: v })} suffix="kg" />
                </Field>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-3">
                <Title title="Tu experiencia" text="Elegimos ejercicios y volumen a tu medida." />
                {(
                  [
                    ["principiante", "Principiante", "Menos de 6 meses entrenando"],
                    ["intermedio", "Intermedio", "6 meses a 2 años, conozco los básicos"],
                    ["avanzado", "Avanzado", "Más de 2 años con buena técnica"],
                  ] as [Level, string, string][]
                ).map(([v, t, d]) => (
                  <Option key={v} selected={p.level === v} onClick={() => up({ level: v })} title={t} text={d} />
                ))}
                <div className="eyebrow pt-3">Actividad diaria</div>
                <select
                  value={p.activity}
                  onChange={e => up({ activity: e.target.value as Activity })}
                  className="h-12 w-full rounded-2xl border border-line bg-ink-900 px-4 text-sm outline-none"
                >
                  {(Object.keys(ACTIVITY_LABEL) as Activity[]).map(a => (
                    <option key={a} value={a}>
                      {ACTIVITY_LABEL[a]}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {step === 5 && (
              <div className="space-y-3">
                <Title title="¿Dónde entrenas?" />
                {(
                  [
                    ["gym", "Gimnasio", "Acceso a barras, máquinas y poleas", <Dumbbell key="g" className="size-5" />],
                    ["casa", "Casa", "Peso corporal o poco material", <HomeIcon key="c" className="size-5" />],
                    ["ambos", "Ambos", "Me adapto según el día", <Sparkles key="a" className="size-5" />],
                  ] as [Place, string, string, ReactNode][]
                ).map(([v, t, d, icon]) => (
                  <Option key={v} selected={p.place === v} onClick={() => up({ place: v })} title={t} text={d} icon={icon} />
                ))}
                {p.place !== "gym" && (
                  <>
                    <div className="eyebrow pt-3">Material en casa</div>
                    <div className="flex flex-wrap gap-2">
                      {(["dumbbell", "kettlebell", "band", "pullupBar", "bench", "barbell"] as Equipment[]).map(e => {
                        const on = p.equipment.includes(e);
                        return (
                          <button
                            key={e}
                            onClick={() => up({ equipment: on ? p.equipment.filter(x => x !== e) : [...p.equipment, e] })}
                            className={cn("h-10 rounded-full border px-4 text-sm", on ? "border-fg bg-fg text-ink-950" : "border-line bg-ink-900 text-muted")}
                          >
                            {EQUIPMENT_LABEL[e]}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {step === 6 && (
              <div className="space-y-5">
                <Title title="Tu semana" text="Sé realista: la constancia gana a la intensidad." />
                <div>
                  <div className="eyebrow mb-2">Días por semana</div>
                  <div className="grid grid-cols-6 gap-2">
                    {[2, 3, 4, 5, 6, 7].map(d => (
                      <button
                        key={d}
                        onClick={() => up({ daysPerWeek: d })}
                        className={cn("h-14 rounded-2xl border text-lg font-bold", p.daysPerWeek === d ? "border-brand bg-brand/12" : "border-line bg-ink-900 text-muted")}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="eyebrow mb-2">Minutos por sesión</div>
                  <div className="grid grid-cols-5 gap-2">
                    {[20, 30, 45, 60, 75].map(m => (
                      <button
                        key={m}
                        onClick={() => up({ minutes: m })}
                        className={cn("h-14 rounded-2xl border font-bold", p.minutes === m ? "border-brand bg-brand/12" : "border-line bg-ink-900 text-muted")}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {step === 7 && (
              <div className="space-y-5">
                <Title title="Últimos detalles" />
                <div>
                  <div className="eyebrow mb-2">Alimentación</div>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        ["omnivora", "Como de todo"],
                        ["vegetariana", "Vegetariana"],
                        ["vegana", "Vegana"],
                        ["sin-gluten", "Sin gluten"],
                      ] as [Profile["diet"], string][]
                    ).map(([v, l]) => (
                      <button
                        key={v}
                        onClick={() => up({ diet: v })}
                        className={cn("h-12 rounded-2xl border text-sm font-medium", p.diet === v ? "border-brand bg-brand/12" : "border-line bg-ink-900 text-muted")}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="eyebrow mb-2">¿Alguna molestia? (opcional)</div>
                  <div className="flex flex-wrap gap-2">
                    {["Rodilla", "Hombro", "Espalda baja", "Muñeca", "Cadera", "Cuello"].map(z => {
                      const on = p.injuries.includes(z);
                      return (
                        <button
                          key={z}
                          onClick={() => up({ injuries: on ? p.injuries.filter(x => x !== z) : [...p.injuries, z] })}
                          className={cn("h-10 rounded-full border px-4 text-sm", on ? "border-warn bg-warn/15 text-warn" : "border-line bg-ink-900 text-muted")}
                        >
                          {z}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2 text-xs text-faint">Te mostraremos variantes más amables. Si tienes dolor, consulta a un profesional de la salud.</p>
                </div>
              </div>
            )}

            {step === 8 && (
              <div className="space-y-4">
                <Title title={`Listo, ${p.name.split(" ")[0] || "atleta"}`} text="Este es tu punto de partida. Se ajusta solo a medida que registras." />
                <div className="card overflow-hidden">
                  <div className="flex items-center gap-3 border-b border-line p-4">
                    <Target className="size-5 text-brand" />
                    <span className="font-semibold">{GOAL_LABEL[p.goal]}</span>
                    <span className="ml-auto text-xs text-muted">Mantenimiento ≈ {tdee(p).toLocaleString("es")} kcal</span>
                  </div>
                  <div className="grid grid-cols-4 divide-x divide-line text-center">
                    {[
                      ["kcal", targets.kcal, ""],
                      ["Proteína", targets.protein, "g"],
                      ["Carbs", targets.carbs, "g"],
                      ["Grasa", targets.fat, "g"],
                    ].map(([l, v, u]) => (
                      <div key={l as string} className="p-3">
                        <div className="tabular text-lg font-bold">
                          {(v as number).toLocaleString("es")}
                          <span className="text-xs text-muted">{u}</span>
                        </div>
                        <div className="text-[11px] text-muted">{l}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="card flex items-center gap-4 p-4">
                  <div className="grid size-14 shrink-0 place-items-center rounded-2xl" style={{ background: `hsl(${recommended.hue} 70% 50% / 0.18)` }}>
                    <Dumbbell className="size-6" style={{ color: `hsl(${recommended.hue} 90% 65%)` }} />
                  </div>
                  <div className="min-w-0">
                    <div className="eyebrow">Programa recomendado</div>
                    <div className="font-semibold">{recommended.name}</div>
                    <div className="text-[13px] text-muted">
                      {recommended.weeks} semanas · {recommended.daysPerWeek} días · {recommended.minutes} min
                    </div>
                  </div>
                </div>
                <div className="card flex items-center gap-4 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">Cargar historial de ejemplo</div>
                    <div className="text-[13px] text-muted">4 semanas de entrenos, peso y comidas para explorar la app. Puedes borrarlo en Perfil.</div>
                  </div>
                  <Toggle checked={demo} onChange={setDemo} label="Cargar historial de ejemplo" />
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="sticky bottom-0 -mx-5 bg-gradient-to-t from-ink-950 via-ink-950/95 to-transparent px-5 pb-1 pt-8">
        {step < STEPS.length - 1 ? (
          <Button size="lg" className="w-full" disabled={!canNext} onClick={() => go(1)}>
            {step === 0 ? "Empezar" : "Continuar"} <ArrowRight className="size-5" />
          </Button>
        ) : (
          <Button size="lg" className="w-full" onClick={finish}>
            Comenzar a entrenar <ArrowRight className="size-5" />
          </Button>
        )}
      </div>
    </div>
  );
}

function Title({ title, text }: { title: string; text?: string }) {
  return (
    <div className="mb-2">
      <h1 className="title-display text-5xl">{title}</h1>
      {text && <p className="mt-1 text-muted">{text}</p>}
    </div>
  );
}
