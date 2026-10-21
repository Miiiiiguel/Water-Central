import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
 * Two small hand-rolled charts (trend line, column chart). Specs follow
 * the dataviz rules used across the app: 2px lines, ≥8px markers with a
 * surface ring, ≤24px columns with 4px rounded tops, hairline solid
 * grid, one axis, and a hover tooltip on every chart.
 */

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e!.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

function niceTicks(min: number, max: number, count = 4) {
  const span = max - min || 1;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => s >= raw) ?? raw;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

const compact = (n: number) =>
  n >= 1000 ? `${Math.round(n / 100) / 10}K`.replace(".0K", "K") : `${Math.round(n * 10) / 10}`;

function Tooltip({ x, y, width, children }: { x: number; y: number; width: number; children: ReactNode }) {
  const left = Math.min(Math.max(x, 70), width - 70);
  return (
    <div
      className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-xl border border-line-strong bg-ink-800/95 px-3 py-2 text-xs shadow-xl backdrop-blur"
      style={{ left, top: y - 10 }}
    >
      {children}
    </div>
  );
}

export interface TrendPoint {
  label: string;
  value: number;
  trend?: number;
}

/** Daily readings as dots plus a smoothed trend line (e.g. weight). */
export function TrendChart({
  data,
  unit,
  height = 200,
  color = "var(--color-sky)",
  className,
}: {
  data: TrendPoint[];
  unit: string;
  height?: number;
  color?: string;
  className?: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 36, r: 12, t: 12, b: 24 };
  const values = data.flatMap(d => [d.value, d.trend ?? d.value]);
  const ticks = niceTicks(Math.min(...values), Math.max(...values));
  const min = ticks[0]!;
  const max = ticks[ticks.length - 1]!;
  const iw = Math.max(1, width - pad.l - pad.r);
  const ih = height - pad.t - pad.b;
  const x = (i: number) => pad.l + (data.length <= 1 ? iw / 2 : (i / (data.length - 1)) * iw);
  const y = (v: number) => pad.t + ih - ((v - min) / (max - min || 1)) * ih;
  const line = data
    .map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.trend ?? d.value).toFixed(1)}`)
    .join(" ");
  const area = `${line} L${x(data.length - 1)},${pad.t + ih} L${x(0)},${pad.t + ih} Z`;
  const last = data[data.length - 1];

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const i = Math.round(((px - pad.l) / iw) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  };

  return (
    <div ref={ref} className={cn("relative select-none", className)}>
      {width > 0 && data.length > 0 && (
        <svg
          width={width}
          height={height}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
          className="touch-pan-y"
          role="img"
          aria-label={`Tendencia: último valor ${last ? compact(last.trend ?? last.value) : ""} ${unit}`}
        >
          {ticks.map(t => (
            <g key={t}>
              <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} stroke="var(--color-line)" />
              <text x={pad.l - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-faint text-[10px] tabular">
                {compact(t)}
              </text>
            </g>
          ))}
          {[0, Math.floor((data.length - 1) / 2), data.length - 1].map(i => (
            <text key={i} x={x(i)} y={height - 6} textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"} className="fill-faint text-[10px]">
              {data[i]?.label}
            </text>
          ))}
          <path d={area} fill={color} opacity={0.1} />
          {data.map((d, i) => (
            <circle key={i} cx={x(i)} cy={y(d.value)} r={2.5} fill={color} opacity={0.35} />
          ))}
          <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {last && (
            <>
              <circle cx={x(data.length - 1)} cy={y(last.trend ?? last.value)} r={6} fill="var(--color-ink-900)" />
              <circle cx={x(data.length - 1)} cy={y(last.trend ?? last.value)} r={4} fill={color} />
            </>
          )}
          {hover !== null && data[hover] && (
            <g>
              <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} stroke="var(--color-line-strong)" />
              <circle cx={x(hover)} cy={y(data[hover]!.trend ?? data[hover]!.value)} r={6} fill="var(--color-ink-900)" />
              <circle cx={x(hover)} cy={y(data[hover]!.trend ?? data[hover]!.value)} r={4} fill={color} />
            </g>
          )}
        </svg>
      )}
      {hover !== null && data[hover] && (
        <Tooltip x={x(hover)} y={y(data[hover]!.trend ?? data[hover]!.value)} width={width}>
          <div className="text-muted">{data[hover]!.label}</div>
          <div className="tabular font-semibold">
            {compact(data[hover]!.value)} {unit}
          </div>
          {data[hover]!.trend !== undefined && (
            <div className="tabular text-muted">
              Tendencia {compact(data[hover]!.trend!)} {unit}
            </div>
          )}
        </Tooltip>
      )}
    </div>
  );
}

/** Single-series columns (e.g. weekly volume). */
export function ColumnChart({
  data,
  unit,
  height = 180,
  color = "var(--color-brand)",
  highlightLast = true,
  className,
}: {
  data: { label: string; value: number }[];
  unit: string;
  height?: number;
  color?: string;
  highlightLast?: boolean;
  className?: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 36, r: 6, t: 14, b: 22 };
  const ticks = niceTicks(0, Math.max(1, ...data.map(d => d.value)), 3);
  const max = ticks[ticks.length - 1]!;
  const iw = Math.max(1, width - pad.l - pad.r);
  const ih = height - pad.t - pad.b;
  const band = iw / Math.max(1, data.length);
  const bw = Math.min(24, band * 0.6);
  const y = (v: number) => pad.t + ih - (v / max) * ih;

  return (
    <div ref={ref} className={cn("relative select-none", className)}>
      {width > 0 && (
        <svg width={width} height={height} onPointerLeave={() => setHover(null)} role="img" aria-label={`Columnas de ${unit}`}>
          {ticks.map(t => (
            <g key={t}>
              <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} stroke="var(--color-line)" />
              <text x={pad.l - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-faint text-[10px] tabular">
                {compact(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const cx = pad.l + band * i + band / 2;
            const top = y(d.value);
            const h = pad.t + ih - top;
            const r = Math.min(4, h);
            const isLast = highlightLast && i === data.length - 1;
            return (
              <g key={i} onPointerEnter={() => setHover(i)}>
                <rect x={cx - band / 2} y={pad.t} width={band} height={ih} fill="transparent" />
                {h > 0 && (
                  <path
                    d={`M${cx - bw / 2},${pad.t + ih} V${top + r} Q${cx - bw / 2},${top} ${cx - bw / 2 + r},${top} H${cx + bw / 2 - r} Q${cx + bw / 2},${top} ${cx + bw / 2},${top + r} V${pad.t + ih} Z`}
                    fill={color}
                    opacity={isLast || hover === i ? 1 : 0.55}
                  />
                )}
                <text x={cx} y={height - 6} textAnchor="middle" className="fill-faint text-[10px]">
                  {d.label}
                </text>
              </g>
            );
          })}
        </svg>
      )}
      {hover !== null && data[hover] && (
        <Tooltip x={pad.l + band * hover + band / 2} y={y(data[hover]!.value)} width={width}>
          <div className="text-muted">{data[hover]!.label}</div>
          <div className="tabular font-semibold">
            {Math.round(data[hover]!.value).toLocaleString("es")} {unit}
          </div>
        </Tooltip>
      )}
    </div>
  );
}

/** Concentric macro rings with a legend; identity never relies on color alone. */
export function MacroRings({
  items,
  size = 132,
  center,
}: {
  items: { label: string; value: number; target: number; color: string; unit?: string }[];
  size?: number;
  center?: ReactNode;
}) {
  const stroke = 9;
  const gap = 4;
  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" role="img" aria-label="Progreso de macronutrientes">
          {items.map((it, i) => {
            const r = size / 2 - stroke / 2 - i * (stroke + gap);
            const c = 2 * Math.PI * r;
            const v = Math.min(1, it.target ? it.value / it.target : 0);
            return (
              <g key={it.label}>
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(255 255 255 / 0.07)" strokeWidth={stroke} />
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={it.color}
                  strokeWidth={stroke}
                  strokeLinecap="round"
                  strokeDasharray={c}
                  strokeDashoffset={c * (1 - v)}
                  style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(0.22,1,0.36,1)" }}
                />
              </g>
            );
          })}
        </svg>
        {center && <div className="absolute inset-0 grid place-items-center text-center">{center}</div>}
      </div>
      <ul className="min-w-0 flex-1 space-y-2.5">
        {items.map(it => (
          <li key={it.label} className="flex items-center gap-2.5">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: it.color }} />
            <span className="flex-1 text-[13px] text-muted">{it.label}</span>
            <span className="tabular text-[13px] font-semibold">
              {Math.round(it.value)}
              <span className="font-normal text-muted">
                /{Math.round(it.target)}
                {it.unit ?? "g"}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
