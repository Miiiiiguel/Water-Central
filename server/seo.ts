import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { appUrl } from './email';

// robots.txt, sitemap.xml y el canonical.
//
// El canonical estaba escrito a mano en index.html apuntando a
// https://easycomex.com/. Mientras la app viva en otra dirección —la de
// Render, una preview, un dominio nuevo— eso le dice a Google "no
// indexes esto, la página buena es la otra", y la app compite contra sí
// misma. Peor: es la clase de error que no da ningún síntoma, sólo
// tráfico que nunca llega.
//
// Generarlos acá los ata a `PUBLIC_APP_URL`, que ya es de donde salen
// las vueltas de Stripe y Wompi. Una sola verdad sobre dónde vive la app.

/** Rutas que vale la pena indexar. El resto son privadas o de paso. */
export const PUBLIC_ROUTES = ['/', '/roi', '/diagnostico', '/privacidad', '/terminos'] as const;

/**
 * Privadas o sin sentido en un buscador: el dashboard pide sesión,
 * restablecer lleva un token de un solo uso, y las de pago son el
 * regreso de la pasarela.
 */
export const PRIVATE_ROUTES = ['/dashboard', '/restablecer', '/pago/', '/estado', '/api/'] as const;

export function robotsTxt(base: string): string {
  const lines = ['User-agent: *', ...PRIVATE_ROUTES.map((r) => `Disallow: ${r}`), 'Allow: /'];
  // Sin base no se puede dar una URL absoluta, y el sitemap las exige.
  // Mejor omitir la línea que publicar una rota.
  if (base) lines.push('', `Sitemap: ${base}/sitemap.xml`);
  return lines.join('\n') + '\n';
}

export function sitemapXml(base: string, lastmod = new Date().toISOString().slice(0, 10)): string {
  const urls = PUBLIC_ROUTES.map((route) => {
    const loc = `${base}${route === '/' ? '/' : route}`;
    const priority = route === '/' ? '1.0' : '0.8';
    return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <priority>${priority}</priority>\n  </url>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

/**
 * Título y descripción de cada página pública.
 *
 * Todas servían el mismo `<title>` y la misma descripción que la home, y
 * el mismo canonical: `https://dominio/`. Eso último no es un descuido
 * cosmético, es pedirle a Google que NO indexe /roi ni /diagnostico —
 * "la página buena es la otra". Dos herramientas gratuitas que la gente
 * busca por su nombre ("calculadora de fletes", "calculadora de ROI"),
 * invisibles por una línea de HTML.
 */
export const PAGE_META: Record<string, { title: string; description: string }> = {
  '/': {
    title: 'Easycomex | Vende tu marca en todo el mundo',
    description:
      'Sacamos marcas latinoamericanas de su mercado local y las ponemos a vender en Amazon, TikTok Shop y Shopify. Logística puerta a puerta a 220 destinos y Prep Center en Estados Unidos.',
  },
  '/roi': {
    title: 'Calculadora de ROI para vender en Estados Unidos | Easycomex',
    description:
      'Calculá gratis cuánto deja tu producto vendiendo afuera: utilidad, margen, cuándo recuperás la inversión y el flujo de caja mes a mes de dos años.',
  },
  '/diagnostico': {
    title: 'Diagnóstico de madurez exportadora, gratis | Easycomex',
    description:
      '17 preguntas, 3 minutos. Tu nivel de madurez para vender en el exterior, de 0 a 100, con un comentario por cada punto. Gratis y sin llamada de ventas.',
  },
  '/privacidad': {
    title: 'Política de privacidad | Easycomex',
    description: 'Qué datos guardamos, para qué, con quién se comparten y cómo pedir que los borremos.',
  },
  '/terminos': {
    title: 'Términos y condiciones | Easycomex',
    description: 'Condiciones de uso, pagos, reembolsos y derecho de retracto de los servicios de Easycomex.',
  },
};

const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/**
 * Reescribe el `<head>` para esta página concreta: su canonical, su
 * título y su descripción. Sin base no se tocan las URLs —dejar el
 * canonical original es menos malo que dejar uno a medio construir—
 * pero el título y la descripción sí se ponen igual: no dependen de
 * saber en qué dominio vive la app.
 */
export function rewriteHead(html: string, base: string, route = '/'): string {
  const meta = PAGE_META[route];
  let out = html;

  if (base) {
    const url = escapeAttr(`${base}${route === '/' ? '/' : route}`);
    out = out
      .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${url}$2`)
      .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${url}$2`);
  }

  // Lo que no vale la pena indexar, se dice en la página y no sólo en
  // robots.txt: un Disallow impide rastrear, pero no impide que una URL
  // enlazada desde fuera aparezca igual en los resultados, vacía y con
  // el título de otra página. `noindex` sí la saca.
  //
  // `follow` a propósito: que no la indexe no significa que no deba
  // seguir los enlaces que salen de ella.
  if (!meta) {
    const etiqueta = '<meta name="robots" content="noindex, follow" />';
    // REEMPLAZAR, no sólo insertar si falta.
    //
    // index.html ya trae su propia etiqueta `robots` con "index, follow".
    // La versión anterior sólo añadía la suya cuando no había ninguna,
    // así que nunca hacía nada: la del archivo ganaba y /login,
    // /registro y el 404 se servían como indexables igual. La prueba lo
    // daba por bueno porque su HTML de ejemplo no llevaba esa etiqueta —
    // un fixture que no se parecía al archivo real.
    out = /<meta name="robots"[^>]*>/i.test(out)
      ? out.replace(/<meta name="robots"[^>]*>/i, etiqueta)
      : out.replace('</head>', `  ${etiqueta}\n  </head>`);
  }

  if (meta) {
    const title = escapeAttr(meta.title);
    const description = escapeAttr(meta.description);
    out = out
      .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`)
      .replace(/(<meta name="description" content=")[^"]*(")/, `$1${description}$2`)
      .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${title}$2`)
      .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${description}$2`)
      .replace(/(<meta name="twitter:title" content=")[^"]*(")/, `$1${title}$2`)
      .replace(/(<meta name="twitter:description" content=")[^"]*(")/, `$1${description}$2`);
  }

  return out;
}

export function seoRouter(staticPath: string) {
  const router = express.Router();

  // El host de la petición sólo entra si no hay PUBLIC_APP_URL: se puede
  // falsificar, pero acá lo peor que hace es generar un sitemap raro.
  const baseFor = (req: express.Request) => appUrl(req.get('host'));

  router.get('/robots.txt', (req, res) => {
    res.type('text/plain').send(robotsTxt(baseFor(req)));
  });

  router.get('/sitemap.xml', (req, res) => {
    res.type('application/xml').send(sitemapXml(baseFor(req)));
  });

  // index.html con el canonical corregido. Se lee del disco una vez: el
  // proceso se reinicia en cada despliegue, así que no hay forma de que
  // quede sirviendo un HTML viejo.
  let cached: string | null = null;
  const indexHtml = () => {
    if (cached === null) cached = fs.readFileSync(path.join(staticPath, 'index.html'), 'utf8');
    return cached;
  };

  return {
    router,
    sendIndex(req: express.Request, res: express.Response) {
      try {
        // `req.path` es la ruta que pidió el navegador; para cualquiera
        // que no esté en la tabla se sirve el `<head>` de la home, que es
        // lo que había antes para todas.
        res.type('html').send(rewriteHead(indexHtml(), baseFor(req), req.path));
      } catch {
        // Si no se puede leer, que lo sirva express como archivo: peor
        // sería devolver un error por un canonical.
        res.sendFile(path.join(staticPath, 'index.html'));
      }
    },
  };
}
