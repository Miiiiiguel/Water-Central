import { escapeHtml, layout, button, safeSubject, type Mail } from '../email';

// Correos del casillero: la misma plantilla de Easycomex que el resto de
// los correos de la app (layout y botón de server/email.ts).

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
    subject: safeSubject(titulo),
    html: layout(
      titulo,
      `<p style="margin:0 0 8px;font-size:15px;line-height:1.6">Hola ${escapeHtml(d.nombre ?? '')},</p>
<p style="margin:0 0 8px;font-size:15px;line-height:1.6">Tu paquete con guía <strong>${escapeHtml(d.guia)}</strong>${escapeHtml(peso)} ${escapeHtml(d.accion)}.</p>${button(d.enlace, 'Ver mi casillero')}`
    ),
    text: `Hola ${d.nombre ?? ''}, tu paquete con guía ${d.guia}${peso} ${d.accion}.\nVer mi casillero: ${d.enlace}\n\n— Equipo Easycomex`,
  };
}
