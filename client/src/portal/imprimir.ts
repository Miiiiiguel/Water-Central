// Imprimir un documento (hoja de despacho, etiqueta…) sin abrir ventanas
// emergentes: se arma en un iframe invisible y se manda a la impresora.

export const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

const ESTILO = `
  *{box-sizing:border-box}
  body{font-family:Inter,Arial,sans-serif;color:#1B1A45;margin:0;padding:32px;font-size:13px;line-height:1.45}
  h1{font-size:22px;margin:0}
  h2{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#6B6B85;margin:22px 0 8px}
  .logo{font-weight:900;font-size:22px;letter-spacing:-.02em}.logo b{color:#FF5A36}
  .cab{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #FF5A36;padding-bottom:14px}
  .id{font-family:ui-monospace,Menlo,monospace;font-size:13px;color:#6B6B85;text-align:right}
  .rejilla{display:grid;grid-template-columns:1fr 1fr;gap:6px 24px}
  .rejilla div span{display:block;font-size:11px;color:#6B6B85}
  table{width:100%;border-collapse:collapse}
  th{text-align:left;font-size:11px;color:#6B6B85;text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid #d9d9e8;padding:6px 8px}
  td{padding:8px;border-bottom:1px solid #eeeef5;vertical-align:top}
  td.n,th.n{text-align:right}
  .firmas{display:grid;grid-template-columns:1fr 1fr;gap:48px;margin-top:64px}
  .firmas div{border-top:1px solid #1B1A45;padding-top:6px;font-size:11px;color:#6B6B85}
  .pie{margin-top:32px;font-size:11px;color:#6B6B85}
  @page{margin:12mm}
`;

/** Arma `cuerpo` (HTML ya escapado con `esc`) en una página propia y abre el diálogo de impresión. */
export function imprimirHtml(titulo: string, cuerpo: string): boolean {
  if (typeof document === 'undefined') return false;
  const marco = document.createElement('iframe');
  marco.setAttribute('aria-hidden', 'true');
  marco.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(marco);
  const d = marco.contentDocument;
  if (!d) { marco.remove(); return false; }
  d.open();
  d.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(titulo)}</title><style>${ESTILO}</style></head><body>${cuerpo}</body></html>`);
  d.close();
  const quitar = () => setTimeout(() => marco.remove(), 500);
  marco.contentWindow?.addEventListener('afterprint', quitar);
  setTimeout(() => marco.remove(), 120_000);
  setTimeout(() => { marco.contentWindow?.focus(); marco.contentWindow?.print(); }, 200);
  return true;
}
