// Static stand-in for the WebGL globe on phones and low-end devices:
// CSS-only orbiting rings over a gradient sphere. Same silhouette,
// none of the three.js cost.
export default function GlobeFallback() {
  return (
    <div className="w-full h-full flex items-center justify-center" aria-hidden="true">
      <div className="relative w-56 h-56 sm:w-72 sm:h-72">
        <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle_at_35%_30%,#4f46e5_0%,#1B1A45_55%,#0f0e2a_100%)] shadow-[0_0_80px_rgba(255,90,54,0.25)]" />
        <div className="absolute inset-0 rounded-full border border-white/10" />
        <div className="absolute inset-[-6%] rounded-full border border-dashed border-accent/50 animate-[spin_28s_linear_infinite]" />
        <div className="absolute inset-[6%] rounded-full border border-dotted border-white/25 animate-[spin_40s_linear_infinite_reverse]" />
        <div className="absolute left-1/2 top-1/2 w-[120%] h-[38%] -translate-x-1/2 -translate-y-1/2 rounded-[100%] border border-orange-300/40 rotate-[-18deg] animate-[spin_18s_linear_infinite]" />
        {[
          { top: '28%', left: '38%' },
          { top: '52%', left: '62%' },
          { top: '64%', left: '30%' },
        ].map((dot, i) => (
          <span
            key={i}
            className="absolute w-2.5 h-2.5 rounded-full bg-accent shadow-[0_0_12px_rgba(255,90,54,0.9)] animate-pulse"
            style={{ ...dot, animationDelay: `${i * 0.6}s` }}
          />
        ))}
      </div>
    </div>
  );
}
