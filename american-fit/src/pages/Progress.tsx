import { Dumbbell, Flame, Plus, Scale, Target, Trophy } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { ColumnChart, TrendChart } from "@/components/charts";
import { Button, Empty, PageHeader, Segmented, Sheet, Stat, Stepper } from "@/components/ui";
import { getExercise } from "@/data/exercises";
import { movingAverage } from "@/lib/nutrition";
import { actions, useApp } from "@/lib/store";
import { e1rm, weeklyStreak } from "@/lib/training";
import { addDays, cn, dayKey, fmtDayMonth, fromDayKey } from "@/lib/utils";

export default function Progress() {
  const profile = useApp(s => s.profile)!;
  const workouts = useApp(s => s.workouts);
  const weights = useApp(s => s.weights);
  const [range, setRange] = useState<"30" | "90" | "all">("30");
  const [logOpen, setLogOpen] = useState(false);
  const [kg, setKg] = useState(profile.weightKg);

  const weightData = useMemo(() => {
    const cutoff = range === "all" ? "" : dayKey(addDays(new Date(), -Number(range)));
    return movingAverage(weights)
      .filter(p => p.date >= cutoff)
      .map(p => ({ label: fmtDayMonth(fromDayKey(p.date)), value: p.kg, trend: Math.round(p.avg * 10) / 10 }));
  }, [weights, range]);

  const weekly = useMemo(() => {
    const now = new Date();
    const monday = new Date(now);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    return Array.from({ length: 8 }, (_, i) => {
      const start = addDays(monday, (i - 7) * 7);
      const end = addDays(start, 7);
      const vol = workouts
        .filter(w => w.startedAt >= start.getTime() && w.startedAt < end.getTime())
        .reduce((a, w) => a + w.volume, 0);
      return { label: fmtDayMonth(start), value: vol };
    });
  }, [workouts]);

  const records = useMemo(() => {
    const best: Record<string, { value: number; date: string }> = {};
    for (const w of workouts)
      for (const e of w.exercises)
        for (const s of e.sets) {
          const v = e1rm(s.weight, s.reps);
          if (v > (best[e.exerciseId]?.value ?? 0)) best[e.exerciseId] = { value: v, date: w.date };
        }
    return Object.entries(best)
      .sort((a, b) => b[1].value - a[1].value)
      .slice(0, 8);
  }, [workouts]);

  const heat = useMemo(() => {
    const days = new Set(workouts.map(w => w.date));
    return Array.from({ length: 35 }, (_, i) => {
      const d = addDays(new Date(), i - 34);
      return { d, on: days.has(dayKey(d)) };
    });
  }, [workouts]);

  const totalTime = workouts.reduce((a, w) => a + w.durationSec, 0);
  const totalVolume = workouts.reduce((a, w) => a + w.volume, 0);
  const lastW = weights.at(-1)?.kg ?? profile.weightKg;
  const firstW = weightData[0]?.value ?? lastW;
  const toGoal = lastW - profile.targetWeightKg;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tus números"
        title="Progreso"
        actions={
          <Button size="sm" onClick={() => setLogOpen(true)}>
            <Plus className="size-4" /> Peso
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card p-4">
          <Dumbbell className="mb-2 size-5 text-brand" />
          <Stat label="Entrenos" value={workouts.length} />
        </div>
        <div className="card p-4">
          <Flame className="mb-2 size-5 text-ember" />
          <Stat label="Semanas seguidas" value={weeklyStreak(workouts)} />
        </div>
        <div className="card p-4">
          <Trophy className="mb-2 size-5 text-warn" />
          <Stat label="Volumen total" value={Math.round(totalVolume / 1000).toLocaleString("es")} unit="t" />
        </div>
        <div className="card p-4">
          <Target className="mb-2 size-5 text-sky" />
          <Stat label="Tiempo entrenando" value={(Math.round(totalTime / 360) / 10).toLocaleString("es")} unit="h" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-5">
          <div className="mb-1 flex items-start justify-between gap-3">
            <div>
              <h2 className="font-bold">Peso corporal</h2>
              <p className="text-sm text-muted">Tendencia de 7 días sobre las mediciones diarias</p>
            </div>
            <Segmented
              value={range}
              onChange={setRange}
              options={[
                { value: "30", label: "30 d" },
                { value: "90", label: "90 d" },
                { value: "all", label: "Todo" },
              ]}
            />
          </div>
          <div className="my-3 flex items-baseline gap-3">
            <span className="tabular text-3xl font-bold">{lastW.toLocaleString("es")} kg</span>
            <span className={cn("tabular text-sm font-semibold", lastW - firstW <= 0 ? "text-success" : "text-warn")}>
              {lastW - firstW > 0 ? "+" : ""}
              {(Math.round((lastW - firstW) * 10) / 10).toLocaleString("es")} kg
            </span>
            <span className="text-xs text-muted">
              {Math.abs(toGoal) < 0.3 ? "¡En tu objetivo!" : `${Math.abs(Math.round(toGoal * 10) / 10).toLocaleString("es")} kg para tu meta`}
            </span>
          </div>
          {weightData.length > 1 ? (
            <TrendChart data={weightData} unit="kg" />
          ) : (
            <Empty icon={<Scale className="size-5" />} title="Registra tu peso" text="Con dos o más registros verás tu tendencia." />
          )}
        </section>

        <section className="card p-5">
          <h2 className="font-bold">Volumen semanal</h2>
          <p className="mb-4 text-sm text-muted">Kilos totales levantados (series × reps × peso)</p>
          <ColumnChart data={weekly} unit="kg" height={220} />
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <section className="card p-5">
          <h2 className="mb-3 font-bold">Constancia · últimas 5 semanas</h2>
          <div className="grid grid-cols-7 gap-1.5">
            {["L", "M", "X", "J", "V", "S", "D"].map(d => (
              <span key={d} className="text-center text-xs text-faint">
                {d}
              </span>
            ))}
            {Array.from({ length: (heat[0]!.d.getDay() + 6) % 7 }, (_, i) => (
              <span key={`pad${i}`} />
            ))}
            {heat.map(({ d, on }) => (
              <span
                key={d.toISOString()}
                title={fmtDayMonth(d)}
                className={cn("aspect-square rounded-lg", on ? "bg-gradient-brand" : "bg-fg/5", dayKey(d) === dayKey() && "ring-1 ring-fg/50")}
              />
            ))}
          </div>
        </section>

        <section className="card p-5">
          <h2 className="mb-3 font-bold">Mejores marcas (1RM estimado)</h2>
          {records.length === 0 ? (
            <p className="text-sm text-muted">Registra series con peso para ver tus récords.</p>
          ) : (
            <ul className="divide-y divide-line">
              {records.map(([id, r]) => (
                <li key={id}>
                  <Link href={`/tecnica/${id}`} className="flex items-center justify-between py-2.5 text-sm hover:text-fg">
                    <span className="font-medium">{getExercise(id)?.name}</span>
                    <span className="flex items-baseline gap-2">
                      <span className="tabular font-bold">{r.value} kg</span>
                      <span className="text-xs text-faint">{fmtDayMonth(fromDayKey(r.date))}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <Sheet open={logOpen} onClose={() => setLogOpen(false)} title="Registrar peso de hoy">
        <div className="flex flex-col items-center gap-4 py-4">
          <Stepper value={kg} step={0.1} onChange={setKg} suffix="kg" className="scale-125" />
          <p className="text-center text-xs text-muted">Pésate por la mañana, en ayunas y después de ir al baño para datos comparables.</p>
          <Button
            size="lg"
            className="w-full"
            onClick={() => {
              actions.logWeight(Math.round(kg * 10) / 10);
              setLogOpen(false);
            }}
          >
            Guardar
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
