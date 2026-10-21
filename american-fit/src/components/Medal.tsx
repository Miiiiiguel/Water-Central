import { Apple, Crown, Droplet, Dumbbell, Flame, Radio, ShoppingBag, Star, Sunrise, Target, Trophy, Weight } from "lucide-react";
import { useId } from "react";
import type { Achievement, Tier } from "@/lib/achievements";
import { cn } from "@/lib/utils";

const ICONS = { flame: Flame, dumbbell: Dumbbell, trophy: Trophy, sunrise: Sunrise, apple: Apple, droplet: Droplet, radio: Radio, crown: Crown, target: Target, star: Star, weight: Weight, bag: ShoppingBag };

const TIER: Record<Tier, [string, string, string]> = {
  bronce: ["#f0a36b", "#9c5a2e", "#5a2f12"],
  plata: ["#f3f6fb", "#9aa6b8", "#4a5468"],
  oro: ["#ffe08a", "#e0a419", "#7a4f00"],
};

/** Hexagonal medal; greyed out with a progress arc until earned. */
export function Medal({ a, done, progress, size = 76 }: { a: Achievement; done: boolean; progress: number; size?: number }) {
  const id = useId().replace(/:/g, "");
  const [hi, mid, lo] = TIER[a.tier];
  const Icon = ICONS[a.icon];
  const hex = "M50 4 L90 27 L90 73 L50 96 L10 73 L10 27 Z";
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className={cn("size-full drop-shadow-[0_8px_16px_rgb(0_0_0/0.35)]", !done && "grayscale")}>
        <defs>
          <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={hi} />
            <stop offset="0.55" stopColor={mid} />
            <stop offset="1" stopColor={lo} />
          </linearGradient>
        </defs>
        <path d={hex} fill={`url(#${id}-g)`} opacity={done ? 1 : 0.35} />
        <path d="M50 14 L81 32 L81 68 L50 86 L19 68 L19 32 Z" fill="rgb(0 0 0 / 0.18)" opacity={done ? 1 : 0.5} />
        {!done && (
          <path
            d={hex}
            fill="none"
            stroke="var(--color-brand)"
            strokeWidth={5}
            strokeLinejoin="round"
            pathLength={100}
            strokeDasharray={`${Math.max(2, progress * 100)} 100`}
          />
        )}
      </svg>
      <Icon className={cn("absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2", done ? "text-white" : "text-fg/70")} style={{ width: size * 0.36, height: size * 0.36 }} strokeWidth={2.2} />
    </div>
  );
}
