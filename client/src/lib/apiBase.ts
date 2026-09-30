// Adónde van las llamadas a /api desde la app nativa.
//
// En la web, "/api/…" es el mismo servidor que sirvió la página. La app
// nativa, en cambio, trae la página empaquetada adentro y la sirve desde
// el propio teléfono (capacitor://localhost en iOS, https://localhost en
// Android): ahí "/api/…" no llega a ningún servidor. Sin esto, en la app
// no funcionaba nada que necesite el servidor —aranceles, fletes, Marco
// Polo, el lector de etiquetas, los pagos—, sin ningún error visible
// más que "no hubo conexión".
//
// El servidor ya acepta esos orígenes (server/env.ts, allowedOrigins) y
// la API usa tokens Bearer, no cookies, así que no hace falta nada más.

/** El servidor de producción, salvo que el build diga otro. */
export const SERVIDOR_POR_DEFECTO = 'https://easycomex.onrender.com';

export function baseDelServidor(nativa: boolean, configurada?: string): string {
  if (!nativa) return '';
  const limpia = (configurada || '').trim().replace(/\/+$/, '');
  return /^https:\/\//.test(limpia) ? limpia : SERVIDOR_POR_DEFECTO;
}

/** "/api/x" → "https://servidor/api/x". Todo lo demás queda igual. */
export function conServidor(url: string, base: string): string {
  if (!base || !url.startsWith('/api/')) return url;
  return base + url;
}

/**
 * Hace que cada fetch a /api vaya al servidor. Se instala una vez, al
 * arrancar y antes de cualquier pedido; en la web no hace nada.
 */
export function instalarServidor(base: string): void {
  if (!base || typeof window === 'undefined') return;
  const original = window.fetch.bind(window);
  window.fetch = (entrada: RequestInfo | URL, init?: RequestInit) => {
    if (typeof entrada === 'string') return original(conServidor(entrada, base), init);
    if (entrada instanceof URL) {
      if (entrada.origin === window.location.origin && entrada.pathname.startsWith('/api/')) {
        return original(base + entrada.pathname + entrada.search, init);
      }
      return original(entrada, init);
    }
    const u = new URL(entrada.url);
    if (u.origin === window.location.origin && u.pathname.startsWith('/api/')) {
      return original(new Request(base + u.pathname + u.search, entrada), init);
    }
    return original(entrada, init);
  };
}
