import { AlertTriangle, CheckCircle2, Eye, Pause, Play, Repeat2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { DEMOS } from "./demos";
import { Figure } from "./Figure";
import { metricValue, poseAt, samplePath, solve, timeline, wrongPoses } from "./rig";

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Drives a demo's clock with requestAnimationFrame while `playing`. */
export function useDemoClock(playing: boolean, speed: number) {
  const [time, setTime] = useState(0);
  const last = useRef<number | null>(null);
  useEffect(() => {
    if (!playing) {
      last.current = null;
      return;
    }
    let raf = 0;
    const tick = (now: number) => {
      if (last.current !== null) {
        const dt = Math.min(0.05, (now - last.current) / 1000);
        setTime(t => t + dt * speed);
      }
      last.current = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed]);
  return [time, setTime] as const;
}

function useInView<T extends Element>() {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setInView(e!.isIntersecting), {
      threshold: 0.15,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, inView] as const;
}

/** A static keyframe of a demo, used on cards and list rows. */
export function DemoThumb({
  demoId,
  className,
  animate = false,
  tile = true,
}: {
  demoId: string;
  className?: string;
  animate?: boolean;
  tile?: boolean;
}) {
  const demo = DEMOS[demoId];
  const { segs, total } = useMemo(() => (demo ? timeline(demo) : { segs: [], total: 1 }), [demo]);
  const [time] = useDemoClock(animate && !!demo && !prefersReducedMotion(), 1);
  if (!demo) return null;
  const pose = animate
    ? poseAt(demo.poses, segs, total, time).pose
    : demo.poses[demo.thumb ?? 0]!;
  return <Figure demo={demo} s={solve(demo, pose)} compact tile={tile} className={className} />;
}

export function FormDemo({ demoId, className }: { demoId: string; className?: string }) {
  const demo = DEMOS[demoId];
  const [ref, inView] = useInView<HTMLDivElement>();
  const [userPaused, setUserPaused] = useState(prefersReducedMotion());
  const [slow, setSlow] = useState(false);
  const [wrong, setWrong] = useState(false);
  const [ghost, setGhost] = useState(false);
  const playing = inView && !userPaused;
  const [time, setTime] = useDemoClock(playing, slow ? 0.5 : 1);

  const { segs, total } = useMemo(() => timeline(demo!), [demo]);
  const poses = useMemo(() => (wrong ? wrongPoses(demo!) : demo!.poses), [demo, wrong]);
  const trail = useMemo(() => (demo!.trail ? samplePath(demo!, poses) : undefined), [demo, poses]);
  const ghosts = useMemo(
    () => (ghost ? poses.map(p => solve(demo!, p)) : undefined),
    [demo, poses, ghost]
  );

  if (!demo) return null;
  const { pose, seg, index, progress } = poseAt(poses, segs, total, time);
  const s = solve(demo, pose);
  const metric = metricValue(demo, s);

  const toggleWrong = () => {
    setWrong(w => !w);
    setTime(0);
  };

  return (
    <div ref={ref} className={cn("stage relative overflow-hidden rounded-3xl border border-line bg-ink-900", className)}>
      <div
        className={cn(
          "pointer-events-none absolute inset-0 transition-colors duration-500",
          wrong
            ? "bg-[radial-gradient(120%_80%_at_50%_0%,rgb(255_154_60/0.16),transparent_60%)]"
            : "bg-[radial-gradient(120%_80%_at_50%_0%,rgb(60_123_255/0.14),transparent_60%)]"
        )}
      />
      <div className="relative flex items-center justify-between gap-2 px-4 pt-4">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wider",
            wrong ? "bg-warn/15 text-warn" : "bg-success/12 text-success"
          )}
        >
          {wrong ? <AlertTriangle className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
          {wrong ? "Error común" : "Técnica correcta"}
        </span>
        {metric !== undefined && demo.metric && (
          <span className="tabular rounded-full bg-fg/5 px-2.5 py-1 text-xs text-muted">
            {demo.metric.label}{" "}
            <span className="font-semibold text-fg">{Math.round(metric)}°</span>
          </span>
        )}
      </div>

      <Figure
        demo={demo}
        s={s}
        trail={trail}
        ghosts={ghosts}
        wrong={wrong}
        className="relative mx-auto block aspect-[4/3] w-full max-w-xl"
      />

      <div className="relative space-y-3 px-4 pb-4">
        <div className="flex gap-1">
          {segs.map((sg, i) => (
            <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-fg/8" style={{ flexGrow: sg.end - sg.start }}>
              <div
                className={cn("h-full rounded-full", wrong ? "bg-warn" : "bg-brand")}
                style={{ width: i < index ? "100%" : i === index ? `${progress * 100}%` : "0%" }}
              />
            </div>
          ))}
        </div>
        <p className="min-h-10 text-[15px] font-medium leading-snug text-fg" aria-live="polite">
          {wrong ? demo.wrong?.title : seg.label}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setUserPaused(p => !p)}
            className="inline-flex size-10 items-center justify-center rounded-full bg-fg text-ink-950 transition active:scale-95"
            aria-label={playing ? "Pausar" : "Reproducir"}
          >
            {playing ? <Pause className="size-4" fill="currentColor" /> : <Play className="size-4 translate-x-px" fill="currentColor" />}
          </button>
          <Chip active={slow} onClick={() => setSlow(v => !v)}>
            <Repeat2 className="size-3.5" /> 0.5×
          </Chip>
          <Chip active={ghost} onClick={() => setGhost(v => !v)}>
            <Eye className="size-3.5" /> Rango
          </Chip>
          {demo.wrong && (
            <Chip active={wrong} tone="warn" onClick={toggleWrong}>
              <AlertTriangle className="size-3.5" /> Ver error
            </Chip>
          )}
        </div>
        {wrong && demo.wrong && (
          <p className="rounded-2xl border border-warn/25 bg-warn/8 p-3 text-sm leading-relaxed text-warn/90">
            {demo.wrong.note}
          </p>
        )}
      </div>
    </div>
  );
}

function Chip({
  active,
  tone = "brand",
  onClick,
  children,
}: {
  active: boolean;
  tone?: "brand" | "warn";
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-10 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition active:scale-95",
        active
          ? tone === "warn"
            ? "border-warn/40 bg-warn/15 text-warn"
            : "border-sky/40 bg-sky/15 text-sky-300"
          : "border-line-strong bg-fg/6 text-fg/85 hover:text-fg"
      )}
    >
      {children}
    </button>
  );
}
