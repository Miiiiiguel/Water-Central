import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown, Info, Minus, MoreHorizontal, Plus, Repeat, Search, SkipForward, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { MUSCLE_LABEL } from "@/components/body/MuscleMap";
import { DemoThumb } from "@/components/technique/FormDemo";
import { Button, Empty, Sheet } from "@/components/ui";
import { EXERCISES, getExercise } from "@/data/exercises";
import { actions, useApp } from "@/lib/store";
import { doneSets, lastPerformance, sessionVolume } from "@/lib/training";
import type { SessionExercise } from "@/lib/types";
import { cn, fmtDuration, normalize } from "@/lib/utils";

function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.18, 0.36].forEach((t, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = i === 2 ? 1046 : 784;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.15);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.16);
    });
    setTimeout(() => ctx.close(), 800);
  } catch {
    // Audio is a nicety; ignore browsers that block it.
  }
  navigator.vibrate?.([120, 80, 120]);
}

function useTick(ms = 1000) {
  const [, set] = useState(0);
  useEffect(() => {
    const t = setInterval(() => set(x => x + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
}

export default function WorkoutPlayer() {
  const [, navigate] = useLocation();
  const active = useApp(s => s.active);
  const workouts = useApp(s => s.workouts);
  useTick();
  const [rest, setRest] = useState<{ until: number; total: number; label: string } | null>(null);
  const [picker, setPicker] = useState<{ mode: "add" } | { mode: "swap"; index: number } | null>(null);
  const [menu, setMenu] = useState<number | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const beeped = useRef(false);

  const remaining = rest ? Math.max(0, Math.ceil((rest.until - Date.now()) / 1000)) : 0;
  useEffect(() => {
    if (!rest) return;
    if (remaining === 0 && !beeped.current) {
      beeped.current = true;
      beep();
      const t = setTimeout(() => setRest(null), 1500);
      return () => clearTimeout(t);
    }
  }, [remaining, rest]);

  if (!active) {
    return (
      <div className="pt-10">
        <Empty
          icon={<Check className="size-5" />}
          title="No hay entreno en curso"
          text="Empieza tu programa o genera un entreno inteligente."
          action={<Button onClick={() => navigate("/entrenar")}>Ir a entrenar</Button>}
        />
      </div>
    );
  }

  const elapsed = (Date.now() - active.startedAt) / 1000;
  const total = active.exercises.reduce((a, e) => a + e.sets.length, 0);
  const done = doneSets(active.exercises);
  const volume = sessionVolume(active.exercises);

  const toggleSet = (ei: number, si: number, e: SessionExercise) => {
    const set = e.sets[si]!;
    actions.updateSet(ei, si, { done: !set.done });
    if (!set.done && e.target.rest > 0) {
      beeped.current = false;
      const ex = getExercise(e.exerciseId);
      setRest({ until: Date.now() + e.target.rest * 1000, total: e.target.rest, label: ex?.name ?? "" });
    }
  };

  const finish = () => {
    const log = actions.finishSession();
    navigate(log ? `/entrenar/resumen/${log.id}` : "/entrenar");
  };

  return (
    <div className="mx-auto max-w-2xl">
      <header className="glass sticky top-0 z-30 -mx-4 mb-4 border-b border-line px-4 py-3 sm:-mx-6 sm:px-6 lg:mx-0 lg:rounded-b-2xl">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/")} className="grid size-10 place-items-center rounded-full bg-white/6" aria-label="Minimizar">
            <ChevronDown className="size-5" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{active.name}</div>
            <div className="tabular text-xs text-muted">
              {fmtDuration(elapsed)} · {done}/{total} series · {Math.round(volume).toLocaleString("es")} kg
            </div>
          </div>
          <Button size="sm" onClick={() => setConfirmEnd(true)}>
            Terminar
          </Button>
        </div>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/8">
          <motion.div className="h-full bg-gradient-brand" animate={{ width: `${total ? (done / total) * 100 : 0}%` }} />
        </div>
      </header>

      <div className="space-y-4">
        {active.exercises.map((e, ei) => {
          const ex = getExercise(e.exerciseId);
          if (!ex) return null;
          const last = lastPerformance(workouts, ex.id);
          const timeBased = ex.loadType === "time";
          const bodyweight = ex.loadType === "bodyweight";
          const complete = e.sets.every(s => s.done);
          return (
            <section key={`${e.exerciseId}-${ei}`} className={cn("card overflow-hidden transition-colors", complete && "border-success/30")}>
              <div className="flex items-center gap-3 p-3 pr-2">
                <Link href={`/tecnica/${ex.id}`} className="h-16 w-20 shrink-0 rounded-xl bg-white/[0.03]">
                  <DemoThumb demoId={ex.demo} animate={!complete} className="size-full" />
                </Link>
                <div className="min-w-0 flex-1">
                  <Link href={`/tecnica/${ex.id}`} className="block truncate font-semibold hover:underline">
                    {ex.name}
                  </Link>
                  <div className="truncate text-xs text-muted">
                    {e.target.sets} × {e.target.reps} · descanso {fmtDuration(e.target.rest)} · {ex.primary.map(m => MUSCLE_LABEL[m]).join(", ")}
                  </div>
                  {ex.cues[0] && <div className="mt-0.5 truncate text-xs text-warn/90">“{ex.cues[0]}”</div>}
                </div>
                <button onClick={() => setMenu(ei)} className="grid size-9 place-items-center rounded-full text-muted hover:bg-white/6" aria-label="Opciones del ejercicio">
                  <MoreHorizontal className="size-5" />
                </button>
              </div>

              <div className="px-3 pb-3">
                <div className="grid grid-cols-[28px_1fr_76px_76px_44px] items-center gap-2 px-1 pb-1.5 text-xs font-semibold uppercase tracking-wide text-faint">
                  <span>Serie</span>
                  <span>Anterior</span>
                  <span className="text-center">{bodyweight ? "+kg" : timeBased ? "" : "kg"}</span>
                  <span className="text-center">{timeBased ? "seg" : "reps"}</span>
                  <span />
                </div>
                {e.sets.map((s, si) => {
                  const prev = last?.sets[si];
                  return (
                    <div
                      key={si}
                      className={cn(
                        "grid grid-cols-[28px_1fr_76px_76px_44px] items-center gap-2 rounded-xl px-1 py-1 transition-colors",
                        s.done && "bg-success/10"
                      )}
                    >
                      <span className="text-center text-sm font-bold text-muted">{si + 1}</span>
                      <span className="tabular truncate text-xs text-faint">
                        {prev ? (prev.weight ? `${prev.weight} kg × ${prev.reps}` : `${prev.reps}`) : "—"}
                      </span>
                      {timeBased ? (
                        <span />
                      ) : (
                        <input
                          inputMode="decimal"
                          aria-label={`Peso serie ${si + 1}`}
                          value={s.weight || ""}
                          placeholder={prev?.weight ? String(prev.weight) : "0"}
                          onChange={ev => actions.updateSet(ei, si, { weight: Number(ev.target.value.replace(",", ".")) || 0 })}
                          className="tabular h-10 rounded-lg bg-white/6 text-center font-semibold outline-none focus:bg-white/10 placeholder:text-muted"
                        />
                      )}
                      <input
                        inputMode="numeric"
                        aria-label={`Repeticiones serie ${si + 1}`}
                        value={s.reps || ""}
                        placeholder="0"
                        onChange={ev => actions.updateSet(ei, si, { reps: Number(ev.target.value) || 0 })}
                        className="tabular h-10 rounded-lg bg-white/6 text-center font-semibold outline-none focus:bg-white/10"
                      />
                      <button
                        onClick={() => toggleSet(ei, si, e)}
                        className={cn(
                          "grid h-10 place-items-center rounded-lg transition active:scale-90",
                          s.done ? "bg-success text-ink-950" : "bg-white/8 text-muted hover:text-fg"
                        )}
                        aria-label={s.done ? "Desmarcar serie" : "Completar serie"}
                      >
                        <Check className="size-5" strokeWidth={3} />
                      </button>
                    </div>
                  );
                })}
                <div className="mt-2 flex gap-2">
                  <button onClick={() => actions.addSet(ei)} className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-white/5 text-[13px] font-semibold text-muted hover:text-fg">
                    <Plus className="size-4" /> Añadir serie
                  </button>
                  {e.sets.length > 1 && (
                    <button onClick={() => actions.removeSet(ei)} className="grid size-10 place-items-center rounded-xl bg-white/5 text-muted hover:text-fg" aria-label="Quitar serie">
                      <Minus className="size-4" />
                    </button>
                  )}
                </div>
              </div>
            </section>
          );
        })}

        <button
          onClick={() => setPicker({ mode: "add" })}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-3xl border border-dashed border-line-strong text-sm font-semibold text-muted hover:text-fg"
        >
          <Plus className="size-5" /> Añadir ejercicio
        </button>
        <button onClick={() => { actions.discardSession(); navigate("/entrenar"); }} className="mx-auto block py-3 text-sm text-faint hover:text-brand">
          Descartar entreno
        </button>
      </div>

      {/* Rest timer */}
      <AnimatePresence>
        {rest && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 mx-auto max-w-xl"
          >
            <div className="glass overflow-hidden rounded-3xl border border-line-strong shadow-2xl shadow-black/60">
              <div className="h-1 bg-white/8">
                <div className="h-full bg-sky transition-[width] duration-1000 ease-linear" style={{ width: `${(remaining / rest.total) * 100}%` }} />
              </div>
              <div className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1 pl-2">
                  <div className="eyebrow">{remaining === 0 ? "¡A por la siguiente!" : "Descanso"}</div>
                  <div className={cn("tabular title-display text-4xl", remaining === 0 && "text-success")}>{fmtDuration(remaining)}</div>
                </div>
                <button onClick={() => setRest(r => r && { ...r, until: r.until - 15000 })} className="h-11 rounded-full bg-white/8 px-3 text-sm font-semibold">
                  −15
                </button>
                <button onClick={() => setRest(r => r && { ...r, until: r.until + 15000, total: r.total + 15 })} className="h-11 rounded-full bg-white/8 px-3 text-sm font-semibold">
                  +15
                </button>
                <button onClick={() => setRest(null)} className="grid size-11 place-items-center rounded-full bg-fg text-ink-950" aria-label="Saltar descanso">
                  <SkipForward className="size-5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Sheet open={menu !== null} onClose={() => setMenu(null)} title={menu !== null ? getExercise(active.exercises[menu]?.exerciseId ?? "")?.name : ""}>
        {menu !== null && (
          <div className="space-y-2 pb-2">
            <MenuItem icon={<Info className="size-5" />} label="Ver técnica" onClick={() => { const id = active.exercises[menu]!.exerciseId; setMenu(null); navigate(`/tecnica/${id}`); }} />
            <MenuItem icon={<Repeat className="size-5" />} label="Cambiar por otro ejercicio" onClick={() => { setPicker({ mode: "swap", index: menu }); setMenu(null); }} />
            <MenuItem icon={<Trash2 className="size-5" />} label="Quitar del entreno" danger onClick={() => { actions.removeExercise(menu); setMenu(null); }} />
          </div>
        )}
      </Sheet>

      <ExercisePicker
        open={picker !== null}
        swapFor={picker?.mode === "swap" ? active.exercises[picker.index]?.exerciseId : undefined}
        onClose={() => setPicker(null)}
        onPick={id => {
          if (picker?.mode === "swap") actions.swapExercise(picker.index, id);
          else actions.addExercise(id);
          setPicker(null);
        }}
      />

      <Sheet open={confirmEnd} onClose={() => setConfirmEnd(false)} title="¿Terminar entreno?">
        <p className="mb-4 text-sm text-muted">
          {done === 0
            ? "No has completado ninguna serie. Marca las series hechas con ✓ para guardarlas."
            : `Guardaremos ${done} series y ${Math.round(volume).toLocaleString("es")} kg de volumen.`}
        </p>
        <div className="grid gap-2 pb-2">
          <Button size="lg" onClick={finish} disabled={done === 0}>
            <Check className="size-5" /> Guardar entreno
          </Button>
          <Button variant="secondary" onClick={() => setConfirmEnd(false)}>
            Seguir entrenando
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

function MenuItem({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button onClick={onClick} className={cn("flex w-full items-center gap-3 rounded-2xl bg-white/4 p-4 text-left font-medium hover:bg-white/8", danger && "text-brand-300")}>
      {icon}
      {label}
    </button>
  );
}

export function ExercisePicker({
  open,
  onClose,
  onPick,
  swapFor,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (id: string) => void;
  swapFor?: string;
}) {
  const [q, setQ] = useState("");
  const base = swapFor ? getExercise(swapFor) : undefined;
  const list = useMemo(() => {
    const nq = normalize(q);
    return EXERCISES.filter(e => e.id !== swapFor)
      .filter(e => !nq || normalize(`${e.name} ${e.nameEn}`).includes(nq))
      .sort((a, b) => (base ? Number(b.pattern === base.pattern) - Number(a.pattern === base.pattern) : a.name.localeCompare(b.name)));
  }, [q, swapFor, base]);
  return (
    <Sheet open={open} onClose={onClose} title={base ? `Alternativas a ${base.name}` : "Añadir ejercicio"}>
      <label className="sticky top-0 z-10 mb-3 flex h-12 items-center gap-2 rounded-2xl border border-line bg-ink-850 px-4">
        <Search className="size-4 text-muted" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar ejercicio" className="flex-1 bg-transparent outline-none" />
        {q && (
          <button onClick={() => setQ("")} aria-label="Limpiar">
            <X className="size-4 text-muted" />
          </button>
        )}
      </label>
      <ul className="space-y-1 pb-2">
        {list.map(e => (
          <li key={e.id}>
            <button onClick={() => onPick(e.id)} className="flex w-full items-center gap-3 rounded-2xl p-2 text-left hover:bg-white/5">
              <div className="h-12 w-14 shrink-0">
                <DemoThumb demoId={e.demo} className="size-full" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{e.name}</div>
                <div className="truncate text-xs text-muted">{e.primary.map(m => MUSCLE_LABEL[m]).join(", ")}</div>
              </div>
              {base && e.pattern === base.pattern && <span className="rounded-full bg-sky/15 px-2 py-0.5 text-[11px] font-semibold text-sky-300">Mismo patrón</span>}
              <Plus className="size-4 text-muted" />
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
