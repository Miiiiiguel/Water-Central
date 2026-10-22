import { motion } from "framer-motion";
import { Clock, Dumbbell, Flame, Layers, Share2, Trash2, Trophy } from "lucide-react";
import { useLocation, useParams } from "wouter";
import { MuscleMap } from "@/components/body/MuscleMap";
import { Confetti } from "@/components/fx";
import { Button, Stat } from "@/components/ui";
import { getExercise } from "@/data/exercises";
import { actions, useApp } from "@/lib/store";
import { e1rm } from "@/lib/training";
import type { Muscle } from "@/lib/types";
import { fmtDuration, fmtLongDate, fromDayKey } from "@/lib/utils";
import NotFound from "./NotFound";

export default function WorkoutSummary() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const w = useApp(s => s.workouts.find(x => x.id === id));
  if (!w) return <NotFound />;

  const sets = w.exercises.reduce((a, e) => a + e.sets.length, 0);
  const levels: Partial<Record<Muscle, number>> = {};
  for (const e of w.exercises) {
    const ex = getExercise(e.exerciseId);
    ex?.secondary.forEach(m => (levels[m] = Math.max(levels[m] ?? 0, 0.45)));
    ex?.primary.forEach(m => (levels[m] = 1));
  }
  const fresh = Date.now() - w.startedAt - w.durationSec * 1000 < 10 * 60_000;

  const share = async () => {
    const text = `Terminé "${w.name}" en MyGym Community: ${fmtDuration(w.durationSec)}, ${sets} series y ${Math.round(w.volume).toLocaleString("es")} kg de volumen 💪`;
    try {
      if (navigator.share) await navigator.share({ title: "MyGym Community", text });
      else await navigator.clipboard.writeText(text);
    } catch {
      // Share sheet dismissed.
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      {fresh && <Confetti />}
      <motion.section
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="card grain relative mb-5 overflow-hidden p-6 text-center"
      >
        <div className="absolute inset-0 bg-[radial-gradient(70%_80%_at_50%_0%,rgb(139_77_255/0.35),transparent_70%)]" />
        <div className="relative">
          <motion.div
            initial={{ rotate: -20, scale: 0.4 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.1 }}
            className="mx-auto mb-3 grid size-16 place-items-center rounded-2xl bg-gradient-brand shadow-[0_10px_40px_-8px_rgb(139_77_255/0.8)]"
          >
            <Trophy className="size-8 text-white" />
          </motion.div>
          <div className="eyebrow">{fresh ? "¡Entreno completado!" : fmtLongDate(fromDayKey(w.date))}</div>
          <h1 className="title-display mt-1 text-4xl sm:text-5xl">{w.name}</h1>
          <div className="mx-auto mt-5 grid max-w-md grid-cols-3 gap-3 text-left">
            <div className="rounded-2xl bg-black/25 p-3">
              <Clock className="mb-1 size-4 text-muted" />
              <Stat label="Duración" value={fmtDuration(w.durationSec)} />
            </div>
            <div className="rounded-2xl bg-black/25 p-3">
              <Layers className="mb-1 size-4 text-muted" />
              <Stat label="Series" value={sets} />
            </div>
            <div className="rounded-2xl bg-black/25 p-3">
              <Dumbbell className="mb-1 size-4 text-muted" />
              <Stat label="Volumen" value={Math.round(w.volume).toLocaleString("es")} unit="kg" />
            </div>
          </div>
        </div>
      </motion.section>

      {w.prs.length > 0 && (
        <section className="card mb-5 border-warn/30 p-5">
          <h2 className="mb-3 flex items-center gap-2 font-bold">
            <Flame className="size-5 text-warn" /> Récords personales
          </h2>
          <ul className="space-y-2">
            {w.prs.map(pr => (
              <li key={pr.exerciseId} className="flex items-center justify-between rounded-xl bg-warn/8 px-3 py-2 text-sm">
                <span className="font-medium">{getExercise(pr.exerciseId)?.name}</span>
                <span className="tabular font-bold text-warn">{pr.e1rm} kg 1RM est.</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-5 sm:grid-cols-[1fr_200px]">
        <section className="card divide-y divide-line">
          {w.exercises.map(e => {
            const ex = getExercise(e.exerciseId);
            const best = Math.max(0, ...e.sets.map(s => e1rm(s.weight, s.reps)));
            return (
              <div key={e.exerciseId} className="p-4">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{ex?.name}</span>
                  {best > 0 && <span className="tabular text-xs text-muted">1RM est. {best} kg</span>}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {e.sets.map((s, i) => (
                    <span key={i} className="tabular rounded-lg bg-fg/6 px-2 py-1 text-xs">
                      {s.weight ? `${s.weight} × ${s.reps}` : `${s.reps}${ex?.loadType === "time" ? " s" : ""}`}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </section>
        <section className="card p-4">
          <div className="eyebrow mb-2 text-center">Músculos trabajados</div>
          <MuscleMap levels={levels} className="h-56" />
        </section>
      </div>

      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        <Button size="lg" onClick={() => navigate("/")}>
          Volver al inicio
        </Button>
        <Button size="lg" variant="secondary" onClick={share}>
          <Share2 className="size-4" /> Compartir
        </Button>
      </div>
      <button
        onClick={() => {
          actions.deleteWorkout(w.id);
          navigate("/entrenar");
        }}
        className="mx-auto mt-4 flex items-center gap-1.5 py-2 text-sm text-faint hover:text-brand"
      >
        <Trash2 className="size-4" /> Borrar este entreno
      </button>
    </div>
  );
}
