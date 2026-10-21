import { describe, expect, it } from "vitest";
import { DEMOS } from "@/components/technique/demos";
import { reachReport, solve, timeline, wrongPoses } from "@/components/technique/rig";
import { COACH_BY_ID } from "@/data/coaches";
import { EXERCISE_BY_ID, EXERCISES } from "@/data/exercises";
import { LIVE_CLASSES, nextOccurrence, VIDEOS } from "@/data/media";
import { PROGRAMS } from "@/data/programs";
import { adaptiveTdee, bmr, portion, targetsFor } from "./nutrition";
import { e1rm, generateWorkout, recoveryLevels, targetReps } from "./training";
import type { Profile, WorkoutLog } from "./types";

const profile: Profile = {
  name: "Test",
  sex: "hombre",
  age: 30,
  heightCm: 180,
  weightKg: 80,
  targetWeightKg: 76,
  goal: "perder",
  level: "intermedio",
  place: "casa",
  equipment: ["dumbbell"],
  daysPerWeek: 4,
  minutes: 45,
  activity: "moderado",
  injuries: [],
  units: "kg",
  diet: "omnivora",
};

describe("technique demos", () => {
  it("every exercise points at an existing demo", () => {
    for (const ex of EXERCISES) expect(DEMOS[ex.demo], ex.id).toBeDefined();
  });

  it("keeps every limb target within reach", () => {
    for (const [id, demo] of Object.entries(DEMOS)) {
      const issues = reachReport(demo).flatMap(r => r.issues);
      expect(issues, id).toEqual([]);
    }
  });

  it("has a playable sequence and well-formed mistake patches", () => {
    for (const [id, demo] of Object.entries(DEMOS)) {
      const { total, segs } = timeline(demo);
      expect(total, id).toBeGreaterThan(0);
      for (const s of segs) expect(demo.poses[s.to], id).toBeDefined();
      if (demo.wrong) expect(wrongPoses(demo)).toHaveLength(demo.poses.length);
      const sk = solve(demo, demo.poses[0]!);
      expect(Number.isFinite(sk.kneeN[0] + sk.elbowN[1]), id).toBe(true);
    }
  });
});

describe("content integrity", () => {
  it("programs only reference real exercises and coaches", () => {
    for (const p of PROGRAMS) {
      expect(COACH_BY_ID[p.coachId], p.id).toBeDefined();
      for (const d of p.days) for (const e of d.exercises) expect(EXERCISE_BY_ID[e.id], `${p.id}/${e.id}`).toBeDefined();
    }
  });

  it("variations, classes and videos reference real ids", () => {
    for (const ex of EXERCISES)
      for (const v of [...(ex.easier ?? []), ...(ex.harder ?? [])]) expect(EXERCISE_BY_ID[v], `${ex.id}→${v}`).toBeDefined();
    for (const c of LIVE_CLASSES) expect(COACH_BY_ID[c.coachId], c.id).toBeDefined();
    for (const v of VIDEOS) expect(COACH_BY_ID[v.coachId], v.id).toBeDefined();
  });

  it("finds the next live class occurrence", () => {
    const monday = new Date(2026, 9, 19, 5, 0);
    const c = LIVE_CLASSES.find(x => x.id === "despierta-hiit")!;
    const next = nextOccurrence(c, monday);
    expect(next.getDay()).toBe(1);
    expect(next.getHours()).toBe(6);
    expect(next.getMinutes()).toBe(30);
  });
});

describe("nutrition", () => {
  it("computes Mifflin–St Jeor", () => {
    expect(bmr(profile)).toBe(1780);
    expect(bmr({ ...profile, sex: "mujer" })).toBe(1614);
  });

  it("splits targets into macros that add up to the calories", () => {
    const t = targetsFor(profile);
    expect(t.protein).toBe(176);
    const fromMacros = t.protein * 4 + t.carbs * 4 + t.fat * 9;
    expect(Math.abs(fromMacros - t.kcal)).toBeLessThan(15);
  });

  it("scales foods per 100 g", () => {
    expect(portion({ kcal: 200, protein: 10, carbs: 20, fat: 5 }, 150)).toEqual({ kcal: 300, protein: 15, carbs: 30, fat: 7.5 });
  });

  it("estimates maintenance from intake and a flat weight trend", () => {
    const weights = Array.from({ length: 14 }, (_, i) => ({ date: `2026-10-${String(i + 1).padStart(2, "0")}`, kg: 80 }));
    expect(adaptiveTdee(Array(14).fill(2500), weights)).toBe(2500);
    expect(adaptiveTdee([2500], weights)).toBeNull();
  });
});

describe("training", () => {
  it("estimates 1RM with Epley", () => {
    expect(e1rm(100, 5)).toBe(116.7);
    expect(e1rm(100, 1)).toBe(100);
    expect(e1rm(0, 10)).toBe(0);
  });

  it("reads the top of a rep range", () => {
    expect(targetReps("8-10")).toBe(10);
    expect(targetReps("12 por pierna")).toBe(12);
    expect(targetReps("30 s")).toBe(30);
  });

  it("marks freshly trained muscles as fatigued and fades them", () => {
    const now = Date.now();
    const w: WorkoutLog = {
      id: "w",
      name: "Pierna",
      date: "2026-10-21",
      startedAt: now - 3_600_000,
      durationSec: 1800,
      exercises: [
        {
          exerciseId: "sentadilla-barra",
          target: { sets: 8, reps: "5", rest: 120 },
          sets: Array.from({ length: 8 }, () => ({ reps: 5, weight: 100, done: true })),
        },
      ],
      volume: 4000,
      prs: [],
    };
    expect(recoveryLevels([w], now).quads).toBeGreaterThan(0.9);
    expect(recoveryLevels([w], now + 80 * 3_600_000).quads).toBeUndefined();
  });

  it("only generates exercises the person has equipment for", () => {
    const plan = generateWorkout(profile, [], "full", 45, 1);
    expect(plan.exercises.length).toBeGreaterThanOrEqual(3);
    for (const e of plan.exercises) {
      const ex = EXERCISE_BY_ID[e.id]!;
      expect(ex.equipment.some(q => q === "bodyweight" || q === "dumbbell"), e.id).toBe(true);
    }
  });
});
