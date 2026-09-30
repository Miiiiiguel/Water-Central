import { useEffect, useRef, useState } from 'react';
import { useInView, animate } from 'framer-motion';

interface CountUpProps {
  // Accepts values like "75+", "220", "24/7", "$499" — the leading
  // numeric run animates from 0, everything before/after it (currency
  // signs, "+", "/7") stays static. Values with no digits (e.g. plain
  // text) just render as-is, unanimated.
  value: string;
  duration?: number;
  className?: string;
}

export default function CountUp({ value, duration = 1.4, className }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, amount: 0.5 });
  const match = value.match(/^(\D*)(\d+)(.*)$/);
  const [display, setDisplay] = useState(match ? `${match[1]}0${match[3]}` : value);

  useEffect(() => {
    if (!isInView || !match) return;
    const prefix = match[1];
    const suffix = match[3];
    const target = parseInt(match[2], 10);
    const controls = animate(0, target, {
      duration,
      ease: 'easeOut',
      onUpdate(v) {
        setDisplay(`${prefix}${Math.round(v)}${suffix}`);
      },
    });
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInView]);

  return (
    <span ref={ref} className={className}>
      {match ? display : value}
    </span>
  );
}
