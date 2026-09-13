import type { MouseEvent } from 'react';

// Pair with the .card-spotlight class (index.css): a soft glow that
// follows the cursor across a card. Pointer position is written to CSS
// variables so the effect is pure CSS after that — no re-renders.
export function useSpotlight() {
  return {
    onMouseMove(e: MouseEvent<HTMLElement>) {
      const rect = e.currentTarget.getBoundingClientRect();
      e.currentTarget.style.setProperty('--mx', `${e.clientX - rect.left}px`);
      e.currentTarget.style.setProperty('--my', `${e.clientY - rect.top}px`);
    },
  };
}
