// Tras publicar una versión nueva, una pestaña abierta con la anterior pide
// trozos de JavaScript que ya no existen. El navegador lo reporta con estos
// mensajes (según el navegador). Reconocerlos permite recuperarse de verdad
// en vez de repetir la misma pantalla.
const PATRON = /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Loading chunk [\w-]+ failed|Unable to preload CSS/i;

export function esErrorDeCarga(error: unknown): boolean {
  const msg = typeof error === 'string' ? error : (error as { message?: unknown } | null | undefined)?.message;
  return typeof msg === 'string' && PATRON.test(msg);
}

/** Borra las copias guardadas de la app (no toca la sesión ni las notificaciones) y recarga. */
export async function recargarLimpio(): Promise<void> {
  try {
    if (typeof caches !== 'undefined') {
      const claves = await caches.keys();
      await Promise.all(claves.map((k) => caches.delete(k)));
    }
  } catch {
    // Sin acceso a las copias guardadas: se recarga igual.
  }
  window.location.reload();
}
