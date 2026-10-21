import { PROGRAM_PRODUCT } from "@/data/shop";
import type { VideoClass } from "./types";
import type { AppState } from "./store";

/*
 * What the Free plan includes. Everything else shows a paywall with a
 * button to upgrade or to buy that one item.
 */

export const FREE_PROGRAMS = new Set(["fundamentos", "quema-en-casa", "core-movilidad"]);

export const isPaid = (s: AppState) => s.plan === "pro" || s.plan === "elite";

export function canUseProgram(s: AppState, programId: string) {
  if (FREE_PROGRAMS.has(programId) || isPaid(s)) return true;
  const product = PROGRAM_PRODUCT[programId];
  return !!product && s.purchases.includes(product.id);
}

/** First episode of each series and stand-alone classes are free. */
export const isPremiumVideo = (v: VideoClass) => v.isReplay || (v.episode ?? 1) > 1;

export function canWatch(s: AppState, v: VideoClass) {
  return !isPremiumVideo(v) || isPaid(s);
}
