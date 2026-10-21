import { cn } from "@/lib/utils";
import type { Muscle } from "@/lib/types";

/*
 * Front and back anatomical maps. Each muscle is drawn once for the
 * figure's right half (x ≥ 100 in a 200×400 box) and mirrored, so both
 * sides always match.
 */

type Shape = { m: Muscle; d: string };

const FRONT: Shape[] = [
  { m: "traps", d: "M106,54 Q118,58 132,66 L113,67 Q108,61 106,54Z" },
  { m: "shoulders", d: "M132,66 Q148,68 152,84 Q153,98 146,108 Q138,96 129,84 Q126,74 132,66Z" },
  { m: "chest", d: "M102,70 L128,72 Q140,82 140,96 Q132,110 114,112 Q104,110 102,104Z" },
  { m: "biceps", d: "M142,110 Q152,105 156,116 Q158,132 152,146 Q146,148 142,140 Q138,124 142,110Z" },
  { m: "forearms", d: "M150,151 Q160,151 164,166 Q166,186 160,204 Q154,206 152,200 Q148,178 146,161 Q146,153 150,151Z" },
  { m: "abs", d: "M102,116 h12 q2,0 2,2 v15 q0,2 -2,2 h-12Z M102,138 h12 q2,0 2,2 v16 q0,2 -2,2 h-12Z M102,161 h12 q2,0 2,2 v15 q0,2 -2,2 h-12Z M102,183 h12 q1,10 -9,22 h-3Z" },
  { m: "obliques", d: "M119,116 Q132,114 136,124 Q138,150 132,176 Q126,186 119,190 Q121,150 119,116Z" },
  { m: "adductors", d: "M102,208 Q110,207 112,214 Q110,240 107,262 Q103,262 102,250Z" },
  { m: "quads", d: "M113,208 Q128,201 136,210 Q142,240 138,270 Q134,292 126,302 Q118,304 115,294 Q110,270 110,240 Q110,220 113,208Z" },
  { m: "calves", d: "M115,318 Q124,311 132,319 Q136,340 130,368 Q126,378 121,378 Q115,360 113,338 Q113,325 115,318Z" },
];

const BACK: Shape[] = [
  { m: "traps", d: "M100,50 L108,52 Q122,60 136,68 Q124,78 113,96 Q105,112 100,126Z" },
  { m: "shoulders", d: "M134,68 Q150,70 154,86 Q154,100 146,108 Q138,94 130,80Z" },
  { m: "upperBack", d: "M105,82 Q117,76 129,82 Q133,93 129,104 Q118,110 105,114Z" },
  { m: "triceps", d: "M142,108 Q154,104 157,118 Q158,134 153,148 Q146,150 142,140 Q139,122 142,108Z" },
  { m: "forearms", d: "M150,151 Q160,151 164,166 Q166,186 160,204 Q154,206 152,200 Q148,178 146,161 Q146,153 150,151Z" },
  { m: "lats", d: "M107,118 Q124,108 136,102 Q140,124 136,146 Q128,168 113,182 Q107,160 107,118Z" },
  { m: "lowerBack", d: "M101,150 L110,150 Q114,172 114,196 L101,198Z" },
  { m: "glutes", d: "M101,201 Q120,193 134,205 Q140,222 134,240 Q120,250 104,245 Q100,224 101,201Z" },
  { m: "hamstrings", d: "M106,251 Q122,249 134,253 Q138,276 134,298 Q126,306 118,304 Q110,300 108,286 Q104,268 106,251Z" },
  { m: "calves", d: "M112,314 Q124,306 134,316 Q138,334 132,352 Q126,362 120,360 Q112,350 110,334 Q110,322 112,314Z" },
];

