import { useEffect, useState } from 'react';

/**
 * Returns false during the first paint and true once the browser is idle
 * (or the user starts interacting), so heavy below-the-fold sections
 * hydrate *after* the screen is usable instead of competing with it.
 *
 * Why this and not only `lazy()`: a lazy chunk still mounts the moment it
 * arrives, which on a mid-range phone lands right in the middle of the
 * first-load burst. Waiting for idle moves that work out of the way; the
 * scroll/pointer listeners make sure a fast scroller never waits.
 *
 * The placeholder rendered meanwhile must reserve the same space, or the
 * deferral trades a long task for a layout shift.
 */
export function useIdleMount(timeoutMs = 2000, staggerMs = 0): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let done = false;
    let staggerTimer = 0;
    const mount = () => {
      if (done) return;
      done = true;
      // Stagger: mounting several heavy sections in the same task makes
      // one long freeze. Spreading them keeps each task short enough
      // that a scroll or tap in between is still handled.
      if (staggerMs > 0) staggerTimer = window.setTimeout(() => setReady(true), staggerMs);
      else setReady(true);
      window.removeEventListener('scroll', mount);
      window.removeEventListener('pointerdown', mount);
      window.removeEventListener('keydown', mount);
    };

    // Any intent to interact wins over the idle timer.
    window.addEventListener('scroll', mount, { passive: true, once: true });
    window.addEventListener('pointerdown', mount, { once: true });
    window.addEventListener('keydown', mount, { once: true });

    const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback;
    const id = ric ? ric(mount, { timeout: timeoutMs }) : window.setTimeout(mount, Math.min(timeoutMs, 600));

    return () => {
      done = true;
      window.clearTimeout(staggerTimer);
      window.removeEventListener('scroll', mount);
      window.removeEventListener('pointerdown', mount);
      window.removeEventListener('keydown', mount);
      const cancel = (window as unknown as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback;
      if (cancel) cancel(id as number);
      else window.clearTimeout(id as number);
    };
  }, [timeoutMs, staggerMs]);

  return ready;
}
