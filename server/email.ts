// Correo saliente.
//
// Hasta ahora la app no mandaba un solo correo, y eso tenía dos costos
// concretos:
//
//   1. Quien pagaba el plan de acción sólo podía volver a verlo desde el
//      mismo navegador (la referencia vive en localStorage). Cerrar la
//      pestaña, limpiar el navegador o abrirlo en el celular = perdió lo
//      que pagó, aunque la fila siga en la base de datos.
//   2. Un lead que entraba de madrugada se quedaba en la campanita del
//      dashboard. Si nadie abría el dashboard, el lead se enfriaba.
//
// Se usa la API HTTP de Resend con `fetch` en vez de su SDK: es una sola
// petición y así no entra otra dependencia a la cadena de suministro.
//
// Sin RESEND_API_KEY todo esto queda apagado y la app sigue igual que
// hoy — ninguna ruta falla por no poder mandar un correo.

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

/** A dónde le escribe la app al equipo. */
export function teamAddress(): string | null {
  return process.env.TEAM_EMAIL?.trim() || null;
}

/**
 * La URL pública. `PUBLIC_APP_URL` es la buena; el host de la petición
 * se puede falsificar, y acá termina dentro de un enlace que alguien va
 * a abrir, así que sólo se usa como último recurso.
 */
export function appUrl(fallbackHost?: string): string {
  const configured = process.env.PUBLIC_APP_URL?.trim().replace(/\/$/, '');
  if (configured) return configured;
  return fallbackHost ? `https://${fallbackHost}` : '';
}

/**
 * Escapa para HTML. El nombre y la empresa los escribe un desconocido y
 * terminan en la bandeja del equipo: sin esto, cualquiera puede meter
 * marcado en un correo que tu equipo abre.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Un asunto no puede llevar saltos de línea: ahí es donde se inyectan
 * encabezados falsos. También se recorta, que los clientes de correo
 * cortan a la mitad de todos modos.
 */
export function safeSubject(value: string, max = 120): string {
  return value.replace(/[\r\n]+/g, ' ').trim().slice(0, max);
}

