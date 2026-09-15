import { fmtInt, fmtMoney, fmtMoney1, fmtMoney2 } from '@/lib/roiFormat';

export type CellFormat = 'int' | 'pct' | 'currency' | 'currency1' | 'currency2';

export interface RoiRow {
  label: string;
  values: number[];
  fmt: CellFormat;
  /** Green when positive, orange when negative. */
  colorize?: boolean;
  bold?: boolean;
}

function cellText(v: number, fmt: CellFormat) {
  if (fmt === 'int') return fmtInt(v);
  if (fmt === 'pct') return (v * 100).toFixed(0) + '%';
  if (fmt === 'currency2') return fmtMoney2(v);
  if (fmt === 'currency1') return fmtMoney1(v);
  return fmtMoney(v);
}

/**
 * A month-by-month table. The first column is sticky so the row label
 * stays put while the twelve months scroll sideways on a phone.
 */
export default function RoiTable({ months, rows }: { months: string[]; rows: RoiRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[56rem] border-collapse text-sm tabular-nums">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 w-56 min-w-[14rem] bg-secondary px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-wide text-primary" />
            {months.map((m) => (
              <th key={m} className="whitespace-nowrap bg-secondary px-3 py-2.5 text-right text-[11px] font-bold uppercase tracking-wide text-primary">
                {m}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-t border-gray-100">
              <td
                className={`sticky left-0 z-10 w-56 min-w-[14rem] bg-white px-3 py-2.5 text-left leading-snug shadow-[1px_0_0_rgb(243,244,246)] ${
                  row.bold ? 'font-bold text-foreground' : 'font-semibold text-muted-foreground'
                }`}
              >
                {row.label}
              </td>
              {row.values.map((v, i) => (
                <td
                  key={i}
                  className={`whitespace-nowrap px-3 py-2.5 text-right ${
                    row.colorize ? (v < 0 ? 'font-bold text-accent' : v > 0 ? 'font-bold text-green-700' : '') : ''
                  } ${row.bold ? 'font-bold text-foreground' : 'text-foreground'}`}
                >
                  {cellText(v, row.fmt)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
