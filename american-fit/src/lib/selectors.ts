import { PROGRAM_BY_ID } from "@/data/programs";
import { LIVE_CLASSES, isLiveNow, nextOccurrence } from "@/data/media";
import type { AppState } from "./store";
import { dayTotals, targetsFor } from "./nutrition";
import { addDays, dayKey } from "./utils";

/** The program day to do next: the one completed the fewest times, in order. */
export function nextProgramDay(enrolled: AppState["enrolled"]) {
  if (!enrolled) return null;
  const program = PROGRAM_BY_ID[enrolled.programId];
  if (!program) return null;
  const counts = program.days.map(d => enrolled.done.filter(x => x === d.key).length);
  const min = Math.min(...counts);
  const day = program.days[counts.indexOf(min)]!;
  const totalSessions = program.weeks * program.daysPerWeek;
  return {
    program,
    day,
    completed: enrolled.done.length,
    total: totalSessions,
    week: Math.min(program.weeks, Math.floor(enrolled.done.length / program.daysPerWeek) + 1),
  };
}

export function upcomingLive(now = new Date()) {
  return LIVE_CLASSES.map(c => ({ c, at: nextOccurrence(c, now), live: isLiveNow(c, now) })).sort(
    (a, b) => Number(b.live) - Number(a.live) || a.at.getTime() - b.at.getTime()
  );
}

export function todayNutrition(s: AppState, date = dayKey()) {
  const day = s.nutrition[date];
  const totals = dayTotals(day);
  const targets = s.profile ? targetsFor(s.profile) : { kcal: 2000, protein: 140, carbs: 220, fat: 60, waterMl: 2500 };
  return { day, totals, targets, water: day?.waterMl ?? 0 };
}

/** Last 7 calendar days, oldest first, flagged with whether a workout was logged. */
export function weekActivity(s: AppState, now = new Date()) {
  const days = new Set(s.workouts.map(w => w.date));
  return Array.from({ length: 7 }, (_, i) => {
    const d = addDays(now, i - 6);
    return { date: d, key: dayKey(d), trained: days.has(dayKey(d)) };
  });
}