export interface Mail {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

/**
 * Manda el correo. Nunca lanza: un correo que no sale no puede tumbar un
 * pago ni perder un lead que ya está guardado. Devuelve si salió, para
 * los logs.
 */
export async function sendEmail(mail: Mail): Promise<boolean> {
  if (!emailConfigured()) return false;
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: [mail.to],
        subject: safeSubject(mail.subject),
        html: mail.html,
        text: mail.text,
        ...(mail.replyTo ? { reply_to: mail.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      console.error('[email] Resend respondió', res.status, (await res.text().catch(() => '')).slice(0, 200));
      return false;
    }
    return true;
  } catch (err) {
    console.error('[email] no se pudo enviar:', (err as Error).message);
    return false;
  }
}

// --- Plantillas -------------------------------------------------------
//
// Separadas del envío para poder probarlas sin red. Cada una devuelve
// texto y HTML: hay clientes de correo que no muestran HTML, y un correo
// que llega vacío es peor que no mandarlo.

const BRAND = '#FF5A36';

function layout(title: string, bodyHtml: string): string {
  return `<!doctype html><html lang="es"><body style="margin:0;padding:24px;background:#f6f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1B1A45">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;padding:32px">
<p style="margin:0 0 24px;font-size:22px;font-weight:800"><span style="color:${BRAND}">easy</span><span style="color:#1B1A45">comex</span></p>
<h1 style="margin:0 0 16px;font-size:19px;line-height:1.35">${escapeHtml(title)}</h1>
${bodyHtml}
</div>
<p style="max-width:560px;margin:16px auto 0;font-size:12px;color:#8b8a9c">Easycomex · <a href="mailto:info@easycomex.com" style="color:#8b8a9c">info@easycomex.com</a></p>
</body></html>`;
}

function button(href: string, label: string): string {
  return `<p style="margin:24px 0"><a href="${escapeHtml(href)}" style="display:inline-block;background:${BRAND};color:#fff;text-decoration:none;font-weight:700;padding:13px 24px;border-radius:999px">${escapeHtml(label)}</a></p>`;
}

export interface DiagnosticMailData {
  nombre: string;
  empresa: string;
  correo: string;
  score: number;
  tier: string;
  gaps: number;
  ref: string;
}

/**
 * El recibo del plan de acción, con el enlace para volver a entrar. Este
 * correo es la única copia que le queda al comprador fuera de su
 * navegador, así que el enlace va completo y visible, no sólo en un
 * botón: hay clientes de correo que no lo dejan hacer clic.
 */
export function diagnosticReceipt(data: DiagnosticMailData, baseUrl: string): Mail {
  const link = `${baseUrl}/diagnostico?ref=${encodeURIComponent(data.ref)}`;
  const saludo = data.nombre ? `Hola ${data.nombre},` : 'Hola,';
  const subject = `Tu plan de acción de Easycomex (${data.score}%, ${data.tier})`;

  const text = [
    saludo,
    '',
    `Tu diagnóstico de madurez exportadora: ${data.score}% — nivel ${data.tier}, con ${data.gaps} brecha(s) por cerrar.`,
    '',
    'Acá está tu plan de acción, con lo que hay que hacer en cada brecha:',
    link,
    '',
    'Guarda este correo. Ese enlace es la forma de volver a entrar desde cualquier equipo.',
    '',
    `Referencia: ${data.ref}`,
    '',
    '¿Dudas? Responde este correo y te contestamos.',
    '— Equipo Easycomex',
  ].join('\n');

  const html = layout(`Tu plan de acción está listo, ${data.nombre || 'bienvenido'}`, `
<p style="margin:0 0 8px;font-size:15px;line-height:1.6">Tu diagnóstico dio <strong>${data.score}%</strong> — nivel <strong>${escapeHtml(data.tier)}</strong>, con <strong>${data.gaps}</strong> brecha(s) por cerrar.</p>
${button(link, 'Ver mi plan de acción')}
<p style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#55546b">Si el botón no funciona, copia este enlace:<br><a href="${escapeHtml(link)}" style="color:${BRAND};word-break:break-all">${escapeHtml(link)}</a></p>
<p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #eee;font-size:13px;line-height:1.6;color:#55546b"><strong>Guarda este correo.</strong> Ese enlace es la forma de volver a entrar desde cualquier equipo.<br>Referencia: <code>${escapeHtml(data.ref)}</code></p>`);

  return { to: data.correo, subject, html, text, replyTo: 'info@easycomex.com' };
}

export interface LeadMailData {
  nombre: string;
  correo: string;
  telefono: string;
  empresa: string;
  pais: string;
  mensaje: string;
  interes: string;
}

/** Aviso al equipo. Lo que importa arriba: quién es y cómo contestarle. */
export function leadAlert(data: LeadMailData, to: string, baseUrl: string): Mail {
  const quien = data.nombre || data.correo;
  const subject = `Nuevo lead: ${quien}${data.empresa ? ` · ${data.empresa}` : ''}`;

  const filas: [string, string][] = [
    ['Nombre', data.nombre],
    ['Correo', data.correo],
    ['Teléfono', data.telefono],
    ['Empresa', data.empresa],
    ['País', data.pais],
    ['Interés', data.interes],
  ].filter(([, v]) => Boolean(v)) as [string, string][];

  const text = [
    `Nuevo lead desde la web.`,
    '',
    ...filas.map(([k, v]) => `${k}: ${v}`),
    ...(data.mensaje ? ['', 'Mensaje:', data.mensaje] : []),
    '',
    `Dashboard: ${baseUrl}/dashboard`,
  ].join('\n');

  const html = layout('Nuevo lead desde la web', `
<table style="width:100%;border-collapse:collapse;font-size:14px">
${filas.map(([k, v]) => `<tr><td style="padding:7px 12px 7px 0;color:#8b8a9c;white-space:nowrap;vertical-align:top">${escapeHtml(k)}</td><td style="padding:7px 0;font-weight:600">${escapeHtml(v)}</td></tr>`).join('')}
</table>
${data.mensaje ? `<p style="margin:20px 0 0;padding:14px 16px;background:#f6f6f8;border-radius:12px;font-size:14px;line-height:1.6;white-space:pre-wrap">${escapeHtml(data.mensaje)}</p>` : ''}
${button(`${baseUrl}/dashboard`, 'Abrir el dashboard')}`);

  // Responder el aviso escribe directo al lead, sin copiar y pegar.
  return { to, subject, html, text, replyTo: data.correo || undefined };
}

/** Acuse para quien escribió: que sepa que llegó y cuándo le responden. */
export function leadAck(data: LeadMailData): Mail {
  const saludo = data.nombre ? `Hola ${data.nombre},` : 'Hola,';
  const text = [
    saludo,
    '',
    'Recibimos tu mensaje. Te respondemos en menos de 24 horas hábiles.',
    '',
    'Si es urgente, escríbenos por WhatsApp y te atendemos de una.',
    '',
    '— Equipo Easycomex',
  ].join('\n');

  const html = layout('Recibimos tu mensaje', `
<p style="margin:0 0 8px;font-size:15px;line-height:1.6">${escapeHtml(saludo)}</p>
<p style="margin:0 0 8px;font-size:15px;line-height:1.6">Recibimos tu mensaje y te respondemos en <strong>menos de 24 horas hábiles</strong>.</p>
<p style="margin:16px 0 0;font-size:14px;line-height:1.6;color:#55546b">Si es urgente, responde este correo y lo vemos antes.</p>`);

  return { to: data.correo, subject: 'Recibimos tu mensaje · Easycomex', html, text, replyTo: 'info@easycomex.com' };
}
