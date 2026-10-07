import { useEffect, useRef, useState } from 'react';
import { fmtInt, fmtMoney } from '@/lib/roiFormat';

// Cumulative cash balance across the twelve months of year 1, one line
// per scenario. Two series, so the legend is always shown and each line
// is also labelled at its end point — identity is never colour alone.
//
// Deliberately a line chart: the question is "when does the balance
// cross zero, and when does it cover what was invested", which is about
// a path over time, not a comparison of totals. So the zero line, the
// investment line and the month each line crosses them are what the
// chart draws loudest. Each point is the running sum of the "profit or
// loss for the month" row of the free table: the same numbers.
//
// The SVG is drawn at the width it actually has (not a scaled viewBox),
// so the 12 px labels stay 12 px on a phone.

const CONS = '#FF5A36', CONS_TEXT = '#C8481A';
const OPT = '#4A63D6', OPT_TEXT = '#1F2E73';
const MUTED = '#8B84A6', GRID = '#EFEAF8';
const T = 16, B = 30, H = 280;

/** 3 to 6 round ticks covering [min, max]. */
function ticks(min: number, max: number): number[] {
  const span = max - min || 1;
  const raw = span / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= 5) ?? 10 * mag;
  const out: number[] = [];
  for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(Math.round(v));
  return out;
}

const corto = (v: number) => {
  const a = Math.abs(v);
  const s = a >= 1e6 ? `${(a / 1e6).toFixed(a >= 1e7 ? 0 : 1)}M` : a >= 1000 ? `${Math.round(a / 1000)}k` : `${Math.round(a)}`;
  return `${v < 0 ? '−' : ''}$${s}`;
};

/** First month (0-based) the balance is at or above `umbral`. */
const cruce = (s: number[], umbral = 0) => s.findIndex((v) => v >= umbral);

