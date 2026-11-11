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

export interface InvitacionCasillero {
  to: string;
  nombre: string | null;
  codigo: string | null;
  enlace: string;
}

/** La invitación a crear la cuenta del casillero. */
export function invitacionCasillero(d: InvitacionCasillero): Mail {
  const titulo = 'Te invitamos a tu casillero de Easycomex';
  const saludo = d.nombre ? `Hola ${d.nombre},` : 'Hola,';
  const codigo = d.codigo ? ` Tu código de casillero es <strong>${escapeHtml(d.codigo)}</strong>.` : '';
  const codigoTexto = d.codigo ? ` Tu código de casillero es ${d.codigo}.` : '';
  return {
    to: d.to,
    subject: safeSubject(titulo),
    html: layout(
      titulo,
      `<p style="margin:0 0 8px;font-size:15px;line-height:1.6">${escapeHtml(saludo)}</p>
<p style="margin:0 0 8px;font-size:15px;line-height:1.6">Ya tienes tu cuenta en Easycomex.${codigo} Ahí ves tu inventario, tus paquetes, tus despachos y tu saldo, y puedes conectar tu tienda.</p>
<p style="margin:0 0 8px;font-size:15px;line-height:1.6">Para entrar, crea tu contraseña:</p>${button(d.enlace, 'Crear mi contraseña')}
<p style="margin:0;font-size:13px;line-height:1.6;color:#8b8a9c">Después entras siempre con este correo y tu contraseña. Si el botón ya no funciona, en la página de ingreso usa "¿La olvidaste?" con este mismo correo.</p>`
    ),
    text: `${saludo}\n\nYa tienes tu cuenta en Easycomex.${codigoTexto} Ahí ves tu inventario, tus paquetes, tus despachos y tu saldo.\n\nCrea tu contraseña aquí: ${d.enlace}\n\nDespués entras siempre con este correo y tu contraseña. Si el enlace ya no funciona, en la página de ingreso usa "¿La olvidaste?" con este mismo correo.\n\n— Equipo Easycomex`,
  };
}
