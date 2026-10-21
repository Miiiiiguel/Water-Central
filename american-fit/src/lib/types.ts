export type Muscle =
  | "chest"
  | "shoulders"
  | "biceps"
  | "triceps"
  | "forearms"
  | "abs"
  | "obliques"
  | "traps"
  | "lats"
  | "upperBack"
  | "lowerBack"
  | "glutes"
  | "quads"
  | "hamstrings"
  | "adductors"
  | "calves";

export type Equipment =
  | "barbell"
  | "dumbbell"
  | "kettlebell"
  | "machine"
  | "cable"
  | "bodyweight"
  | "band"
  | "bench"
  | "pullupBar";

export type Level = "principiante" | "intermedio" | "avanzado";

export type Pattern =
  | "pierna"
  | "bisagra"
  | "empuje"
  | "traccion"
  | "core"
  | "cardio"
  | "movilidad";

/**
 * A real recorded video. Leave `src` empty until the clip is recorded:
 * every screen shows a "grabación en producción" state instead of a
 * broken player. `src` can be an .mp4 or an HLS .m3u8 (Mux, Cloudflare
 * Stream, Bunny, Vimeo…), see src/config/streaming.ts.
 */
export interface VideoSource {
  src?: string;
  poster?: string;
  /** Seconds. */
  duration?: number;
}

export interface Exercise {
  id: string;
  name: string;
  nameEn: string;
  pattern: Pattern;
  primary: Muscle[];
  secondary: Muscle[];
  equipment: Equipment[];
  level: Level;
  /** Key into the animated technique demos. */
  demo: string;
  /** Eccentric-pause-concentric-pause, in seconds. */
  tempo: string;
  summary: string;
  setup: string[];
  steps: string[];
  cues: string[];
  mistakes: { mistake: string; fix: string }[];
  breathing: string;
  safety: string;
  easier?: string[];
  harder?: string[];
  defaults: { sets: number; reps: string; rest: number };
  /** Bodyweight / isometric work is logged without load. */
  loadType: "weight" | "bodyweight" | "time";
  video?: VideoSource;
}

export type Goal = "perder" | "musculo" | "recomposicion" | "fuerza" | "salud";
export type Sex = "hombre" | "mujer";
export type Place = "gym" | "casa" | "ambos";
export type Activity = "sedentario" | "ligero" | "moderado" | "alto" | "atleta";

export interface Profile {
  name: string;
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  targetWeightKg: number;
  goal: Goal;
  level: Level;
  place: Place;
  equipment: Equipment[];
  daysPerWeek: number;
  minutes: number;
  activity: Activity;
  injuries: string[];
  units: "kg" | "lb";
  diet: "omnivora" | "vegetariana" | "vegana" | "sin-gluten";
}

export interface SetLog {
  reps: number;
  weight: number;
  done: boolean;
  rpe?: number;
}

export interface SessionExercise {
  exerciseId: string;
  target: { sets: number; reps: string; rest: number };
  sets: SetLog[];
  note?: string;
}

export interface ActiveSession {
  id: string;
  name: string;
  startedAt: number;
  programId?: string;
  programDay?: string;
  exercises: SessionExercise[];
}

export interface WorkoutLog {
  id: string;
  name: string;
  date: string;
  startedAt: number;
  durationSec: number;
  programId?: string;
  programDay?: string;
  exercises: SessionExercise[];
  volume: number;
  prs: { exerciseId: string; e1rm: number }[];
  demo?: boolean;
}

export type MealId = "desayuno" | "almuerzo" | "cena" | "snacks";

export interface FoodEntry {
  id: string;
  foodId?: string;
  name: string;
  grams: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface DayNutrition {
  meals: Record<MealId, FoodEntry[]>;
  waterMl: number;
}

export interface Food {
  id: string;
  name: string;
  brand?: string;
  /** Per 100 g (or 100 ml). */
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  serving: { label: string; grams: number };
  tags?: string[];
}

export interface MacroTargets {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  waterMl: number;
}

export interface Coach {
  id: string;
  name: string;
  role: string;
  specialties: string[];
  bio: string;
  hue: number;
  rating: number;
  classes: number;
  instagram?: string;
}

export type ClassCategory =
  | "fuerza"
  | "hiit"
  | "cardio"
  | "yoga"
  | "movilidad"
  | "core"
  | "baile"
  | "boxeo"
  | "nutricion";

export interface LiveClass {
  id: string;
  title: string;
  coachId: string;
  category: ClassCategory;
  level: Level;
  durationMin: number;
  /** Minutes after local midnight, repeated on these weekdays (0=Sun). */
  weekdays: number[];
  startMin: number;
  equipment: Equipment[];
  description: string;
  kcal: number;
  /** HLS playback URL for the live stream, or empty while not set up. */
  streamUrl?: string;
}

export interface VideoClass {
  id: string;
  title: string;
  coachId: string;
  category: ClassCategory;
  level: Level;
  durationMin: number;
  kcal: number;
  description: string;
  equipment: Equipment[];
  seriesId?: string;
  episode?: number;
  isNew?: boolean;
  isReplay?: boolean;
  video: VideoSource;
  chapters?: { at: number; title: string }[];
}

export interface VideoSeries {
  id: string;
  title: string;
  subtitle: string;
  hue: number;
}

export interface ProgramDay {
  key: string;
  name: string;
  focus: string;
  exercises: { id: string; sets: number; reps: string; rest: number }[];
}

export interface Program {
  id: string;
  name: string;
  tagline: string;
  goal: Goal;
  level: Level;
  weeks: number;
  daysPerWeek: number;
  minutes: number;
  place: Place;
  coachId: string;
  hue: number;
  description: string;
  highlights: string[];
  days: ProgramDay[];
}

export interface Recipe {
  id: string;
  name: string;
  meal: MealId;
  minutes: number;
  servings: number;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  tags: string[];
  hue: number;
  ingredients: string[];
  steps: string[];
}

export interface Article {
  id: string;
  title: string;
  category: "nutricion" | "entrenamiento" | "recuperacion" | "suplementos";
  minutes: number;
  summary: string;
  hue: number;
  body: { h?: string; p: string }[];
}

export interface Challenge {
  id: string;
  title: string;
  description: string;
  days: number;
  metric: string;
  participants: number;
  hue: number;
  reward: string;
}
