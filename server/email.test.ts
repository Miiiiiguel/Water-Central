import { afterEach, describe, expect, it } from 'vitest';
import { appUrl, diagnosticReceipt, escapeHtml, leadAck, leadAlert, safeSubject } from './email';

// Estos correos los dispara un pago y un formulario público, así que el
// contenido lo escribe en parte un desconocido. Lo que se fija acá es
// que ese texto no pueda hacer nada raro, y que el enlace de
// recuperación —la única copia que le queda al comprador fuera de su
// navegador— siempre salga bien.

const RECEIPT = {
  nombre: 'Miguel',
  empresa: 'Kaiizen',
  correo: 'cliente@ejemplo.com',
  score: 56,
  tier: 'Explorador',
  gaps: 7,
  ref: 'ecx_0123456789abcdef0123456789abcdef',
};

const LEAD = {
  nombre: 'Ana',
  correo: 'ana@marca.com',
  telefono: '+57 300 000 0000',
  empresa: 'Marca SAS',
  pais: 'Colombia',
  mensaje: 'Quiero vender en Amazon.',
  interes: 'Logística',
};

describe('escapeHtml', () => {
  it('neutraliza marcado que venga de un formulario público', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(escapeHtml('a & b')).toBe('a &amp; b');
    expect(escapeHtml(`"' onload=x`)).toBe('&quot;&#39; onload=x');
  });

  it('deja los acentos en paz', () => {
    expect(escapeHtml('Diseño español')).toBe('Diseño español');
  });
});

describe('safeSubject', () => {
  it('quita los saltos de línea, que es por donde se inyectan encabezados', () => {
    expect(safeSubject('Hola\r\nBcc: alguien@ajeno.com')).toBe('Hola Bcc: alguien@ajeno.com');
  });

  it('recorta un asunto larguísimo', () => {
    expect(safeSubject('x'.repeat(300)).length).toBe(120);
  });
});

describe('appUrl', () => {
  const original = process.env.PUBLIC_APP_URL;
  afterEach(() => {
    if (original === undefined) delete process.env.PUBLIC_APP_URL;
    else process.env.PUBLIC_APP_URL = original;
  });

  it('prefiere la configurada y le quita la barra final', () => {
    process.env.PUBLIC_APP_URL = 'https://easycomex.com/';
    expect(appUrl('host.falso')).toBe('https://easycomex.com');
  });

  it('cae al host sólo si no hay ninguna configurada', () => {
    delete process.env.PUBLIC_APP_URL;
    expect(appUrl('easycomex.onrender.com')).toBe('https://easycomex.onrender.com');
    expect(appUrl()).toBe('');
  });
});

describe('diagnosticReceipt', () => {
  const mail = diagnosticReceipt(RECEIPT, 'https://easycomex.com');

  it('va al comprador, no al equipo', () => {
    expect(mail.to).toBe('cliente@ejemplo.com');
  });

  it('lleva el enlace de recuperación con la referencia', () => {
    const link = `https://easycomex.com/diagnostico?ref=${RECEIPT.ref}`;
    expect(mail.text).toContain(link);
    expect(mail.html).toContain(link);
  });

  it('muestra el enlace en texto, no sólo dentro del botón', () => {
    // Hay clientes de correo que no permiten hacer clic. Si el enlace
    // sólo viviera en el botón, el comprador se quedaría sin su plan.
    const sinEtiquetas = mail.html.replace(/<[^>]+>/g, ' ');
    expect(sinEtiquetas).toContain('/diagnostico?ref=');
  });

  it('trae el puntaje y el nivel en el asunto', () => {
    expect(mail.subject).toContain('56%');
    expect(mail.subject).toContain('Explorador');
  });

  it('siempre trae versión de texto plano', () => {
    expect(mail.text.length).toBeGreaterThan(80);
  });
});

describe('leadAlert', () => {
  it('se puede responder directo al lead', () => {
    // Sin esto hay que copiar el correo a mano, y ahí se pierde tiempo.
    const mail = leadAlert(LEAD, 'equipo@easycomex.com', 'https://easycomex.com');
    expect(mail.to).toBe('equipo@easycomex.com');
    expect(mail.replyTo).toBe('ana@marca.com');
  });

  it('pone en el asunto quién es, para verlo sin abrirlo', () => {
    expect(leadAlert(LEAD, 'e@x.com', 'https://x.com').subject).toBe('Nuevo lead: Ana · Marca SAS');
  });

  it('omite los campos vacíos en vez de dejar filas en blanco', () => {
    const mail = leadAlert({ ...LEAD, telefono: '', empresa: '', pais: '' }, 'e@x.com', 'https://x.com');
    expect(mail.text).not.toContain('Teléfono:');
    expect(mail.html).not.toContain('Empresa');
  });

  it('escapa lo que escribió el visitante', () => {
    const mail = leadAlert({ ...LEAD, mensaje: '<img src=x onerror=alert(1)>' }, 'e@x.com', 'https://x.com');
    expect(mail.html).not.toContain('<img');
    expect(mail.html).toContain('&lt;img');
  });

  it('usa el correo como identificador cuando no dieron nombre', () => {
    expect(leadAlert({ ...LEAD, nombre: '', empresa: '' }, 'e@x.com', 'https://x.com').subject).toBe('Nuevo lead: ana@marca.com');
  });
});

describe('leadAck', () => {
  it('le llega a quien escribió y promete un plazo concreto', () => {
    const mail = leadAck(LEAD);
    expect(mail.to).toBe('ana@marca.com');
    expect(mail.text).toContain('24 horas');
  });
});
