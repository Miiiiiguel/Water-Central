import { useSyncExternalStore } from "react";

/*
 * Reading preferences for this device (not per account): theme, high
 * contrast and text size. Applied as attributes on <html>, see the
 * "Reading preferences" block in index.css.
 */

export type Theme = "auto" | "dark" | "light";
export type TextSize = "normal" | "grande" | "extra";

export interface Prefs {
  theme: Theme;
  contrast: boolean;
  size: TextSize;
}

// Storage keys keep the pre-rename prefix so existing devices keep their data.
const KEY = "americanfit:prefs";
const SIZES: Record<TextSize, string> = { normal: "106.25%", grande: "118.75%", extra: "131.25%" };

function read(): Prefs {
  try {
    return { theme: "auto", contrast: false, size: "normal", ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return { theme: "auto", contrast: false, size: "normal" };
  }
}

let prefs = read();
const listeners = new Set<() => void>();
const media = typeof window !== "undefined" ? window.matchMedia?.("(prefers-color-scheme: light)") : undefined;

export function apply() {
  const root = document.documentElement;
  const light = prefs.theme === "light" || (prefs.theme === "auto" && !!media?.matches);
  root.dataset.theme = light ? "light" : "dark";
  if (prefs.contrast) root.dataset.contrast = "high";
  else delete root.dataset.contrast;
  root.style.setProperty("--fs", SIZES[prefs.size]);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", light ? "#eef0f4" : "#07090f");
}

media?.addEventListener?.("change", () => {
  apply();
  listeners.forEach(l => l());
});

export function setPrefs(patch: Partial<Prefs>) {
  prefs = { ...prefs, ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    // Ignore: preference lasts for this visit.
  }
  apply();
  listeners.forEach(l => l());
}

export function usePrefs() {
  return useSyncExternalStore(
    cb => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => prefs
  );
}