export default function CashChart({
  conservative,
  optimistic,
  inversion,
  unidades,
  labels,
}: {
  conservative: number[];
  optimistic: number[];
  /**
   * Lo que hay que poner para arrancar. Se dibuja como una línea: donde el
   * saldo la cruza es el mes en que se recupera (el mismo de la tarjeta).
   */
  inversion?: number;
  /** Unidades por mes de cada escenario, para el detalle de cada mes (las mismas de la tabla). */
  unidades?: { conservative: number[]; optimistic: number[] };
  labels: {
    conservative: string;
    optimistic: string;
    month: (n: number) => string;
    /** Short month label for the axis ("M1"). */
    monthShort: (n: number) => string;
    title: string;
    breakEven: string;
    lossZone: string;
    /** "Recuperas lo invertido" */
    payback?: string;
    /** "Inversión" */
    investment?: string;
    /** "unidades" */
    units?: string;
  };
}) {
  const caja = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  const [foco, setFoco] = useState<number | null>(null);

  useEffect(() => {
    const el = caja.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const angosto = W < 520;
  const L = angosto ? 46 : 56, R = angosto ? 14 : 22;
  const plotW = W - L - R;
  const plotH = H - T - B;
  const xAt = (i: number) => L + i * (plotW / 11);

  const conInversion = inversion !== undefined && inversion > 0;
  const all = [...conservative, ...optimistic, 0, ...(conInversion ? [inversion] : [])];
  const maxVal = Math.max(...all);
  const minVal = Math.min(...all);
  const pad = (maxVal - minVal) * 0.1 || 1000;
  const yMax = maxVal + pad;
  const yMin = minVal - (minVal < 0 ? pad : 0);
  const range = yMax - yMin || 1;
  const y = (v: number) => T + ((yMax - v) / range) * plotH;
  const zeroY = y(0);

  const linea = (s: number[]) => s.map((v, i) => `${i ? 'L' : 'M'}${xAt(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const area = (s: number[]) => `${linea(s)}L${xAt(11).toFixed(1)},${zeroY.toFixed(1)}L${xAt(0).toFixed(1)},${zeroY.toFixed(1)}Z`;

  const consLastY = y(conservative[11]);
  const optLastY = y(optimistic[11]);
  // Nudge one label away when the two lines finish on top of each other.
  const collide = Math.abs(consLastY - optLastY) < 16;
  const consLabelY = collide && consLastY > optLastY ? consLastY + 18 : consLastY - 10;
  const optLabelY = collide && consLastY <= optLastY ? optLastY + 18 : optLastY - 10;

  const cruces = [
    { i: cruce(conservative), color: CONS, text: CONS_TEXT },
    { i: cruce(optimistic), color: OPT, text: OPT_TEXT },
  ].filter((c) => c.i >= 0);
  const recuperos = conInversion
    ? [
        { i: cruce(conservative, inversion), color: CONS, text: CONS_TEXT },
        { i: cruce(optimistic, inversion), color: OPT, text: OPT_TEXT },
      ].filter((c) => c.i >= 0)
    : [];
  const invY = conInversion ? y(inversion) : 0;

  const ys = ticks(yMin, yMax);
  const mesesEje = Array.from({ length: 12 }, (_, i) => i).filter((i) => !angosto || (i % 2 === 0 && i !== 10) || i === 11);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2">
        <span className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <span className="h-[3px] w-5 flex-none rounded-full" style={{ background: CONS }} />
          {labels.conservative}
        </span>
        <span className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <span className="h-[3px] w-5 flex-none rounded-full" style={{ background: OPT }} />
          {labels.optimistic}
        </span>
        {minVal < 0 && (
          <span className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <span className="h-3 w-3 flex-none rounded-sm bg-red-100" />
            {labels.lossZone}
          </span>
        )}
      </div>

      <div ref={caja} className="relative w-full" style={{ height: H }}>
        <svg width={W} height={H} className="block" role="img" aria-label={labels.title} onMouseLeave={() => setFoco(null)}>
          <defs>
            <linearGradient id="cc-cons" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={CONS} stopOpacity="0.16" />
              <stop offset="1" stopColor={CONS} stopOpacity="0" />
            </linearGradient>
            <linearGradient id="cc-opt" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={OPT} stopOpacity="0.14" />
              <stop offset="1" stopColor={OPT} stopOpacity="0" />
            </linearGradient>
            <clipPath id="cc-arriba"><rect x={L} y={T} width={plotW} height={Math.max(0, zeroY - T)} /></clipPath>
          </defs>

          {/* Loss zone: everything under $0. */}
          {minVal < 0 && <rect x={L} y={zeroY} width={plotW} height={Math.max(0, T + plotH - zeroY)} fill="#FEF2F2" />}

          {ys.map((v) => (
            <g key={v}>
              {v !== 0 && <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={GRID} strokeWidth="1" />}
              <text x={L - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill={MUTED} className="tabular-nums">{corto(v)}</text>
            </g>
          ))}
          <line x1={L} y1={zeroY} x2={W - R} y2={zeroY} stroke="#B9B0D3" strokeWidth="1.5" />

          {/* What was put in: crossing it is getting the investment back. */}
          {conInversion && (
            <g>
              <line x1={L} x2={W - R} y1={invY} y2={invY} stroke="#16A34A" strokeWidth="1.5" strokeDasharray="6 4" />
              <text x={L + 6} y={invY - 6} fontSize="11" fontWeight="700" fill="#15803D">
                {labels.investment ?? 'Investment'} {fmtMoney(inversion)}
              </text>
            </g>
          )}

          {/* Faint fill above zero only: profit is what the area shows. */}
          <g clipPath="url(#cc-arriba)">
            <path d={area(optimistic)} fill="url(#cc-opt)" />
            <path d={area(conservative)} fill="url(#cc-cons)" />
          </g>

          <path d={linea(optimistic)} fill="none" stroke={OPT} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <path d={linea(conservative)} fill="none" stroke={CONS} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

          {/* Break-even: the month each line crosses $0. */}
          {cruces.map((c, k) => (
            <g key={k}>
              <line x1={xAt(c.i)} x2={xAt(c.i)} y1={zeroY} y2={T + plotH} stroke={c.color} strokeWidth="1.5" strokeDasharray="3 3" />
              <circle cx={xAt(c.i)} cy={zeroY} r="5" fill="#fff" stroke={c.color} strokeWidth="2.5" />
            </g>
          ))}

          {recuperos.map((c, k) => (
            <circle key={`r${k}`} cx={xAt(c.i)} cy={invY} r="5" fill="#16A34A" stroke="#fff" strokeWidth="2" />
          ))}

          <circle cx={xAt(11)} cy={consLastY} r="5" fill={CONS} stroke="#fff" strokeWidth="2" />
          <circle cx={xAt(11)} cy={optLastY} r="5" fill={OPT} stroke="#fff" strokeWidth="2" />
          {foco === null && (
            <>
              <text x={xAt(11) - 12} y={consLabelY} textAnchor="end" fontWeight="800" fontSize="12" fill={CONS_TEXT}>{fmtMoney(conservative[11])}</text>
              <text x={xAt(11) - 12} y={optLabelY} textAnchor="end" fontWeight="800" fontSize="12" fill={OPT_TEXT}>{fmtMoney(optimistic[11])}</text>
            </>
          )}

          {mesesEje.map((i) => (
            <text key={i} x={xAt(i)} y={H - 10} textAnchor={i === 0 ? 'start' : i === 11 ? 'end' : 'middle'} fontSize="11" fill={foco === i ? OPT_TEXT : MUTED} fontWeight={foco === i ? 700 : 400}>
              {labels.monthShort(i + 1)}
            </text>
          ))}

          {foco !== null && (
            <g pointerEvents="none">
              <line x1={xAt(foco)} x2={xAt(foco)} y1={T} y2={T + plotH} stroke="#CFC8E4" strokeWidth="1" />
              <circle cx={xAt(foco)} cy={y(conservative[foco])} r="5" fill={CONS} stroke="#fff" strokeWidth="2" />
              <circle cx={xAt(foco)} cy={y(optimistic[foco])} r="5" fill={OPT} stroke="#fff" strokeWidth="2" />
            </g>
          )}

          {/* One hit band per month for hover and tap. */}
          {Array.from({ length: 12 }, (_, i) => (
            <rect
              key={i}
              x={xAt(i) - plotW / 22}
              y={T}
              width={plotW / 11}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => setFoco(i)}
              onClick={() => setFoco((f) => (f === i ? null : i))}
            />
          ))}
        </svg>

        {foco !== null && (
          <div
            className="pointer-events-none absolute top-1 z-10 min-w-[150px] rounded-xl border border-gray-100 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur"
            style={xAt(foco) > W / 2 ? { right: W - xAt(foco) + 10 } : { left: xAt(foco) + 10 }}
          >
            <p className="mb-1 font-bold text-primary">{labels.month(foco + 1)}</p>
            {([
              ['conservative', conservative, CONS_TEXT],
              ['optimistic', optimistic, OPT_TEXT],
            ] as const).map(([k, serie, color]) => (
              <p key={k} className="flex justify-between gap-3">
                <span style={{ color }}>{labels[k]}</span>
                <span className="text-right">
                  <b className="tabular-nums">{fmtMoney(serie[foco])}</b>
                  {unidades && (
                    <span className="block text-[10px] text-muted-foreground tabular-nums">
                      {fmtInt(unidades[k][foco])} {labels.units ?? 'units'}
                    </span>
                  )}
                </span>
              </p>
            ))}
          </div>
        )}
      </div>

      {(cruces.length > 0 || recuperos.length > 0) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {cruces.map((c, k) => (
            <span key={k} className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold" style={{ borderColor: c.color + '40', color: c.text }}>
              <span className="h-2 w-2 rounded-full border-2 bg-white" style={{ borderColor: c.color }} />
              {labels.breakEven} · {labels.month(c.i + 1)}
            </span>
          ))}
          {recuperos.map((c, k) => (
            <span key={`r${k}`} className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-bold" style={{ color: c.text }}>
              <span className="h-2 w-2 rounded-full bg-green-600" />
              {labels.payback ?? 'Payback'} · {labels.month(c.i + 1)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
