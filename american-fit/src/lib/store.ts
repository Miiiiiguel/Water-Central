import { useSyncExternalStore } from "react";
import { getExercise } from "@/data/exercises";
import { PROGRAM_BY_ID } from "@/data/programs";
import { FOOD_BY_ID } from "@/data/foods";
import { emptyDay, portion } from "./nutrition";
import { bestE1rm, e1rm, sessionVolume, targetReps } from "./training";
import type {
  ActiveSession,
  DayNutrition,
  Food,
  FoodEntry,
  MealId,
  Profile,
  SessionExercise,
  WorkoutLog,
} from "./types";
import { addDays, dayKey, seededRandom, uid } from "./utils";

/*
 * App state, one copy per signed-in account.
 *
 * Everything a person logs lives here so the app works offline. Each
 * account's state is saved on the device under its own key; with Supabase
 * configured, lib/sync.ts also mirrors it to the cloud so the history
 * follows the person to any device.
 */

export type Plan = "free" | "pro" | "elite";
export type BillingPeriod = "monthly" | "yearly";
export type PaymentProvider = "wompi" | "stripe" | "demo";

export interface Ticket {
  id: string;
  at: number;
  category: string;
  subject: string;
  message: string;
  status: "abierto" | "en-revision" | "resuelto";
  replies: { at: number; from: "soporte" | "tu"; text: string }[];
}

export interface Payment {
  id: string;
  at: number;
  plan: Plan;
  period: BillingPeriod;
  /** Set for one-time Tienda purchases (then `plan` is "free"). */
  productId?: string;
  amount: number;
  currency: "COP" | "USD";
  provider: PaymentProvider;
  status: "approved" | "pending" | "declined";
  reference: string;
}

export interface Subscription {
  plan: Plan;
  period: BillingPeriod;
  provider: PaymentProvider;
  status: "active" | "canceled";
  renewsAt: number;
}

export interface AppState {
  version: 1;
  updatedAt: number;
  profile: Profile | null;
  workouts: WorkoutLog[];
  active: ActiveSession | null;
  nutrition: Record<string, DayNutrition>;
  weights: { date: string; kg: number }[];
  favorites: { exercises: string[]; videos: string[]; recipes: string[] };
  reminders: string[];
  enrolled: { programId: string; startedAt: string; done: string[] } | null;
  watched: Record<string, number>;
  challenges: string[];
  plan: Plan;
  subscription: Subscription | null;
  payments: Payment[];
  tickets: Ticket[];
  purchases: string[];
  logins: { at: number; method: "password" | "google" | "signup"; device: string }[];
  customFoods: Food[];
  recentFoods: string[];
  hasDemoData: boolean;
}

const LEGACY_KEY = "americanfit:v1";
const keyFor = (userId: string) => `americanfit:v1:${userId}`;

const initial = (): AppState => ({
  version: 1,
  updatedAt: 0,
  profile: null,
  workouts: [],
  active: null,
  nutrition: {},
  weights: [],
  favorites: { exercises: [], videos: [], recipes: [] },
  reminders: [],
  enrolled: null,
  watched: {},
  challenges: [],
  plan: "free",
  subscription: null,
  payments: [],
  tickets: [],
  purchases: [],
  logins: [],
  customFoods: [],
  recentFoods: [],
  hasDemoData: false,
});

function read(key: string): AppState | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppState;
    return parsed.version === 1 ? { ...initial(), ...parsed } : null;
  } catch {
    return null;
  }
}

let userId: string | null = null;
let state: AppState = initial();
const listeners = new Set<() => void>();
const changeListeners = new Set<(s: AppState, userId: string) => void>();

function persist() {
  if (!userId) return;
  try {
    localStorage.setItem(keyFor(userId), JSON.stringify(state));
  } catch {
    // Private mode or quota: the app keeps working in memory.
  }
}

function emit() {
  listeners.forEach(l => l());
}

function set(fn: (s: AppState) => AppState) {
  state = { ...fn(state), updatedAt: Date.now() };
  persist();
  emit();
  if (userId) changeListeners.forEach(l => l(state, userId!));
}

/**
 * Loads the state of the account that just signed in (or clears it on
 * sign-out). Data logged before accounts existed is adopted by the first
 * account that signs in on this device.
 */
