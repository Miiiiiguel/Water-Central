import { Heart, PlayCircle, Search, SlidersHorizontal, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { MUSCLE_LABEL, MuscleMap } from "@/components/body/MuscleMap";
import { DemoThumb } from "@/components/technique/FormDemo";
import { Badge, Chip, PageHeader, Sheet } from "@/components/ui";
import { hasVideo } from "@/config/streaming";
import { EQUIPMENT_LABEL, EXERCISES, LEVEL_LABEL, PATTERN_LABEL } from "@/data/exercises";
import { actions, useApp } from "@/lib/store";
import type { Equipment, Exercise, Level, Muscle, Pattern } from "@/lib/types";
import { cn, normalize } from "@/lib/utils";

function ExerciseCard({ ex, fav }: { ex: Exercise; fav: boolean }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      className="card card-hover group relative overflow-hidden"
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
    >
      <Link href={`/tecnica/${ex.id}`} className="block">
        <div className="relative h-40 bg-[radial-gradient(80%_70%_at_50%_100%,rgb(60_123_255/0.12),transparent_70%)]">
          <DemoThumb demoId={ex.demo} animate={hover} className="mx-auto h-full" />
          <div className="absolute left-3 top-3 flex gap-1.5">
            {hasVideo(ex.video?.src) ? (
              <Badge tone="sky">
                <PlayCircle className="size-3" /> Video
              </Badge>
            ) : (
              <Badge tone="neutral">Demo animada</Badge>
            )}
          </div>
        </div>
        <div className="border-t border-line p-4">
          <div className="truncate font-semibold">{ex.name}</div>
          <div className="mt-0.5 truncate text-xs text-muted">
            {ex.primary.map(m => MUSCLE_LABEL[m]).join(" · ")}
          </div>
          <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-muted">
            <span className="rounded-md bg-white/6 px-1.5 py-0.5">{PATTERN_LABEL[ex.pattern]}</span>
            <span className="rounded-md bg-white/6 px-1.5 py-0.5">{LEVEL_LABEL[ex.level]}</span>
            <span className="truncate rounded-md bg-white/6 px-1.5 py-0.5">{EQUIPMENT_LABEL[ex.equipment[0]!]}</span>
          </div>
        </div>
      </Link>
      <button
        onClick={() => actions.toggleFavorite("exercises", ex.id)}
        className={cn(
          "absolute right-3 top-3 grid size-9 place-items-center rounded-full backdrop-blur transition",
          fav ? "bg-brand/20 text-brand" : "bg-black/30 text-muted opacity-100 hover:text-fg sm:opacity-0 sm:group-hover:opacity-100"
        )}
        aria-label={fav ? "Quitar de favoritos" : "Añadir a favoritos"}
      >
        <Heart className="size-4" fill={fav ? "currentColor" : "none"} />
      </button>
    </div>
  );
}

