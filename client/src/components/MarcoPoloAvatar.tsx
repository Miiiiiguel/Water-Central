// Marco Polo's face: a compass rose — the explorer who opened trade
// routes, now guiding brands into the US market. Pure SVG, brand colors,
// animates while he's talking.
export default function MarcoPoloAvatar({ size = 40, speaking = false, className = '' }: { size?: number; speaking?: boolean; className?: string }) {
  return (
    <span
      className={`relative inline-flex items-center justify-center rounded-full bg-gradient-to-br from-primary to-indigo-950 flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {speaking && (
        <>
          <span className="absolute inset-0 rounded-full bg-accent/40 animate-ping" />
          <span className="absolute -inset-1 rounded-full border-2 border-accent/50 animate-pulse" />
        </>
      )}
      <svg viewBox="0 0 48 48" width={size * 0.62} height={size * 0.62} className={`relative ${speaking ? 'animate-[spin_6s_linear_infinite]' : ''}`}>
        <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" />
        <circle cx="24" cy="24" r="14" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1" strokeDasharray="2 3" />
        <path d="M24 6 L27.5 21 L24 24 L20.5 21 Z" fill="#FF5A36" />
        <path d="M24 42 L20.5 27 L24 24 L27.5 27 Z" fill="#ffffff" fillOpacity="0.85" />
        <path d="M6 24 L21 20.5 L24 24 L21 27.5 Z" fill="#ffffff" fillOpacity="0.55" />
        <path d="M42 24 L27 27.5 L24 24 L27 20.5 Z" fill="#ffffff" fillOpacity="0.55" />
        <circle cx="24" cy="24" r="3" fill="#1B1A45" stroke="#FF5A36" strokeWidth="1.5" />
      </svg>
    </span>
  );
}
