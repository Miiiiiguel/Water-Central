// Number formatting for the ROI calculator. Kept apart from the model so
// the math stays pure and testable, and so every table and stat renders
// money the same way.
//
// The locale follows the UI language: "16.752" means sixteen thousand in
// Spanish and sixteen-point-seven in English, so using one locale for
// both would misreport every figure to half the audience.

let activeLocale = 'es-CO';

/** Called by the calculator page when the language changes. */
export function setRoiLocale(language: 'es' | 'en') {
  activeLocale = language === 'en' ? 'en-US' : 'es-CO';
}

export const fmtMoney = (n: number) => '$' + Math.round(n).toLocaleString(activeLocale);

export const fmtMoney2 = (n: number) =>
  '$' + n.toLocaleString(activeLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtMoney1 = (n: number) =>
  '$' + n.toLocaleString(activeLocale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export const fmtInt = (n: number) => Math.round(n).toLocaleString(activeLocale);

export const fmtPct = (n: number) => n.toFixed(1) + '%';

/** Share of a total, guarding the zero-denominator case. */
export const pctOf = (num: number, den: number) => (den > 0 ? fmtPct((num / den) * 100) : '0.0%');

export const xOf = (num: number, den: number) => (den > 0 ? (num / den).toFixed(1) + 'x' : '0.0x');

export const MONTH_LABELS = [
  'Mes 1', 'Mes 2', 'Mes 3', 'Mes 4', 'Mes 5', 'Mes 6',
  'Mes 7', 'Mes 8', 'Mes 9', 'Mes 10', 'Mes 11', 'Mes 12',
];

export const MONTH_LABELS_EN = [
  'Month 1', 'Month 2', 'Month 3', 'Month 4', 'Month 5', 'Month 6',
  'Month 7', 'Month 8', 'Month 9', 'Month 10', 'Month 11', 'Month 12',
];
