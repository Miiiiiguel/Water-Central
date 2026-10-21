import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "framer-motion";
import { useEffect, useMemo, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Number that counts up to its value when it appears or changes. */
export function CountUp({ value, decimals = 0, className }: { value: number; decimals?: number; className?: string }) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(reduce ? value : 0);
  const text = useTransform(mv, v => v.toLocaleString("es", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }));
  useEffect(() => {
    if (reduce) {
      mv.set(value);
      return;
    }
    const c = animate(mv, value, { duration: 1.1, ease: [0.22, 1, 0.36, 1] });
    return () => c.stop();
  }, [value, mv, reduce]);
  return <motion.span className={cn("tabular", className)}>{text}</motion.span>;
}

export interface Ring {
  label: string;
  value: number;
  goal: number;
  unit: string;
  from: string;
  to: string;
}

/**
 * Concentric activity rings (move / train / nourish), each drawn with its
 * own gradient and a round cap, animating in from zero. Values past the
 * goal keep going around so overachievement is visible.
 */
export function ActivityRings({ rings, size = 168, stroke = 16 }: { rings: Ring[]; size?: number; stroke?: number }) {
  const gap = 4;
  const ids = useMemo(() => rings.map((_, i) => `ring-${i}-${Math.random().toString(36).slice(2, 7)}`), [rings]);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" role="img" aria-label={rings.map(r => `${r.label} ${Math.round((r.value / r.goal) * 100)}%`).join(", ")}>
      <defs>
        {rings.map((r, i) => (
          <linearGradient key={i} id={ids[i]} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={r.from} />
            <stop offset="1" stopColor={r.to} />
          </linearGradient>
        ))}
      </defs>
      {rings.map((r, i) => {
        const rad = size / 2 - stroke / 2 - i * (stroke + gap);
        const c = 2 * Math.PI * rad;
        const p = Math.max(0, r.goal ? r.value / r.goal : 0);
        return (
          <g key={r.label}>
            <circle cx={size / 2} cy={size / 2} r={rad} fill="none" stroke={r.from} strokeOpacity={0.18} strokeWidth={stroke} />
            <motion.circle
              cx={size / 2}
              cy={size / 2}
              r={rad}
              fill="none"
              stroke={`url(#${ids[i]})`}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={c}
              initial={{ strokeDashoffset: c }}
              animate={{ strokeDashoffset: c * (1 - Math.min(p, 0.999)) }}
              transition={{ duration: 1.3, delay: 0.15 * i, ease: [0.22, 1, 0.36, 1] }}
            />
          </g>
        );
      })}
    </svg>
  );
}

const COLORS = ["#ff3b4e", "#ff7a45", "#3c7bff", "#2be09a", "#ffb547", "#7b5cff", "#ffffff"];

/** A one-shot burst of confetti for wins (workout done, payment approved). */
export function Confetti({ count = 70 }: { count?: number }) {
  const reduce = useReducedMotion();
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        x: (Math.random() - 0.5) * 900,
        y: 200 + Math.random() * 600,
        r: Math.random() * 720 - 360,
        d: 1.6 + Math.random() * 1.4,
        w: 6 + Math.random() * 6,
        c: COLORS[i % COLORS.length]!,
        round: Math.random() > 0.6,
      })),
    [count]
  );
  if (reduce) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden>
      {pieces.map((p, i) => (
        <motion.span
          key={i}
          className="absolute left-1/2 top-[30%] block"
          style={{ width: p.w, height: p.round ? p.w : p.w * 1.8, background: p.c, borderRadius: p.round ? 999 : 2 }}
          initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
          animate={{ x: p.x, y: [0, -220 - Math.random() * 160, p.y], rotate: p.r, opacity: [1, 1, 0] }}
          transition={{ duration: p.d, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}

/** Staggered entrance for a list of children. */
export function Stagger({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}
    >
      {children}
    </motion.div>
  );
}

export const staggerItem = {
  variants: {
    hidden: { opacity: 0, y: 16, scale: 0.98 },
    show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const } },
  },
};
