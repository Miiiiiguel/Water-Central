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
export const PRIVATE_ROUTES = ['/dashboard', '/restablecer', '/pago/', '/api/'] as const;

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
 * Reescribe las URLs absolutas del `<head>` para que apunten a donde la
 * app está viviendo de verdad. Sin base no se toca nada: dejar el
 * canonical original es menos malo que dejar uno a medio construir.
 */
export function rewriteHead(html: string, base: string): string {
  if (!base) return html;
  return html
    .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${base}/$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${base}/$2`);
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
        res.type('html').send(rewriteHead(indexHtml(), baseFor(req)));
      } catch {
        // Si no se puede leer, que lo sirva express como archivo: peor
        // sería devolver un error por un canonical.
        res.sendFile(path.join(staticPath, 'index.html'));
      }
    },
  };
}
