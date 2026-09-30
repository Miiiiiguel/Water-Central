import { fmtMoney } from '@/lib/roiFormat';

// Cumulative cash balance across the twelve months of year 1, one line
// per scenario. Two series, so the legend is always shown and each line
// is also labelled at its end point — identity is never colour alone.
//
// Deliberately a line chart: the question is "when does the balance
// cross zero", which is about a path over time, not a comparison of
// totals.

const L = 60, R = 40, T = 24, B = 44, W = 960, H = 380;
const plotW = W - L - R;
const plotH = H - T - B;
const xAt = (i: number) => L + i * (plotW / 11);

export default function CashChart({
  conservative,
  optimistic,
  labels,
}: {
  conservative: number[];
  optimistic: number[];
  labels: { conservative: string; optimistic: string; month: (n: number) => string; title: string };
}) {
  const all = [...conservative, ...optimistic, 0];
  const maxVal = Math.max(...all);
  const minVal = Math.min(...all);
  const yMax = maxVal * 1.12 || 1000;
  const yMin = minVal * 1.2 || -1000;
  const range = yMax - yMin || 1;
  const y = (v: number) => T + ((yMax - v) / range) * plotH;

  const points = (series: number[]) => series.map((v, i) => `${xAt(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');

  const zeroY = y(0);
  const consLastY = y(conservative[11]);
  const optLastY = y(optimistic[11]);
  // Nudge one label away when the two lines finish on top of each other.
  const collide = Math.abs(consLastY - optLastY) < 16;
  const consLabelY = collide && consLastY > optLastY ? consLastY + 16 : consLastY - 9;
  const optLabelY = collide && consLastY <= optLastY ? optLastY + 16 : optLastY - 9;

  return (
    <div className="rounded-3xl border border-gray-100 bg-white app-shadow p-6 pb-3">
      <div className="mb-2 flex flex-wrap gap-5">
        <span className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <span className="h-3.5 w-3.5 flex-none rounded bg-accent" />
          {labels.conservative}
        </span>
        <span className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <span className="h-3.5 w-3.5 flex-none rounded bg-[#4A63D6]" />
          {labels.optimistic}
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={labels.title}>
        <line x1={L} y1={zeroY} x2={W - R} y2={zeroY} stroke="#D8D0EC" strokeWidth="1.5" strokeDasharray="3 4" />
        <text x={W - R} y={zeroY - 4} textAnchor="end" fontSize="11" fill="#8B84A6">$0</text>
        <text x={L} y={30} fontSize="11" fill="#8B84A6">{'$' + Math.round(yMax / 1000) + 'k'}</text>
        <line x1={L} y1={T} x2={L} y2={H - B + 8} stroke="#EAE2F6" strokeWidth="1.5" />

        <polyline points={points(conservative)} fill="none" stroke="#FF5A36" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <polyline points={points(optimistic)} fill="none" stroke="#4A63D6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

        <circle cx={xAt(11)} cy={consLastY} r="4.5" fill="#FF5A36" stroke="#fff" strokeWidth="2" />
        <circle cx={xAt(11)} cy={optLastY} r="4.5" fill="#4A63D6" stroke="#fff" strokeWidth="2" />
        <text x={xAt(11) - 20} y={consLabelY} textAnchor="end" fontWeight="700" fontSize="12" fill="#C8481A">
          {fmtMoney(conservative[11])}
        </text>
        <text x={xAt(11) - 20} y={optLabelY} textAnchor="end" fontWeight="700" fontSize="12" fill="#1F2E73">
          {fmtMoney(optimistic[11])}
        </text>

        <text x={L} y={H - 22} fontSize="11" fill="#8B84A6">{labels.month(1)}</text>
        <text x={xAt(4)} y={H - 22} textAnchor="middle" fontSize="11" fill="#8B84A6">{labels.month(5)}</text>
        <text x={xAt(8)} y={H - 22} textAnchor="middle" fontSize="11" fill="#8B84A6">{labels.month(9)}</text>
        <text x={W - R} y={H - 22} textAnchor="end" fontSize="11" fill="#8B84A6">{labels.month(12)}</text>
      </svg>
    </div>
  );
}
