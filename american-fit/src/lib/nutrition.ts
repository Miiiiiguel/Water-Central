import type { Activity, DayNutrition, FoodEntry, Goal, MacroTargets, MealId, Profile } from "./types";

export const ACTIVITY_FACTOR: Record<Activity, number> = {
  sedentario: 1.2,
  ligero: 1.375,
  moderado: 1.55,
  alto: 1.725,
  atleta: 1.9,
};

export const ACTIVITY_LABEL: Record<Activity, string> = {
  sedentario: "Sedentario (oficina, poco movimiento)",
  ligero: "Ligero (1–3 días de ejercicio)",
  moderado: "Moderado (3–5 días)",
  alto: "Alto (6–7 días)",
  atleta: "Atleta (doble sesión / trabajo físico)",
};

export const GOAL_LABEL: Record<Goal, string> = {
  perder: "Perder grasa",
  musculo: "Ganar músculo",
  recomposicion: "Recomposición",
  fuerza: "Ganar fuerza",
  salud: "Salud y energía",
};

const GOAL_KCAL: Record<Goal, number> = {
  perder: 0.8,
  musculo: 1.1,
  recomposicion: 0.92,
  fuerza: 1.05,
  salud: 1,
};

const GOAL_PROTEIN: Record<Goal, number> = {
  perder: 2.2,
  musculo: 2,
  recomposicion: 2.2,
  fuerza: 2,
  salud: 1.6,
};

/** Mifflin–St Jeor resting metabolic rate. */
export function bmr(p: Pick<Profile, "sex" | "weightKg" | "heightCm" | "age">) {
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age;
  return Math.round(p.sex === "hombre" ? base + 5 : base - 161);
}

export function tdee(p: Pick<Profile, "sex" | "weightKg" | "heightCm" | "age" | "activity">) {
  return Math.round(bmr(p) * ACTIVITY_FACTOR[p.activity]);
}

export function targetsFor(p: Profile, maintenance = tdee(p)): MacroTargets {
  const kcal = Math.round((maintenance * GOAL_KCAL[p.goal]) / 10) * 10;
  const protein = Math.round(p.weightKg * GOAL_PROTEIN[p.goal]);
  const fat = Math.round(Math.max(0.8 * p.weightKg, (0.25 * kcal) / 9));
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  const waterMl = Math.round((p.weightKg * 35 + (p.daysPerWeek >= 3 ? 500 : 250)) / 50) * 50;
  return { kcal, protein, carbs, fat, waterMl };
}

export const MEALS: { id: MealId; label: string; emoji: string }[] = [
  { id: "desayuno", label: "Desayuno", emoji: "☀️" },
  { id: "almuerzo", label: "Almuerzo", emoji: "🍽️" },
  { id: "cena", label: "Cena", emoji: "🌙" },
  { id: "snacks", label: "Snacks", emoji: "🍎" },
];

export const emptyDay = (): DayNutrition => ({
  meals: { desayuno: [], almuerzo: [], cena: [], snacks: [] },
  waterMl: 0,
});

export function sumEntries(entries: FoodEntry[]) {
  return entries.reduce(
    (a, e) => ({
      kcal: a.kcal + e.kcal,
      protein: a.protein + e.protein,
      carbs: a.carbs + e.carbs,
      fat: a.fat + e.fat,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  );
}

export function dayTotals(day: DayNutrition | undefined) {
  if (!day) return { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  return sumEntries(Object.values(day.meals).flat());
}

/** Scales a per-100 g food to an eaten amount. */
export function portion(
  food: { kcal: number; protein: number; carbs: number; fat: number },
  grams: number
) {
  const k = grams / 100;
  return {
    kcal: Math.round(food.kcal * k),
    protein: Math.round(food.protein * k * 10) / 10,
    carbs: Math.round(food.carbs * k * 10) / 10,
    fat: Math.round(food.fat * k * 10) / 10,
  };
}

/** 7-day trailing average of a weight series sorted by date. */
export function movingAverage(points: { date: string; kg: number }[], window = 7) {
  return points.map((p, i) => {
    const slice = points.slice(Math.max(0, i - window + 1), i + 1);
    return { date: p.date, kg: p.kg, avg: slice.reduce((a, x) => a + x.kg, 0) / slice.length };
  });
}

/**
 * Adaptive maintenance estimate, the idea behind apps like MacroFactor:
 * energy in minus the energy stored or released by the change in the
 * weight trend (≈7700 kcal per kg). Needs two weeks of both logs.
 */
export function adaptiveTdee(
  intakeByDay: number[],
  weights: { date: string; kg: number }[]
): number | null {
  const logged = intakeByDay.filter(k => k > 0);
  if (logged.length < 10 || weights.length < 10) return null;
  const trend = movingAverage(weights);
  const first = trend[Math.max(0, trend.length - 14)]!;
  const last = trend[trend.length - 1]!;
  const days = Math.max(
    7,
    (new Date(last.date).getTime() - new Date(first.date).getTime()) / 86_400_000
  );
  const avgIntake = logged.reduce((a, b) => a + b, 0) / logged.length;
  const kgPerDay = (last.avg - first.avg) / days;
  return Math.round((avgIntake - kgPerDay * 7700) / 10) * 10;
}
