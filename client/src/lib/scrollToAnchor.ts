// Llevar a una sección de la portada por su ancla.
//
// Las secciones de abajo no están en el DOM hasta que uno se acerca a
// ellas (ver components/Deferred.tsx): así quien lee el encabezado y se
// va no se baja un megabyte que no iba a mirar. El costo es que
// `document.querySelector('#calculadora')` puede no encontrar nada
// todavía, y entonces el botón "Cotizar" del menú no haría *nada* — un
// botón muerto es peor que una página lenta.
//
// Así que acá se hacen las dos cosas: se le pide a los bloques diferidos
// que se monten ya, y se espera a que el elemento exista antes de bajar.

const listeners = new Set<() => void>();

/** Un bloque diferido se apunta para enterarse de una navegación por ancla. */
export function onRevealAll(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Monta ya todos los bloques diferidos. */
export function revealAllDeferred() {
  listeners.forEach((fn) => fn());
}

/**
 * Baja hasta el ancla, esperando a que exista. El tope de ~3 segundos es
 * por si el trozo de JavaScript no llega (red caída, chunk que falló):
 * mejor no hacer nada que dejar un temporizador corriendo para siempre.
 */
export function scrollToAnchor(selector: string, timeoutMs = 3000) {
  revealAllDeferred();
  const started = Date.now();
  const tick = () => {
    const el = document.querySelector(selector);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (Date.now() - started < timeoutMs) requestAnimationFrame(tick);
  };
  // Un frame de margen para que React monte lo que se acaba de revelar.
  requestAnimationFrame(tick);
}
