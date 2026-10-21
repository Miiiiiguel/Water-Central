import { EXERCISES, getExercise } from "@/data/exercises";
import type { Equipment, Muscle, Pattern, Profile, SessionExercise, SetLog, WorkoutLog } from "./types";

/** Epley estimated one-rep max. */
export function e1rm(weight: number, reps: number) {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

export const setVolume = (s: SetLog) => (s.done ? s.reps * s.weight : 0);

export function sessionVolume(exs: SessionExercise[]) {
  return exs.reduce((a, e) => a + e.sets.reduce((b, s) => b + setVolume(s), 0), 0);
}

export function doneSets(exs: SessionExercise[]) {
  return exs.reduce((a, e) => a + e.sets.filter(s => s.done).length, 0);
}

/** "8-10" → 10, "12 por pierna" → 12, "30 s" → 30. */
export function targetReps(reps: string) {
  const nums = reps.match(/\d+/g)?.map(Number) ?? [10];
  return nums[nums.length - 1]!;
}

export function bestE1rm(history: WorkoutLog[], exerciseId: string, before?: number) {
  let best = 0;
  for (const w of history) {
    if (before !== undefined && w.startedAt >= before) continue;
    for (const e of w.exercises) {
      if (e.exerciseId !== exerciseId) continue;
      for (const s of e.sets) if (s.done) best = Math.max(best, e1rm(s.weight, s.reps));
    }
  }
  return best;
}

/** The sets logged for an exercise the last time it was trained. */
export function lastPerformance(history: WorkoutLog[], exerciseId: string) {
  const sorted = [...history].sort((a, b) => b.startedAt - a.startedAt);
  for (const w of sorted) {
    const e = w.exercises.find(x => x.exerciseId === exerciseId && x.sets.some(s => s.done));
    if (e) return { date: w.date, sets: e.sets.filter(s => s.done) };
  }
  return null;
}

/**
 * Per-muscle fatigue in [0, 1] from the last four days of training:
 * each completed set adds 1 to its primary muscles and 0.5 to the
 * secondary ones, fading linearly to zero over 72 h. Eight fresh sets
 * saturate a muscle.
 */
export function recoveryLevels(history: WorkoutLog[], now = Date.now()) {
  const fatigue: Partial<Record<Muscle, number>> = {};
  for (const w of history) {
    const hours = (now - (w.startedAt + w.durationSec * 1000)) / 3_600_000;
    if (hours < 0 || hours > 72) continue;
    const decay = 1 - hours / 72;
    for (const e of w.exercises) {
      const ex = getExercise(e.exerciseId);
      if (!ex) continue;
      const sets = e.sets.filter(s => s.done).length;
      for (const m of ex.primary) fatigue[m] = (fatigue[m] ?? 0) + sets * decay;
      for (const m of ex.secondary) fatigue[m] = (fatigue[m] ?? 0) + sets * 0.5 * decay;
    }
  }
  const out: Partial<Record<Muscle, number>> = {};
  for (const [m, f] of Object.entries(fatigue)) out[m as Muscle] = Math.min(1, f / 8);
  return out;
}

export type Focus = "auto" | "full" | "upper" | "lower" | "push" | "pull" | "core" | "cardio";

export const FOCUS_LABEL: Record<Focus, string> = {
  auto: "Inteligente",
  full: "Cuerpo completo",
  upper: "Torso",
  lower: "Pierna",
  push: "Empuje",
  pull: "Tracción",
  core: "Core",
  cardio: "Cardio",
};

const FOCUS_PATTERNS: Record<Exclude<Focus, "auto">, Pattern[]> = {
  full: ["pierna", "empuje", "traccion", "bisagra", "core"],
  upper: ["empuje", "traccion", "empuje", "traccion", "core"],
  lower: ["pierna", "bisagra", "pierna", "bisagra", "core"],
  push: ["empuje", "empuje", "empuje", "core"],
  pull: ["traccion", "traccion", "bisagra", "traccion", "core"],
  core: ["core", "core", "core", "movilidad"],
  cardio: ["cardio", "pierna", "cardio", "core", "cardio"],
};

const PATTERN_MUSCLES: Record<Pattern, Muscle[]> = {
  pierna: ["quads", "glutes"],
  bisagra: ["hamstrings", "glutes"],
  empuje: ["chest", "shoulders", "triceps"],
  traccion: ["lats", "upperBack", "biceps"],
  core: ["abs", "obliques"],
  cardio: ["quads", "calves"],
  movilidad: [],
};

function availableEquipment(p: Pick<Profile, "place" | "equipment">): Set<Equipment> {
  const set = new Set<Equipment>(["bodyweight", ...p.equipment]);
  if (p.place !== "casa") {
    for (const e of ["barbell", "dumbbell", "kettlebell", "machine", "cable", "bench", "pullupBar", "band"] as Equipment[])
      set.add(e);
  }
  return set;
}

/**
 * Builds a session the way Fitbod-style generators do: pick the focus
 * from the most recovered patterns, fill each slot with an exercise the
 * person can do with their equipment and level, then size the volume to
 * the minutes available.
 */
export function generateWorkout(
  profile: Pick<Profile, "place" | "equipment" | "level" | "goal" | "minutes">,
  history: WorkoutLog[],
  focus: Focus,
  minutes = profile.minutes,
  seed = Date.now()
) {
  const fatigue = recoveryLevels(history);
  let resolved: Exclude<Focus, "auto"> = focus === "auto" ? "full" : focus;
  if (focus === "auto") {
    const score = (ms: Muscle[]) => ms.reduce((a, m) => a + (fatigue[m] ?? 0), 0) / Math.max(1, ms.length);
    const upper = score(["chest", "shoulders", "lats", "upperBack", "triceps", "biceps"]);
    const lower = score(["quads", "glutes", "hamstrings"]);
    resolved = upper < 0.2 && lower < 0.2 ? "full" : upper < lower ? "upper" : "lower";
  }
  const equip = availableEquipment(profile);
  const levelRank = { principiante: 0, intermedio: 1, avanzado: 2 };
  const maxLevel = levelRank[profile.level] + (profile.level === "principiante" ? 0 : 1);
  let r = seed % 2147483647 || 1;
  const rand = () => ((r = (r * 16807) % 2147483647) / 2147483647);

  const slots = FOCUS_PATTERNS[resolved];
  const count = Math.max(3, Math.min(slots.length + 2, Math.round(minutes / 10)));
  const picked: string[] = [];
  for (let i = 0; i < count; i++) {
    const pattern = slots[i % slots.length]!;
    const pool = EXERCISES.filter(
      e =>
        e.pattern === pattern &&
        !picked.includes(e.id) &&
        levelRank[e.level] <= maxLevel &&
        e.equipment.some(q => equip.has(q))
    ).sort((a, b) => {
      // Fresh muscles first; the opening slots also favour compound lifts
      // (more muscles involved) over isolation work.
      const weight = i < 2 ? 0.35 : 0.1;
      const score = (e: (typeof EXERCISES)[number]) =>
        e.primary.reduce((s, m) => s + (fatigue[m] ?? 0), 0) - weight * (e.primary.length * 2 + e.secondary.length);
      return score(a) - score(b) + (rand() - 0.5) * 0.6;
    });
    if (pool[0]) picked.push(pool[0].id);
  }
  const strength = profile.goal === "fuerza";
  const loss = profile.goal === "perder";
  return {
    focus: resolved,
    muscles: [...new Set(slots.flatMap(p => PATTERN_MUSCLES[p]))],
    exercises: picked.map((id, i) => {
      const ex = getExercise(id)!;
      const compound = i < 2 && ex.loadType === "weight";
      return {
        id,
        sets: compound ? (strength ? 5 : 4) : 3,
        reps: ex.loadType === "time" ? ex.defaults.reps : strength && compound ? "5" : loss ? "12-15" : ex.defaults.reps,
        rest: loss ? Math.min(ex.defaults.rest, 60) : ex.defaults.rest,
      };
    }),
  };
}

export function weeklyStreak(history: WorkoutLog[], now = new Date()) {
  const weekStart = (d: Date) => {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
    return x.getTime();
  };
  const weeks = new Set(history.map(w => weekStart(new Date(w.startedAt))));
  let streak = 0;
  let cursor = weekStart(now);
  if (!weeks.has(cursor)) cursor -= 7 * 86_400_000;
  while (weeks.has(cursor)) {
    streak++;
    cursor -= 7 * 86_400_000;
  }
  return streak;
}
