import { dayTotals, targetsFor } from "./nutrition";
import type { AppState } from "./store";
import { weeklyStreak } from "./training";

export type Tier = "bronce" | "plata" | "oro";

export interface Achievement {
  id: string;
  title: string;
  text: string;
  tier: Tier;
  icon: "flame" | "dumbbell" | "trophy" | "sunrise" | "apple" | "droplet" | "radio" | "crown" | "target" | "star" | "weight" | "bag";
  progress: (s: AppState) => [number, number];
}

const totalVolume = (s: AppState) => s.workouts.reduce((a, w) => a + w.volume, 0);
const strength = (s: AppState) => s.workouts.filter(w => w.exercises.length);

export const ACHIEVEMENTS: Achievement[] = [
  { id: "primer-entreno", title: "Primer paso", text: "Completa tu primer entreno", tier: "bronce", icon: "dumbbell", progress: s => [strength(s).length, 1] },
  { id: "diez-entrenos", title: "En racha", text: "Completa 10 entrenos", tier: "plata", icon: "dumbbell", progress: s => [strength(s).length, 10] },
  { id: "cincuenta-entrenos", title: "Imparable", text: "Completa 50 entrenos", tier: "oro", icon: "trophy", progress: s => [strength(s).length, 50] },
  { id: "constancia-4", title: "Constancia", text: "4 semanas seguidas entrenando", tier: "plata", icon: "flame", progress: s => [weeklyStreak(s.workouts), 4] },
  { id: "constancia-12", title: "Hábito de acero", text: "12 semanas seguidas entrenando", tier: "oro", icon: "flame", progress: s => [weeklyStreak(s.workouts), 12] },
  { id: "tonelada", title: "Una tonelada", text: "Levanta 1.000 kg en total", tier: "bronce", icon: "weight", progress: s => [Math.round(totalVolume(s)), 1000] },
  { id: "diez-toneladas", title: "Diez toneladas", text: "Levanta 10.000 kg en total", tier: "plata", icon: "weight", progress: s => [Math.round(totalVolume(s)), 10000] },
  { id: "cien-toneladas", title: "Titán", text: "Levanta 100.000 kg en total", tier: "oro", icon: "crown", progress: s => [Math.round(totalVolume(s)), 100000] },
  { id: "record", title: "Nuevo récord", text: "Supera tu mejor marca en un ejercicio", tier: "plata", icon: "star", progress: s => [s.workouts.some(w => w.prs.length) ? 1 : 0, 1] },
  { id: "madrugador", title: "Madrugador", text: "Entrena antes de las 7:00", tier: "bronce", icon: "sunrise", progress: s => [s.workouts.some(w => new Date(w.startedAt).getHours() < 7) ? 1 : 0, 1] },
  { id: "nutricion-7", title: "Diario al día", text: "Registra comidas 7 días", tier: "bronce", icon: "apple", progress: s => [Object.values(s.nutrition).filter(d => dayTotals(d).kcal > 0).length, 7] },
  { id: "nutricion-30", title: "Nutrición de élite", text: "Registra comidas 30 días", tier: "oro", icon: "apple", progress: s => [Object.values(s.nutrition).filter(d => dayTotals(d).kcal > 0).length, 30] },
  {
    id: "hidratado",
    title: "Bien hidratado",
    text: "Cumple tu meta de agua un día",
    tier: "bronce",
    icon: "droplet",
    progress: s => {
      const goal = s.profile ? targetsFor(s.profile).waterMl : 2500;
      return [Object.values(s.nutrition).some(d => d.waterMl >= goal) ? 1 : 0, 1];
    },
  },
  { id: "en-vivo-3", title: "Fan del en vivo", text: "Completa 3 clases", tier: "plata", icon: "radio", progress: s => [s.workouts.filter(w => !w.exercises.length).length, 3] },
  {
    id: "meta-peso",
    title: "Meta cumplida",
    text: "Llega a tu peso objetivo",
    tier: "oro",
    icon: "target",
    progress: s => {
      const last = s.weights.at(-1)?.kg;
      return [last !== undefined && s.profile && Math.abs(last - s.profile.targetWeightKg) <= 0.5 ? 1 : 0, 1];
    },
  },
  { id: "pro", title: "Miembro Pro", text: "Únete a MyGym Pro o Elite", tier: "oro", icon: "crown", progress: s => [s.plan === "free" ? 0 : 1, 1] },
  { id: "tienda", title: "Inversión en ti", text: "Compra algo en la Tienda", tier: "plata", icon: "bag", progress: s => [s.purchases.length ? 1 : 0, 1] },
];

export function evaluate(s: AppState) {
  return ACHIEVEMENTS.map(a => {
    const [cur, goal] = a.progress(s);
    return { ...a, current: Math.min(cur, goal), goal, done: cur >= goal };
  });
}