export default function Library() {
  const favorites = useApp(s => s.favorites.exercises);
  const [q, setQ] = useState("");
  const [pattern, setPattern] = useState<Pattern | "fav" | null>(null);
  const [muscle, setMuscle] = useState<Muscle | null>(null);
  const [level, setLevel] = useState<Level | null>(null);
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [filters, setFilters] = useState(false);

  const list = useMemo(() => {
    const nq = normalize(q.trim());
    return EXERCISES.filter(e => {
      if (pattern === "fav" && !favorites.includes(e.id)) return false;
      if (pattern && pattern !== "fav" && e.pattern !== pattern) return false;
      if (muscle && !e.primary.includes(muscle) && !e.secondary.includes(muscle)) return false;
      if (level && e.level !== level) return false;
      if (equipment && !e.equipment.includes(equipment)) return false;
      if (nq && !normalize(`${e.name} ${e.nameEn} ${e.primary.map(m => MUSCLE_LABEL[m]).join(" ")}`).includes(nq)) return false;
      return true;
    }).sort((a, b) => (muscle ? Number(b.primary.includes(muscle)) - Number(a.primary.includes(muscle)) : 0));
  }, [q, pattern, muscle, level, equipment, favorites]);

  const activeFilters = [muscle, level, equipment].filter(Boolean).length;

  return (
    <div>
      <PageHeader
        eyebrow="Biblioteca de ejercicios"
        title={
          <>
            Técnica <span className="text-gradient-brand">perfecta</span>
          </>
        }
      />
      <p className="-mt-3 mb-5 max-w-2xl text-muted">
        Cada ejercicio con demostración animada paso a paso, el error más común, músculos implicados y las claves que usan los coaches. Los videos reales de cada ejercicio se suman aquí mismo.
      </p>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="min-w-0">
          <div className="sticky top-14 z-20 -mx-4 mb-4 bg-ink-950/90 px-4 pb-3 pt-1 backdrop-blur lg:top-0 lg:mx-0 lg:px-0">
            <div className="flex gap-2">
              <label className="flex h-12 flex-1 items-center gap-2 rounded-2xl border border-line bg-ink-900 px-4 focus-within:border-line-strong">
                <Search className="size-4 text-muted" />
                <input
                  value={q}
                  onChange={e => setQ(e.target.value)}
                  placeholder="Buscar: sentadilla, glúteos, dominadas…"
                  className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-faint"
                />
                {q && (
                  <button onClick={() => setQ("")} aria-label="Limpiar búsqueda">
                    <X className="size-4 text-muted" />
                  </button>
                )}
              </label>
              <button
                onClick={() => setFilters(true)}
                className="relative grid size-12 place-items-center rounded-2xl border border-line bg-ink-900 lg:hidden"
                aria-label="Filtros"
              >
                <SlidersHorizontal className="size-5" />
                {activeFilters > 0 && (
                  <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-brand text-[10px] font-bold">
                    {activeFilters}
                  </span>
                )}
              </button>
            </div>
            <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
              <Chip active={pattern === null} onClick={() => setPattern(null)}>
                Todos
              </Chip>
              <Chip active={pattern === "fav"} onClick={() => setPattern(pattern === "fav" ? null : "fav")}>
                <Heart className="size-3.5" /> Favoritos
              </Chip>
              {(Object.keys(PATTERN_LABEL) as Pattern[]).map(p => (
                <Chip key={p} active={pattern === p} onClick={() => setPattern(pattern === p ? null : p)}>
                  {PATTERN_LABEL[p]}
                </Chip>
              ))}
            </div>
            {activeFilters > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {muscle && <FilterTag label={MUSCLE_LABEL[muscle]} onClear={() => setMuscle(null)} />}
                {level && <FilterTag label={LEVEL_LABEL[level]} onClear={() => setLevel(null)} />}
                {equipment && <FilterTag label={EQUIPMENT_LABEL[equipment]} onClear={() => setEquipment(null)} />}
              </div>
            )}
          </div>

          <div className="mb-3 text-[13px] text-muted">{list.length} ejercicios</div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {list.map(ex => (
              <ExerciseCard key={ex.id} ex={ex} fav={favorites.includes(ex.id)} />
            ))}
          </div>
          {list.length === 0 && <p className="py-16 text-center text-muted">No hay ejercicios con esos filtros.</p>}
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-6 space-y-4">
            <FilterPanel
              muscle={muscle}
              setMuscle={setMuscle}
              level={level}
              setLevel={setLevel}
              equipment={equipment}
              setEquipment={setEquipment}
            />
          </div>
        </aside>
      </div>

      <Sheet open={filters} onClose={() => setFilters(false)} title="Filtros">
        <FilterPanel
          muscle={muscle}
          setMuscle={setMuscle}
          level={level}
          setLevel={setLevel}
          equipment={equipment}
          setEquipment={setEquipment}
        />
        <button onClick={() => setFilters(false)} className="mt-4 h-12 w-full rounded-full bg-fg font-semibold text-ink-950">
          Ver {list.length} ejercicios
        </button>
      </Sheet>
    </div>
  );
}

function FilterTag({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button onClick={onClear} className="inline-flex items-center gap-1 rounded-full bg-sky/15 px-3 py-1 text-xs font-semibold text-sky-300">
      {label} <X className="size-3" />
    </button>
  );
}

function FilterPanel({
  muscle,
  setMuscle,
  level,
  setLevel,
  equipment,
  setEquipment,
}: {
  muscle: Muscle | null;
  setMuscle: (m: Muscle | null) => void;
  level: Level | null;
  setLevel: (l: Level | null) => void;
  equipment: Equipment | null;
  setEquipment: (e: Equipment | null) => void;
}) {
  const levels: Partial<Record<Muscle, number>> = muscle ? { [muscle]: 1 } : {};
  return (
    <div className="space-y-5">
      <div className="card p-4">
        <div className="eyebrow mb-2">Toca un músculo</div>
        <MuscleMap levels={levels} selected={muscle} onSelect={m => setMuscle(muscle === m ? null : m)} className="mx-auto h-64 max-w-[260px]" />
      </div>
      <div>
        <div className="eyebrow mb-2">Nivel</div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(LEVEL_LABEL) as Level[]).map(l => (
            <Chip key={l} active={level === l} onClick={() => setLevel(level === l ? null : l)}>
              {LEVEL_LABEL[l]}
            </Chip>
          ))}
        </div>
      </div>
      <div>
        <div className="eyebrow mb-2">Material</div>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(EQUIPMENT_LABEL) as Equipment[]).map(e => (
            <Chip key={e} active={equipment === e} onClick={() => setEquipment(equipment === e ? null : e)}>
              {EQUIPMENT_LABEL[e]}
            </Chip>
          ))}
        </div>
      </div>
    </div>
  );
}
