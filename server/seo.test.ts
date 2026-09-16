import { describe, expect, it } from 'vitest';
import { PUBLIC_ROUTES, rewriteHead, robotsTxt, sitemapXml } from './seo';

// El canonical apuntaba a easycomex.com escrito a mano. Mientras la app
// viva en otra dirección, eso le dice a Google que la página buena es
// otra — un error sin síntomas, sólo tráfico que nunca llega.

describe('robotsTxt', () => {
  it('tapa lo privado y deja pasar el resto', () => {
    const txt = robotsTxt('https://easycomex.com');
    expect(txt).toContain('Disallow: /dashboard');
    expect(txt).toContain('Disallow: /api/');
    expect(txt).toContain('Disallow: /restablecer');
    expect(txt).toContain('Allow: /');
  });

  it('apunta al sitemap con URL absoluta', () => {
    expect(robotsTxt('https://easycomex.com')).toContain('Sitemap: https://easycomex.com/sitemap.xml');
  });

  it('omite la línea del sitemap si no sabe dónde vive', () => {
    // Una URL a medio construir es peor que no darla.
    const txt = robotsTxt('');
    expect(txt).not.toContain('Sitemap:');
    expect(txt).toContain('User-agent: *');
  });
});

describe('sitemapXml', () => {
  const xml = sitemapXml('https://easycomex.com', '2026-09-16');

  it('lista las rutas públicas y ninguna privada', () => {
    for (const route of PUBLIC_ROUTES) {
      expect(xml).toContain(`https://easycomex.com${route}`);
    }
    expect(xml).not.toContain('/dashboard');
    expect(xml).not.toContain('/restablecer');
  });

  it('le da la prioridad alta a la portada', () => {
    expect(xml).toMatch(/<loc>https:\/\/easycomex\.com\/<\/loc>\s*<lastmod>2026-09-16<\/lastmod>\s*<priority>1\.0<\/priority>/);
  });

  it('sale como XML válido y con el namespace correcto', () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml.trimEnd().endsWith('</urlset>')).toBe(true);
    // sitemaps.org, en plural. Con el singular el sitemap no es válido y
    // Google lo descarta sin decir por qué.
    expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
  });
});

describe('rewriteHead', () => {
  const html = `<html><head>
<link rel="canonical" href="https://easycomex.com/" />
<meta property="og:url" content="https://easycomex.com/" />
<meta property="og:title" content="Easycomex" />
</head></html>`;

  it('apunta el canonical a donde la app vive de verdad', () => {
    const out = rewriteHead(html, 'https://easycomex.onrender.com');
    expect(out).toContain('<link rel="canonical" href="https://easycomex.onrender.com/"');
    expect(out).toContain('<meta property="og:url" content="https://easycomex.onrender.com/"');
  });

  it('no toca el resto del head', () => {
    const out = rewriteHead(html, 'https://otro.com');
    expect(out).toContain('<meta property="og:title" content="Easycomex"');
  });

  it('deja el HTML intacto si no sabe dónde vive', () => {
    expect(rewriteHead(html, '')).toBe(html);
  });

  it('es idempotente: reescribir dos veces da lo mismo', () => {
    const once = rewriteHead(html, 'https://a.com');
    expect(rewriteHead(once, 'https://a.com')).toBe(once);
  });
});