export function switchUser(id: string | null) {
  userId = id;
  if (!id) {
    state = initial();
  } else {
    let s = read(keyFor(id));
    if (!s) {
      const legacy = read(LEGACY_KEY);
      if (legacy) {
        s = legacy;
        try {
          localStorage.removeItem(LEGACY_KEY);
        } catch {
          // Ignore.
        }
      }
    }
    state = s ?? initial();
    // A paid period that ended drops the account back to Free.
    if (state.subscription && state.subscription.renewsAt < Date.now()) {
      state = { ...state, plan: "free", subscription: null };
    }
    persist();
  }
  emit();
}

/** Replaces the whole state, e.g. with a newer copy pulled from the cloud. */
export function replaceState(next: AppState) {
  state = { ...initial(), ...next };
  persist();
  emit();
}

export function onStateChange(fn: (s: AppState, userId: string) => void) {
  changeListeners.add(fn);
  return () => changeListeners.delete(fn);
}

export function getState() {
  return state;
}

export function useApp<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(
    cb => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => selector(state),
    () => selector(state)
  );
}

const toggle = (list: string[], id: string) =>
  list.includes(id) ? list.filter(x => x !== id) : [...list, id];

function newSessionExercises(items: { id: string; sets: number; reps: string; rest: number }[]): SessionExercise[] {
  return items.map(it => {
    const last = lastWeight(it.id);
    return {
      exerciseId: it.id,
      target: { sets: it.sets, reps: it.reps, rest: it.rest },
      sets: Array.from({ length: it.sets }, () => ({
        reps: targetReps(it.reps),
        weight: last,
        done: false,
      })),
    };
  });
}

function lastWeight(exerciseId: string) {
  const sorted = [...state.workouts].sort((a, b) => b.startedAt - a.startedAt);
  for (const w of sorted) {
    const e = w.exercises.find(x => x.exerciseId === exerciseId);
    const s = e?.sets.filter(x => x.done && x.weight > 0).at(-1);
    if (s) return s.weight;
  }
  return 0;
}

