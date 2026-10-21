import { ChevronRight, Download, LineChart, LogOut, RotateCcw, Sparkles, Trash2, Trophy } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Avatar, Badge, Button, PageHeader, Segmented, Sheet, Stepper } from "@/components/ui";
import { PROGRAM_BY_ID } from "@/data/programs";
import { ACTIVITY_LABEL, GOAL_LABEL, targetsFor, tdee } from "@/lib/nutrition";
import { actions, getState, useApp } from "@/lib/store";
import type { Activity, Goal, Level } from "@/lib/types";

export default function Profile() {
  const [, navigate] = useLocation();
  const profile = useApp(s => s.profile)!;
  const plan = useApp(s => s.plan);
  const enrolled = useApp(s => s.enrolled);
  const hasDemo = useApp(s => s.hasDemoData);
  const workouts = useApp(s => s.workouts.length);
  const [confirmReset, setConfirmReset] = useState(false);
  const t = targetsFor(profile);

  const exportData = () => {
    const blob = new Blob([JSON.stringify(getState(), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `american-fit-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader eyebrow="Tu cuenta" title="Perfil" />

      <section className="card flex items-center gap-4 p-5">
        <Avatar name={profile.name} hue={352} size={64} />
        <div className="min-w-0 flex-1">
          <div className="text-xl font-bold">{profile.name}</div>
          <div className="text-sm text-muted">
            {GOAL_LABEL[profile.goal]} · {workouts} entrenos
          </div>
          <div className="mt-1.5">
            <Badge tone={plan === "free" ? "neutral" : "brand"}>Plan {plan}</Badge>
          </div>
        </div>
        {plan === "free" && (
          <Button size="sm" onClick={() => navigate("/planes")}>
            <Sparkles className="size-4" /> Mejorar
          </Button>
        )}
      </section>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/progreso" className="card card-hover flex items-center gap-3 p-4">
          <LineChart className="size-5 text-sky" />
          <span className="flex-1 font-medium">Progreso y récords</span>
          <ChevronRight className="size-4 text-muted" />
        </Link>
        <Link href="/comunidad" className="card card-hover flex items-center gap-3 p-4">
          <Trophy className="size-5 text-warn" />
          <span className="flex-1 font-medium">Retos y ranking</span>
          <ChevronRight className="size-4 text-muted" />
        </Link>
      </div>

      <section className="card divide-y divide-line">
        <h2 className="p-4 font-bold">Objetivo y cuerpo</h2>
        <Row label="Objetivo">
          <select
            value={profile.goal}
            onChange={e => actions.updateProfile({ goal: e.target.value as Goal })}
            className="h-10 rounded-xl bg-white/6 px-3 text-sm outline-none"
          >
            {(Object.keys(GOAL_LABEL) as Goal[]).map(g => (
              <option key={g} value={g}>
                {GOAL_LABEL[g]}
              </option>
            ))}
          </select>
        </Row>
        <Row label="Peso actual">
          <Stepper value={profile.weightKg} step={0.5} onChange={v => actions.logWeight(v)} suffix="kg" />
        </Row>
        <Row label="Peso objetivo">
          <Stepper value={profile.targetWeightKg} step={0.5} onChange={v => actions.updateProfile({ targetWeightKg: v })} suffix="kg" />
        </Row>
        <Row label="Estatura">
          <Stepper value={profile.heightCm} onChange={v => actions.updateProfile({ heightCm: v })} suffix="cm" />
        </Row>
        <Row label="Edad">
          <Stepper value={profile.age} onChange={v => actions.updateProfile({ age: Math.round(v) })} />
        </Row>
        <Row label="Actividad">
          <select
            value={profile.activity}
            onChange={e => actions.updateProfile({ activity: e.target.value as Activity })}
            className="h-10 max-w-48 rounded-xl bg-white/6 px-3 text-sm outline-none"
          >
            {(Object.keys(ACTIVITY_LABEL) as Activity[]).map(a => (
              <option key={a} value={a}>
                {ACTIVITY_LABEL[a]}
              </option>
            ))}
          </select>
        </Row>
        <div className="grid grid-cols-4 gap-2 p-4 text-center">
          {[
            ["Mantenimiento", tdee(profile)],
            ["Objetivo", t.kcal],
            ["Proteína", `${t.protein} g`],
            ["Agua", `${(t.waterMl / 1000).toLocaleString("es")} L`],
          ].map(([l, v]) => (
            <div key={l} className="rounded-xl bg-white/4 p-2">
              <div className="tabular text-sm font-bold">{typeof v === "number" ? v.toLocaleString("es") : v}</div>
              <div className="text-[10px] text-muted">{l}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="card divide-y divide-line">
        <h2 className="p-4 font-bold">Entrenamiento</h2>
        <Row label="Nivel">
          <Segmented
            value={profile.level}
            onChange={(v: Level) => actions.updateProfile({ level: v })}
            options={[
              { value: "principiante", label: "Inicial" },
              { value: "intermedio", label: "Medio" },
              { value: "avanzado", label: "Avanzado" },
            ]}
          />
        </Row>
        <Row label="Días por semana">
          <Stepper value={profile.daysPerWeek} min={1} onChange={v => actions.updateProfile({ daysPerWeek: Math.min(7, Math.round(v)) })} />
        </Row>
        <Row label="Minutos por sesión">
          <Stepper value={profile.minutes} step={5} min={10} onChange={v => actions.updateProfile({ minutes: v })} />
        </Row>
        <Row label="Programa">
          {enrolled ? (
            <Link href={`/entrenar/programa/${enrolled.programId}`} className="text-sm font-semibold text-sky-300">
              {PROGRAM_BY_ID[enrolled.programId]?.name}
            </Link>
          ) : (
            <Link href="/entrenar" className="text-sm text-muted">
              Elegir
            </Link>
          )}
        </Row>
      </section>

      <section className="card divide-y divide-line">
        <h2 className="p-4 font-bold">Datos</h2>
        {hasDemo && (
          <button onClick={() => actions.clearDemo()} className="flex w-full items-center gap-3 p-4 text-left hover:bg-white/[0.02]">
            <Trash2 className="size-5 text-muted" />
            <span className="flex-1">
              <span className="block font-medium">Borrar entrenos de ejemplo</span>
              <span className="block text-xs text-muted">Conserva todo lo que registraste tú.</span>
            </span>
          </button>
        )}
        <button onClick={exportData} className="flex w-full items-center gap-3 p-4 text-left hover:bg-white/[0.02]">
          <Download className="size-5 text-muted" />
          <span className="flex-1">
            <span className="block font-medium">Exportar mis datos</span>
            <span className="block text-xs text-muted">Entrenos, comidas y peso en un archivo JSON.</span>
          </span>
        </button>
        <button onClick={() => setConfirmReset(true)} className="flex w-full items-center gap-3 p-4 text-left text-brand-300 hover:bg-white/[0.02]">
          <RotateCcw className="size-5" />
          <span className="flex-1 font-medium">Empezar de cero</span>
        </button>
      </section>

      <p className="flex items-center justify-center gap-2 pb-4 text-xs text-faint">
        <LogOut className="size-3.5" /> American Fit v0.1 · tus datos se guardan en este dispositivo
      </p>

      <Sheet open={confirmReset} onClose={() => setConfirmReset(false)} title="¿Borrar todo?">
        <p className="mb-4 text-sm text-muted">Se eliminarán tu perfil, entrenos, comidas y registros de peso de este dispositivo. No se puede deshacer.</p>
        <div className="grid gap-2 pb-2">
          <Button
            variant="danger"
            size="lg"
            onClick={() => {
              actions.resetAll();
              navigate("/bienvenida");
            }}
          >
            Sí, borrar todo
          </Button>
          <Button variant="secondary" onClick={() => setConfirmReset(false)}>
            Cancelar
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <span className="text-sm">{label}</span>
      {children}
    </div>
  );
}
