import { ReactNode, Suspense, useEffect, useRef, useState } from 'react';
import { onRevealAll } from '@/lib/scrollToAnchor';

/**
 * Monta su contenido cuando la sección se está por ver, no antes.
 *
 * Antes esto se hacía con un temporizador: a los dos segundos de estar
 * quieto el navegador, montábamos todo lo de abajo. El problema es que
 * quien abre la portada, lee el encabezado y hace clic en "Cotizar" se
 * bajaba igual el globo 3D y las gráficas — más de un megabyte de
 * JavaScript que nunca iba a ver. Con buena conexión no se nota; con la
 * de un celular en Colombia contra un servidor en Oregón, sí.
 *
 * `rootMargin` generoso a propósito: empieza a cargar 600 px antes de
 * que la sección entre en pantalla, así llega antes que el dedo.
 *
 * Si el navegador no tiene IntersectionObserver, monta de una: peor es
 * dejar la página con huecos vacíos para siempre.
 */
export default function Deferred({
  children,
  id,
  placeholderClassName,
  rootMargin = '600px',
}: {
  children: ReactNode;
  id?: string;
  /** Tiene que reservar el alto real de la sección o la página salta. */
  placeholderClassName: string;
  rootMargin?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);

  // Una navegación por ancla apunta a un id que vive dentro de este
  // bloque: hay que montarlo ya, sin esperar a que se vea.
  useEffect(() => onRevealAll(() => setShow(true)), []);

  useEffect(() => {
    if (show) return;
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setShow(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShow(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [show, rootMargin]);

  return (
    <div ref={ref} id={id} className={show ? undefined : placeholderClassName}>
      {show ? <Suspense fallback={<div className={placeholderClassName} />}>{children}</Suspense> : null}
    </div>
  );
}
