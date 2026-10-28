import { escapeHtml, safeSubject, type Mail } from '../email';

// Correos del casillero: marca DMatrixUSA, no Easycomex. Comparten el
// envío (Resend) pero no la plantilla ni el remitente.
//
// CASILLERO_EMAIL_FROM = remitente verificado, p. ej. "DMatrixUSA <cliente@dmatrixusa.com>".
// Si no está, se usa EMAIL_FROM.

const ROJO = '#b01c2e';
export const CORREO_CONTACTO = 'cliente@dmatrixusa.com';

export function remitenteCasillero(): string | undefined {
  return process.env.CASILLERO_EMAIL_FROM?.trim() || undefined;
}

export function layoutCasillero(titulo: string, cuerpoHtml: string): string {
  return `<!doctype html><html lang="es"><body style="margin:0;padding:24px;background:#f6f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1c1c1c">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden">
<div style="background:${ROJO};padding:18px 28px;color:#fff;font-size:22px;font-weight:700">DMatrix<span style="font-weight:300">USA</span></div>
<div style="padding:28px">
<h1 style="margin:0 0 16px;font-size:19px;line-height:1.35">${escapeHtml(titulo)}</h1>
${cuerpoHtml}
</div></div>
<p style="max-width:560px;margin:16px auto 0;font-size:12px;color:#8b8a9c">DMatrixUSA · 7569 NW 70th St, Miami, FL 33166 · <a href="mailto:${CORREO_CONTACTO}" style="color:#8b8a9c">${CORREO_CONTACTO}</a></p>
</body></html>`;
}

export function boton(href: string, etiqueta: string): string {
  return `<p style="margin:24px 0"><a href="${escapeHtml(href)}" style="display:inline-block;background:${ROJO};color:#fff;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:999px">${escapeHtml(etiqueta)}</a></p>`;
}

export interface AvisoPaquete {
  to: string;
  nombre: string | null;
  guia: string;
  pesoLb: number | null;
  accion: string;
  enlace: string;
}

/** Aviso de que un paquete cambió de estado. */
export function avisoPaquete(d: AvisoPaquete): Mail {
  const peso = d.pesoLb ? ` (${d.pesoLb} lb)` : '';
  const titulo = `Tu paquete ${d.guia} ${d.accion}`;
  return {
    to: d.to,
    from: remitenteCasillero(),
    subject: safeSubject(`DMatrixUSA · ${titulo}`),
    html: layoutCasillero(titulo, `<p>Hola ${escapeHtml(d.nombre ?? '')},</p><p>Tu paquete con guía <b>${escapeHtml(d.guia)}</b>${escapeHtml(peso)} ${escapeHtml(d.accion)}.</p>${boton(d.enlace, 'Ver mi casillero')}`),
    text: `DMatrixUSA\n\nHola ${d.nombre ?? ''}, tu paquete con guía ${d.guia}${peso} ${d.accion}.\nVer mi casillero: ${d.enlace}`,
    replyTo: CORREO_CONTACTO,
  };
}
