import { motion, useScroll, useSpring } from 'framer-motion';

// Thin brand-colored bar at the very top that fills as you scroll —
// a small "this is an app" cue, and a real orientation aid on the long
// home page.
export default function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 24, mass: 0.3 });
  return (
    <motion.div
      aria-hidden="true"
      style={{ scaleX }}
      className="fixed top-0 inset-x-0 h-[3px] z-[60] origin-left bg-gradient-to-r from-orange-500 via-accent to-orange-400 pointer-events-none"
    />
  );
}
