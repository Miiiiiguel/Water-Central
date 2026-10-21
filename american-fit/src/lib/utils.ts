import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export const uid = () =>
  Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

/** Local calendar day as YYYY-MM-DD (not UTC: a 10pm log belongs to today). */
export function dayKey(d: Date = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function addDays(d: Date, n: number) {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

export function fromDayKey(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

const nf0 = new Intl.NumberFormat("es", { maximumFractionDigits: 0 });
const nf1 = new Intl.NumberFormat("es", { maximumFractionDigits: 1 });

export const fmt0 = (n: number) => nf0.format(n);
export const fmt1 = (n: number) => nf1.format(n);

export function fmtDuration(totalSec: number) {
  const s = Math.max(0, Math.round(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function fmtMinutes(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

const weekdayFmt = new Intl.DateTimeFormat("es", { weekday: "short" });
const dayMonthFmt = new Intl.DateTimeFormat("es", {
  day: "numeric",
  month: "short",
});
const timeFmt = new Intl.DateTimeFormat("es", {
  hour: "2-digit",
  minute: "2-digit",
});
const longDateFmt = new Intl.DateTimeFormat("es", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

export const fmtWeekday = (d: Date) => weekdayFmt.format(d).replace(".", "");
export const fmtDayMonth = (d: Date) => dayMonthFmt.format(d).replace(".", "");
export const fmtTime = (d: Date) => timeFmt.format(d);
export const fmtLongDate = (d: Date) => {
  const s = longDateFmt.format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export function greeting(d: Date = new Date()) {
  const h = d.getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0]!.toUpperCase())
    .join("");
}

export function seededRandom(seed: number) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

export function normalize(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}