export const actions = {
  setProfile(profile: Profile) {
    set(s => {
      const today = dayKey();
      const weights = s.weights.some(w => w.date === today)
        ? s.weights
        : [...s.weights, { date: today, kg: profile.weightKg }];
      return { ...s, profile, weights };
    });
  },
  updateProfile(patch: Partial<Profile>) {
    set(s => (s.profile ? { ...s, profile: { ...s.profile, ...patch } } : s));
  },
  setPlan(plan: Plan) {
    set(s => ({ ...s, plan, subscription: plan === "free" ? null : s.subscription }));
  },
  /** Records a payment and, when approved, activates the plan it paid for. */
  recordPayment(p: Payment, activate = true) {
    set(s => {
      const payments = [p, ...s.payments.filter(x => x.id !== p.id)].sort((a, b) => b.at - a.at);
      if (p.productId) {
        const owned = p.status === "approved" && !s.purchases.includes(p.productId) ? [...s.purchases, p.productId] : s.purchases;
        return { ...s, payments, purchases: owned };
      }
      if (p.status !== "approved" || !activate) return { ...s, payments };
      const days = p.period === "yearly" ? 365 : 30;
      const base = s.subscription?.plan === p.plan && s.subscription.renewsAt > Date.now() ? s.subscription.renewsAt : Date.now();
      return {
        ...s,
        payments,
        plan: p.plan,
        subscription: { plan: p.plan, period: p.period, provider: p.provider, status: "active", renewsAt: base + days * 86_400_000 },
      };
    });
  },
  addTicket(t: Omit<Ticket, "id" | "at" | "status" | "replies">) {
    const ticket: Ticket = { ...t, id: `T-${Date.now().toString(36).toUpperCase().slice(-6)}`, at: Date.now(), status: "abierto", replies: [] };
    set(s => ({ ...s, tickets: [ticket, ...s.tickets] }));
    return ticket;
  },
  replyTicket(id: string, text: string) {
    set(s => ({
      ...s,
      tickets: s.tickets.map(t => (t.id === id ? { ...t, status: "abierto", replies: [...t.replies, { at: Date.now(), from: "tu", text }] } : t)),
    }));
  },
  recordLogin(entry: AppState["logins"][number]) {
    set(s => {
      if (s.logins[0] && entry.at - s.logins[0].at < 60_000) return s;
      return { ...s, logins: [entry, ...s.logins].slice(0, 50) };
    });
  },
  setSubscription(sub: Subscription | null) {
    set(s => ({ ...s, subscription: sub, plan: sub && sub.status === "active" && sub.renewsAt > Date.now() ? sub.plan : sub?.status === "canceled" && sub.renewsAt > Date.now() ? sub.plan : "free" }));
  },
  cancelSubscription() {
    set(s => (s.subscription ? { ...s, subscription: { ...s.subscription, status: "canceled" } } : s));
  },

  // Training
  startSession(
    name: string,
    items: { id: string; sets: number; reps: string; rest: number }[],
    meta: { programId?: string; programDay?: string } = {}
  ) {
    set(s => ({
      ...s,
      active: {
        id: uid(),
        name,
        startedAt: Date.now(),
        ...meta,
        exercises: newSessionExercises(items),
      },
    }));
  },
  startProgramDay(programId: string, dayKeyStr: string) {
    const p = PROGRAM_BY_ID[programId];
    const day = p?.days.find(d => d.key === dayKeyStr);
    if (!p || !day) return;
    actions.startSession(`${p.name} · ${day.name}`, day.exercises, { programId, programDay: day.key });
  },
  updateSet(exIndex: number, setIndex: number, patch: Partial<SessionExercise["sets"][number]>) {
    set(s => {
      if (!s.active) return s;
      const exercises = s.active.exercises.map((e, i) =>
        i !== exIndex ? e : { ...e, sets: e.sets.map((x, j) => (j === setIndex ? { ...x, ...patch } : x)) }
      );
      return { ...s, active: { ...s.active, exercises } };
    });
  },
  addSet(exIndex: number) {
    set(s => {
      if (!s.active) return s;
      const exercises = s.active.exercises.map((e, i) => {
        if (i !== exIndex) return e;
        const last = e.sets.at(-1) ?? { reps: targetReps(e.target.reps), weight: 0, done: false };
        return { ...e, sets: [...e.sets, { ...last, done: false }] };
      });
      return { ...s, active: { ...s.active, exercises } };
    });
  },
  removeSet(exIndex: number) {
    set(s => {
      if (!s.active) return s;
      const exercises = s.active.exercises.map((e, i) =>
        i === exIndex && e.sets.length > 1 ? { ...e, sets: e.sets.slice(0, -1) } : e
      );
      return { ...s, active: { ...s.active, exercises } };
    });
  },
  addExercise(exerciseId: string) {
    const ex = getExercise(exerciseId);
    if (!ex) return;
    set(s => {
      if (!s.active) return s;
      const [item] = newSessionExercises([{ id: exerciseId, ...ex.defaults }]);
      return { ...s, active: { ...s.active, exercises: [...s.active.exercises, item!] } };
    });
  },
  swapExercise(exIndex: number, exerciseId: string) {
    set(s => {
      if (!s.active) return s;
      const old = s.active.exercises[exIndex];
      if (!old) return s;
      const [item] = newSessionExercises([{ id: exerciseId, ...old.target }]);
      const exercises = s.active.exercises.map((e, i) => (i === exIndex ? item! : e));
      return { ...s, active: { ...s.active, exercises } };
    });
  },
  removeExercise(exIndex: number) {
    set(s => {
      if (!s.active) return s;
      return { ...s, active: { ...s.active, exercises: s.active.exercises.filter((_, i) => i !== exIndex) } };
    });
  },
  discardSession() {
    set(s => ({ ...s, active: null }));
  },
  /** Saves the active session and returns the stored log. */
  finishSession(): WorkoutLog | null {
    const a = state.active;
    if (!a) return null;
    const exercises = a.exercises
      .map(e => ({ ...e, sets: e.sets.filter(x => x.done) }))
      .filter(e => e.sets.length);
    const prs: WorkoutLog["prs"] = [];
    for (const e of exercises) {
      const best = Math.max(...e.sets.map(x => e1rm(x.weight, x.reps)));
      const prev = bestE1rm(state.workouts, e.exerciseId);
      if (best > 0 && best > prev && prev > 0) prs.push({ exerciseId: e.exerciseId, e1rm: best });
    }
    const log: WorkoutLog = {
      id: a.id,
      name: a.name,
      date: dayKey(new Date(a.startedAt)),
      startedAt: a.startedAt,
      durationSec: Math.round((Date.now() - a.startedAt) / 1000),
      programId: a.programId,
      programDay: a.programDay,
      exercises,
      volume: sessionVolume(exercises),
      prs,
    };
    set(s => {
      let enrolled = s.enrolled;
      if (enrolled && a.programId === enrolled.programId && a.programDay) {
        enrolled = { ...enrolled, done: [...enrolled.done, a.programDay] };
      }
      return { ...s, active: null, workouts: [...s.workouts, log], enrolled };
    });
    return log;
  },
  /** Logs a finished follow-along class (video or live) as a session. */
  logClass(name: string, minutes: number) {
    const startedAt = Date.now() - minutes * 60_000;
    set(s => ({
      ...s,
      workouts: [
        ...s.workouts,
        { id: uid(), name, date: dayKey(), startedAt, durationSec: minutes * 60, exercises: [], volume: 0, prs: [] },
      ],
    }));
  },
  deleteWorkout(id: string) {
    set(s => ({ ...s, workouts: s.workouts.filter(w => w.id !== id) }));
  },
  enroll(programId: string) {
    set(s => ({ ...s, enrolled: { programId, startedAt: dayKey(), done: [] } }));
  },
  leaveProgram() {
    set(s => ({ ...s, enrolled: null }));
  },

  // Nutrition
  addFood(date: string, meal: MealId, entry: Omit<FoodEntry, "id">) {
    set(s => {
      const day = s.nutrition[date] ?? emptyDay();
      const meals = { ...day.meals, [meal]: [...day.meals[meal], { ...entry, id: uid() }] };
      const recentFoods = entry.foodId
        ? [entry.foodId, ...s.recentFoods.filter(x => x !== entry.foodId)].slice(0, 12)
        : s.recentFoods;
      return { ...s, nutrition: { ...s.nutrition, [date]: { ...day, meals } }, recentFoods };
    });
  },
  removeFood(date: string, meal: MealId, id: string) {
    set(s => {
      const day = s.nutrition[date];
      if (!day) return s;
      const meals = { ...day.meals, [meal]: day.meals[meal].filter(e => e.id !== id) };
      return { ...s, nutrition: { ...s.nutrition, [date]: { ...day, meals } } };
    });
  },
  addWater(date: string, ml: number) {
    set(s => {
      const day = s.nutrition[date] ?? emptyDay();
      return {
        ...s,
        nutrition: { ...s.nutrition, [date]: { ...day, waterMl: Math.max(0, day.waterMl + ml) } },
      };
    });
  },
  saveCustomFood(food: Food) {
    set(s => ({ ...s, customFoods: [food, ...s.customFoods.filter(f => f.id !== food.id)] }));
  },
  logWeight(kg: number, date = dayKey()) {
    set(s => {
      const weights = [...s.weights.filter(w => w.date !== date), { date, kg }].sort((a, b) =>
        a.date.localeCompare(b.date)
      );
      const profile = s.profile && date === dayKey() ? { ...s.profile, weightKg: kg } : s.profile;
      return { ...s, weights, profile };
    });
  },

  // Media & community
  toggleFavorite(kind: keyof AppState["favorites"], id: string) {
    set(s => ({ ...s, favorites: { ...s.favorites, [kind]: toggle(s.favorites[kind], id) } }));
  },
  toggleReminder(classId: string) {
    set(s => ({ ...s, reminders: toggle(s.reminders, classId) }));
  },
  setWatched(videoId: string, seconds: number) {
    set(s => ({ ...s, watched: { ...s.watched, [videoId]: seconds } }));
  },
  toggleChallenge(id: string) {
    set(s => ({ ...s, challenges: toggle(s.challenges, id) }));
  },

  // Demo data, so a fresh install has history to explore.
  seedDemo() {
    const p = state.profile;
    if (!p) return;
    const rnd = seededRandom(42);
    const now = new Date();
    // Follow the program the person is enrolled in, on a typical weekly split.
    const program = PROGRAM_BY_ID[state.enrolled?.programId ?? ""] ?? PROGRAM_BY_ID["fundamentos"]!;
    const trainingDays: Record<number, number[]> = {
      2: [2, 5],
      3: [1, 3, 5],
      4: [1, 2, 4, 5],
      5: [1, 2, 3, 4, 5],
      6: [1, 2, 3, 4, 5, 6],
    };
    const weekdays = trainingDays[program.daysPerWeek] ?? [1, 3, 5];
    const workouts: WorkoutLog[] = [];
    let n = 0;
    for (let d = 27; d >= 1; d--) {
      const date = addDays(now, -d);
      if (!weekdays.includes(date.getDay())) continue;
      const day = program.days[n++ % program.days.length]!;
      date.setHours(18, 30, 0, 0);
      const progress = (27 - d) / 27;
      const exercises: SessionExercise[] = day.exercises.map(it => {
        const ex = getExercise(it.id)!;
        const base = ex.loadType === "weight" ? (ex.primary.includes("quads") || ex.primary.includes("glutes") ? 40 : 16) : 0;
        const weight = base ? Math.round((base * (1 + progress * 0.25)) / 2.5) * 2.5 : 0;
        return {
          exerciseId: it.id,
          target: { sets: it.sets, reps: it.reps, rest: it.rest },
          sets: Array.from({ length: it.sets }, () => ({
            reps: targetReps(it.reps) - (rnd() < 0.25 ? 1 : 0),
            weight,
            done: true,
          })),
        };
      });
      workouts.push({
        id: uid(),
        name: `${program.name} · ${day.name}`,
        date: dayKey(date),
        startedAt: date.getTime(),
        durationSec: 2400 + Math.round(rnd() * 900),
        programId: program.id,
        programDay: day.key,
        exercises,
        volume: sessionVolume(exercises),
        prs: [],
        demo: true,
      });
    }

    const weights: { date: string; kg: number }[] = [];
    const start = p.weightKg + (p.goal === "perder" ? 2.4 : p.goal === "musculo" ? -1.2 : 0.6);
    for (let d = 34; d >= 0; d--) {
      const t = (34 - d) / 34;
      const kg = start + (p.weightKg - start) * t + (rnd() - 0.5) * 0.7;
      weights.push({ date: dayKey(addDays(now, -d)), kg: Math.round(kg * 10) / 10 });
    }

    const nutrition: Record<string, DayNutrition> = {};
    const plan: [MealId, string, number][] = [
      ["desayuno", "avena", 50],
      ["desayuno", "huevo", 100],
      ["desayuno", "banano", 120],
      ["almuerzo", "pollo-pechuga", 150],
      ["almuerzo", "arroz-blanco", 180],
      ["almuerzo", "aguacate", 60],
      ["snacks", "yogur-griego", 170],
      ["snacks", "almendras", 25],
      ["cena", "salmon", 130],
      ["cena", "batata", 150],
      ["cena", "brocoli", 100],
    ];
    for (let d = 14; d >= 1; d--) {
      const day = emptyDay();
      for (const [meal, foodId, grams] of plan) {
        if (rnd() < 0.12) continue;
        const f = FOOD_BY_ID[foodId]!;
        const g = Math.round(grams * (0.85 + rnd() * 0.3));
        day.meals[meal].push({ id: uid(), foodId, name: f.name, grams: g, ...portion(f, g) });
      }
      day.waterMl = 1500 + Math.round(rnd() * 8) * 250;
      nutrition[dayKey(addDays(now, -d))] = day;
    }

    set(s => ({
      ...s,
      workouts: [...s.workouts.filter(w => !w.demo), ...workouts],
      weights,
      nutrition: { ...nutrition, ...s.nutrition },
      enrolled: {
        programId: program.id,
        startedAt: dayKey(addDays(now, -27)),
        done: [...workouts.map(w => w.programDay!), ...(s.enrolled?.programId === program.id ? s.enrolled.done : [])],
      },
      hasDemoData: true,
    }));
  },
  clearDemo() {
    set(s => ({
      ...s,
      workouts: s.workouts.filter(w => !w.demo),
      hasDemoData: false,
    }));
  },
  resetAll() {
    set(() => initial());
  },
};