function Silhouette() {
  const fill = "var(--color-ink-800)";
  const half = (
    <>
      <path d="M100,58 L110,58 Q124,62 134,66 Q150,70 154,88 L150,112 Q140,110 138,118 Q138,150 132,186 Q136,200 138,210 L100,212Z" fill={fill} />
      <line x1={147} y1={92} x2={153} y2={146} stroke={fill} strokeWidth={19} strokeLinecap="round" />
      <line x1={153} y1={146} x2={160} y2={206} stroke={fill} strokeWidth={15} strokeLinecap="round" />
      <ellipse cx={161} cy={216} rx={6} ry={11} fill={fill} />
      <line x1={120} y1={214} x2={124} y2={300} stroke={fill} strokeWidth={32} strokeLinecap="round" />
      <line x1={124} y1={300} x2={122} y2={380} stroke={fill} strokeWidth={21} strokeLinecap="round" />
      <ellipse cx={123} cy={392} rx={9} ry={6} fill={fill} />
    </>
  );
  return (
    <g>
      <ellipse cx={100} cy={30} rx={16} ry={20} fill={fill} />
      <path d="M92,46 L108,46 L110,60 L90,60Z" fill={fill} />
      {half}
      <g transform="translate(200,0) scale(-1,1)">{half}</g>
    </g>
  );
}

export type MapMode = "target" | "recovery";

function colorFor(level: number | undefined, mode: MapMode) {
  if (level === undefined) return { fill: "var(--color-ink-600)", opacity: 0.55 };
  if (mode === "target") {
    return level >= 0.75
      ? { fill: "var(--color-brand)", opacity: 1 }
      : { fill: "var(--color-ember)", opacity: 0.45 + level * 0.4 };
  }
  // Recovery: level is fatigue (1 = just trained).
  if (level >= 0.66) return { fill: "var(--color-brand)", opacity: 0.95 };
  if (level >= 0.33) return { fill: "var(--color-warn)", opacity: 0.9 };
  if (level > 0.05) return { fill: "var(--color-success)", opacity: 0.55 };
  return { fill: "var(--color-success)", opacity: 0.85 };
}

function Body({
  shapes,
  levels,
  mode,
  selected,
  onSelect,
  label,
}: {
  shapes: Shape[];
  levels: Partial<Record<Muscle, number>>;
  mode: MapMode;
  selected?: Muscle | null;
  onSelect?: (m: Muscle) => void;
  label: string;
}) {
  const one = (sh: Shape, key: string) => {
    const c = colorFor(levels[sh.m], mode);
    const isSel = selected === sh.m;
    return (
      <path
        key={key}
        d={sh.d}
        fill={c.fill}
        fillOpacity={c.opacity}
        stroke={isSel ? "var(--color-fg)" : "rgb(7 9 15 / 0.9)"}
        strokeWidth={isSel ? 2 : 1.2}
        className={cn("transition-[fill,fill-opacity] duration-500", onSelect && "cursor-pointer hover:fill-opacity-100")}
        onClick={onSelect ? () => onSelect(sh.m) : undefined}
      >
        <title>{MUSCLE_LABEL[sh.m]}</title>
      </path>
    );
  };
  return (
    <figure className="flex h-full min-h-0 flex-col items-center">
      <svg viewBox="0 0 200 404" className="min-h-0 w-full flex-1" role="img" aria-label={label}>
        <Silhouette />
        {shapes.map((sh, i) => one(sh, `r${i}`))}
        <g transform="translate(200,0) scale(-1,1)">{shapes.map((sh, i) => one(sh, `l${i}`))}</g>
      </svg>
      <figcaption className="eyebrow mt-1">{label}</figcaption>
    </figure>
  );
}

export function MuscleMap({
  levels,
  mode = "target",
  selected,
  onSelect,
  className,
}: {
  levels: Partial<Record<Muscle, number>>;
  mode?: MapMode;
  selected?: Muscle | null;
  onSelect?: (m: Muscle) => void;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-2 gap-2", className)}>
      <Body shapes={FRONT} levels={levels} mode={mode} selected={selected} onSelect={onSelect} label="Frente" />
      <Body shapes={BACK} levels={levels} mode={mode} selected={selected} onSelect={onSelect} label="Espalda" />
    </div>
  );
}

export const MUSCLE_LABEL: Record<Muscle, string> = {
  chest: "Pecho",
  shoulders: "Hombros",
  biceps: "Bíceps",
  triceps: "Tríceps",
  forearms: "Antebrazos",
  abs: "Abdomen",
  obliques: "Oblicuos",
  traps: "Trapecio",
  lats: "Dorsales",
  upperBack: "Espalda alta",
  lowerBack: "Lumbar",
  glutes: "Glúteos",
  quads: "Cuádriceps",
  hamstrings: "Isquiotibiales",
  adductors: "Aductores",
  calves: "Pantorrillas",
};

export const ALL_MUSCLES = Object.keys(MUSCLE_LABEL) as Muscle[];
