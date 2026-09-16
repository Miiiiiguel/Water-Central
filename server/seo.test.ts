import { describe, expect, it } from 'vitest';
import { PUBLIC_ROUTES, rewriteHead, robotsTxt, sitemapXml, PAGE_META } from './seo';

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

  it('no toca lo que no le toca', () => {
    // Desde que cada ruta tiene su ficha, `rewriteHead` sí reescribe el
    // título y las etiquetas sociales de una ruta conocida — para eso
    // existe ahora. Lo que no toca es todo lo demás del head.
    const con = `${html.replace('</head>', '<meta name="theme-color" content="#0b1020" /></head>')}`;
    const out = rewriteHead(con, 'https://otro.com', '/roi');
    expect(out).toContain('<meta name="theme-color" content="#0b1020"');
  });

  it('una ruta desconocida no cambia de título', () => {
    const out = rewriteHead(html, 'https://otro.com', '/ruta-rara');
    expect(out).toContain('<meta property="og:title" content="Easycomex"');
  });

  it('sin saber dónde vive, no toca ninguna URL', () => {
    // El canonical a medio construir es peor que el original: por eso
    // las URLs se quedan como están. El título no depende del dominio,
    // así que ese sí se pone (ver la prueba de más abajo).
    const out = rewriteHead(html, '', '/ruta-rara');
    expect(out).toContain('<link rel="canonical" href="https://easycomex.com/"');
    expect(out).toContain('<meta property="og:url" content="https://easycomex.com/"');
  });

  it('es idempotente: reescribir dos veces da lo mismo', () => {
    const once = rewriteHead(html, 'https://a.com');
    expect(rewriteHead(once, 'https://a.com')).toBe(once);
  });
});

// ---------------------------------------------------------------------
// Cada página, su propio título y su propio canonical.
// ---------------------------------------------------------------------
describe('el head de cada página', () => {
  const html = [
    '<html><head>',
    '<title>Easycomex | Vende tu marca en todo el mundo</title>',
    '<meta name="description" content="lo de la home" />',
    '<link rel="canonical" href="https://easycomex.com/" />',
    '<meta property="og:url" content="https://easycomex.com/" />',
    '<meta property="og:title" content="home" />',
    '<meta property="og:description" content="home" />',
    '<meta name="twitter:title" content="home" />',
    '<meta name="twitter:description" content="home" />',
    '</head><body></body></html>',
  ].join('\n');

  it('el canonical apunta a la página, no siempre a la home', () => {
    // Con todas diciendo `href="https://dominio/"`, Google entiende que
    // /roi y /diagnostico son copias de la home y no las indexa. Dos
    // herramientas gratuitas invisibles por una línea de HTML.
    const out = rewriteHead(html, 'https://easycomex.com', '/roi');
    expect(out).toContain('<link rel="canonical" href="https://easycomex.com/roi"');
    expect(out).toContain('<meta property="og:url" content="https://easycomex.com/roi"');
  });

  it('la home sigue siendo la home', () => {
    const out = rewriteHead(html, 'https://easycomex.com', '/');
    expect(out).toContain('<link rel="canonical" href="https://easycomex.com/"');
  });

  it('cada página pública tiene título y descripción propios', () => {
    const titulos = new Set<string>();
    for (const route of Object.keys(PAGE_META)) {
      const out = rewriteHead(html, 'https://easycomex.com', route);
      const titulo = out.match(/<title>([^<]*)<\/title>/)![1];
      const desc = out.match(/<meta name="description" content="([^"]*)"/)![1];
      expect(titulo, route).toBe(PAGE_META[route].title);
      expect(desc, route).toBe(PAGE_META[route].description);
      // Google corta el título cerca de los 60 caracteres.
      expect(titulo.length, route).toBeLessThanOrEqual(70);
      expect(desc.length, route).toBeGreaterThan(60);
      titulos.add(titulo);
    }
    expect(titulos.size).toBe(Object.keys(PAGE_META).length);
  });

  it('las redes sociales ven el mismo título que Google', () => {
    const out = rewriteHead(html, 'https://easycomex.com', '/diagnostico');
    const titulo = PAGE_META['/diagnostico'].title;
    expect(out).toContain(`<meta property="og:title" content="${titulo}"`);
    expect(out).toContain(`<meta name="twitter:title" content="${titulo}"`);
  });

  it('una ruta sin ficha se sirve con el head de la home, sin romperse', () => {
    const out = rewriteHead(html, 'https://easycomex.com', '/ruta-que-no-existe');
    expect(out).toContain('<title>Easycomex | Vende tu marca en todo el mundo</title>');
  });

  it('lo que no vale la pena indexar lo dice la página, no sólo robots.txt', () => {
    // /login y /registro quedaban indexables con el título de la home:
    // páginas vacías compitiendo en los resultados contra la buena.
    for (const route of ['/login', '/registro', '/no-existe']) {
      expect(rewriteHead(html, 'https://easycomex.com', route), route)
        .toContain('<meta name="robots" content="noindex, follow"');
    }
  });

  it('las páginas públicas nunca llevan noindex', () => {
    for (const route of Object.keys(PAGE_META)) {
      expect(rewriteHead(html, 'https://easycomex.com', route), route).not.toContain('noindex');
    }
  });

  it('sin base no se inventa un canonical a medias', () => {
    const out = rewriteHead(html, '', '/roi');
    expect(out).toContain('href="https://easycomex.com/"');
    // El título sí se pone: no depende de saber en qué dominio vive.
    expect(out).toContain(PAGE_META['/roi'].title);
  });

  it('cada ruta pública del sitemap tiene su ficha', () => {
    for (const route of PUBLIC_ROUTES) expect(PAGE_META[route], route).toBeDefined();
  });
});
