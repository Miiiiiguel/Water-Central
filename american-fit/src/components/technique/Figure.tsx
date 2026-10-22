import { useId } from "react";
import {
  DEFAULT_GROUND,
  DEFAULT_VB,
  type Demo,
  type Prop,
  type Segment,
  type Skeleton,
  type Vec,
} from "./rig";

interface FigureProps {
  demo: Demo;
  s: Skeleton;
  ghosts?: Skeleton[];
  trail?: Vec[];
  wrong?: boolean;
  /** Smaller strokes and no decorations, for list thumbnails. */
  compact?: boolean;
  /** Paint a dark tile behind the figure so it reads on light surfaces too. */
  tile?: boolean;
  className?: string;
}

const W = { thigh: 15, shin: 12, upper: 11, fore: 9, torso: 26, foot: 7 };

const pts = (p: Vec[]) => p.map(v => `${v[0].toFixed(1)},${v[1].toFixed(1)}`).join(" ");

function Bone({
  a,
  b,
  w,
  stroke,
  filter,
}: {
  a: Vec;
  b: Vec;
  w: number;
  stroke: string;
  filter?: string;
}) {
  return (
    <line
      x1={a[0]}
      y1={a[1]}
      x2={b[0]}
      y2={b[1]}
      stroke={stroke}
      strokeWidth={w}
      strokeLinecap="round"
      filter={filter}
    />
  );
}

function PropShape({ p, ground }: { p: Prop; ground: number }) {
  const metal = "#566079";
  const pad = "#232b3d";
  switch (p.type) {
    case "bench":
      return (
        <g>
          <rect x={p.x + 10} y={p.y + 8} width={6} height={ground - p.y - 8} rx={2} fill={metal} />
          <rect x={p.x + p.w - 16} y={p.y + 8} width={6} height={ground - p.y - 8} rx={2} fill={metal} />
          <rect x={p.x} y={p.y} width={p.w} height={11} rx={5} fill={pad} stroke="#33405a" />
        </g>
      );
    case "incline": {
      const a = (p.angle * Math.PI) / 180;
      const end: Vec = [p.x + Math.cos(a) * p.len, p.y + Math.sin(a) * p.len];
      return (
        <g>
          {p.seat && (
            <>
              <rect x={p.seat[0] - 4} y={p.seat[1] + 8} width={6} height={ground - p.seat[1] - 8} fill={metal} />
              <rect x={p.seat[0] - 30} y={p.seat[1]} width={58} height={11} rx={5} fill={pad} stroke="#33405a" />
            </>
          )}
          <line x1={p.x} y1={p.y} x2={p.x - 6} y2={ground} stroke={metal} strokeWidth={6} />
          <line x1={p.x} y1={p.y} x2={end[0]} y2={end[1]} stroke={pad} strokeWidth={12} strokeLinecap="round" />
          <line x1={p.x} y1={p.y} x2={end[0]} y2={end[1]} stroke="#33405a" strokeWidth={1} />
        </g>
      );
    }
    case "bar":
      return (
        <g>
          <line x1={p.x + 70} y1={p.y} x2={p.x + 70} y2={ground} stroke="#2a3246" strokeWidth={6} />
          <line x1={p.x} y1={p.y} x2={p.x + 70} y2={p.y} stroke="#2a3246" strokeWidth={3} />
          <circle cx={p.x} cy={p.y} r={4.5} fill="#c9d0de" />
        </g>
      );
    case "parallel":
      return (
        <g>
          <line x1={p.x1 + 10} y1={p.y} x2={p.x1 + 10} y2={ground} stroke="#2a3246" strokeWidth={5} />
          <line x1={p.x2 - 10} y1={p.y} x2={p.x2 - 10} y2={ground} stroke="#2a3246" strokeWidth={5} />
          <line x1={p.x1} y1={p.y} x2={p.x2} y2={p.y} stroke="#c9d0de" strokeWidth={5} strokeLinecap="round" />
        </g>
      );
    case "box":
      return <rect x={p.x} y={p.y} width={p.w} height={p.h} rx={4} fill={pad} stroke="#33405a" />;
    case "pulley":
      return (
        <g>
          <line x1={p.x} y1={p.y - 30} x2={p.x} y2={p.y} stroke="#2a3246" strokeWidth={4} />
          <circle cx={p.x} cy={p.y} r={7} fill="#1a2132" stroke={metal} strokeWidth={2} />
        </g>
      );
    case "pad":
      return <rect x={p.x - 12} y={p.y - 7} width={24} height={14} rx={7} fill={pad} stroke="#33405a" />;
    case "mat":
      return <rect x={p.x} y={ground - 4} width={p.w} height={4} rx={2} fill="#1f3a5f" opacity={0.7} />;
  }
}

function Ghost({ s }: { s: Skeleton }) {
  const c = "rgb(255 255 255 / 0.16)";
  const line = (a: Vec, b: Vec, w = 2) => (
    <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={c} strokeWidth={w} strokeLinecap="round" />
  );
  return (
    <g strokeDasharray="3 4">
      {line(s.hipN, s.kneeN)}
      {line(s.kneeN, s.ankleN)}
      {line(s.hip, s.shoulder)}
      {line(s.shN, s.elbowN)}
      {line(s.elbowN, s.wristN)}
      <circle cx={s.head[0]} cy={s.head[1]} r={12} fill="none" stroke={c} strokeWidth={2} />
    </g>
  );
}

export function Figure({ demo, s, ghosts, trail, wrong, compact, tile, className }: FigureProps) {
  const id = useId().replace(/:/g, "");
  const vb = demo.vb ?? DEFAULT_VB;
  const ground = demo.ground === false ? vb[1] + vb[3] + 40 : demo.ground ?? DEFAULT_GROUND;
  const work = new Set<Segment>(demo.work);
  const front = s.view === "front";

  const near = `url(#${id}-near)`;
  const hot = wrong ? `url(#${id}-bad)` : `url(#${id}-hot)`;
  const far = "#56627e";
  const farHot = wrong ? "#6b4a1f" : "#7a2633";
  const glow = compact ? undefined : `url(#${id}-glow)`;

  const c = (seg: Segment) => (work.has(seg) ? hot : near);
  const cf = (seg: Segment) => (front ? c(seg) : work.has(seg) ? farHot : far);
  const fl = (seg: Segment) => (work.has(seg) ? glow : undefined);

  const torsoPath = `M${s.hip[0]},${s.hip[1]} Q${s.spineCtrl[0]},${s.spineCtrl[1]} ${s.shoulder[0]},${s.shoulder[1]}`;

  const backProps = (demo.props ?? []).filter(p => p.type !== "bar" && p.type !== "parallel");
  const frontProps = (demo.props ?? []).filter(p => p.type === "bar" || p.type === "parallel");

  const face: Vec = [Math.cos((s.headDir * Math.PI) / 180), Math.sin((s.headDir * Math.PI) / 180)];
  const up: Vec = [Math.sin((s.headDir * Math.PI) / 180), -Math.cos((s.headDir * Math.PI) / 180)];

  // Glutes sit just behind the hip joint, opposite the way the chest faces.
  const spine: Vec = [s.shoulder[0] - s.hip[0], s.shoulder[1] - s.hip[1]];
  const sl = Math.hypot(spine[0], spine[1]) || 1;
  const glute: Vec = [s.hip[0] + (spine[1] / sl) * 7, s.hip[1] - (spine[0] / sl) * 7];

  const load = demo.load;
  const lp = s.load;

  const dumbbell = (p: Vec, dim = false) => (
    <g opacity={dim ? 0.55 : 1}>
      <rect x={p[0] - 9} y={p[1] - 9} width={18} height={18} rx={5} fill="#141a27" stroke="#8792a8" strokeWidth={2.5} />
      <circle cx={p[0]} cy={p[1]} r={3} fill="#8792a8" />
    </g>
  );

  return (
    <svg
      viewBox={vb.join(" ")}
      className={className}
      role="img"
      aria-label="Demostración animada de la técnica"
    >
      <defs>
        {/* userSpaceOnUse: an objectBoundingBox gradient paints nothing on a
            perfectly vertical or horizontal bone (its box has zero width). */}
        <linearGradient id={`${id}-near`} gradientUnits="userSpaceOnUse" x1={0} y1={vb[1]} x2={0} y2={vb[1] + vb[3]}>
          <stop offset="0" stopColor="#f2f4f9" />
          <stop offset="1" stopColor="#b4bccb" />
        </linearGradient>
        <linearGradient id={`${id}-hot`} gradientUnits="userSpaceOnUse" x1={vb[0]} y1={vb[1]} x2={vb[0] + vb[2]} y2={vb[1] + vb[3]}>
          <stop offset="0" stopColor="#ff6b5a" />
          <stop offset="1" stopColor="#ff2f48" />
        </linearGradient>
        <linearGradient id={`${id}-bad`} gradientUnits="userSpaceOnUse" x1={vb[0]} y1={vb[1]} x2={vb[0] + vb[2]} y2={vb[1] + vb[3]}>
          <stop offset="0" stopColor="#ffc35a" />
          <stop offset="1" stopColor="#ff8a2f" />
        </linearGradient>
        <radialGradient id={`${id}-floor`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor={wrong ? "#ff9a3c" : "#8b4dff"} stopOpacity="0.28" />
          <stop offset="1" stopColor="#8b4dff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-trail`} gradientUnits="userSpaceOnUse" x1={0} y1={vb[1]} x2={0} y2={vb[1] + vb[3]}>
          <stop offset="0" stopColor="#8db3ff" />
          <stop offset="1" stopColor="#3c7bff" />
        </linearGradient>
        <filter id={`${id}-glow`} filterUnits="userSpaceOnUse" x={vb[0]} y={vb[1]} width={vb[2]} height={vb[3]}>
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {tile && <rect x={vb[0]} y={vb[1]} width={vb[2]} height={vb[3]} rx={22} fill="#161c29" />}

      {demo.ground !== false && (
        <g>
          <ellipse cx={s.hip[0]} cy={ground + 2} rx={130} ry={14} fill={`url(#${id}-floor)`} />
          <line x1={vb[0]} y1={ground} x2={vb[0] + vb[2]} y2={ground} stroke="rgb(255 255 255 / 0.12)" strokeWidth={1.5} />
          {!compact &&
            Array.from({ length: 12 }, (_, i) => (
              <line
                key={i}
                x1={vb[0] + i * 32}
                y1={ground + 1}
                x2={vb[0] + i * 32 - 14}
                y2={ground + 14}
                stroke="rgb(255 255 255 / 0.04)"
              />
            ))}
        </g>
      )}

      {!compact && demo.guide !== undefined && (
        <line
          x1={demo.guide}
          y1={vb[1] + 6}
          x2={demo.guide}
          y2={ground}
          stroke="#3c7bff"
          strokeOpacity={0.35}
          strokeDasharray="2 6"
          strokeWidth={1.5}
        />
      )}

      {backProps.map((p, i) => (
        <PropShape key={i} p={p} ground={ground} />
      ))}

      {trail && trail.length > 1 && (
        <polyline
          points={pts(trail)}
          fill="none"
          stroke={`url(#${id}-trail)`}
          strokeOpacity={0.75}
          strokeWidth={2}
          strokeDasharray="1 5"
          strokeLinecap="round"
        />
      )}

      {ghosts?.map((g, i) => <Ghost key={i} s={g} />)}

      {load?.type === "cable" && lp && load.anchor && (
        <line x1={load.anchor[0]} y1={load.anchor[1]} x2={lp[0]} y2={lp[1]} stroke="#8792a8" strokeWidth={1.5} />
      )}

      {/* Far side */}
      <g>
        <Bone a={s.shF} b={s.elbowF} w={W.upper} stroke={cf("upper")} />
        <Bone a={s.elbowF} b={s.wristF} w={W.fore} stroke={cf("fore")} />
        {!front && <circle cx={s.wristF[0]} cy={s.wristF[1]} r={4.5} fill={far} />}
        <Bone a={s.hipF} b={s.kneeF} w={W.thigh} stroke={cf("thigh")} />
        <Bone a={s.kneeF} b={s.ankleF} w={W.shin} stroke={cf(work.has("calf") ? "calf" : "shin")} />
        <Bone a={s.heelF} b={s.toeF} w={W.foot} stroke={front ? near : far} />
        {load?.type === "dumbbell" && !front && !load.single && dumbbell(s.wristF, true)}
      </g>

      {/* Torso */}
      {work.has("glute") && !front && <circle cx={glute[0]} cy={glute[1]} r={13} fill={hot} filter={glow} />}
      {front ? (
        <polygon
          points={pts([s.hipN, s.shN, s.shF, s.hipF])}
          fill={c("torso")}
          stroke={c("torso")}
          strokeWidth={12}
          strokeLinejoin="round"
          filter={fl("torso")}
        />
      ) : (
        <path d={torsoPath} fill="none" stroke={c("torso")} strokeWidth={W.torso} strokeLinecap="round" filter={fl("torso")} />
      )}
      {work.has("glute") && front && (
        <>
          <circle cx={s.hipN[0]} cy={s.hipN[1]} r={9} fill={hot} />
          <circle cx={s.hipF[0]} cy={s.hipF[1]} r={9} fill={hot} />
        </>
      )}
      <Bone a={s.shoulder} b={s.neck} w={9} stroke={near} />
      <circle cx={s.head[0]} cy={s.head[1]} r={14} fill={near} />
      {!front ? (
        <ellipse
          cx={s.head[0] + face[0] * 7 + up[0] * 2}
          cy={s.head[1] + face[1] * 7 + up[1] * 2}
          rx={3.2}
          ry={2.2}
          fill="#0b0f17"
          opacity={0.75}
          transform={`rotate(${s.headDir} ${s.head[0] + face[0] * 7 + up[0] * 2} ${s.head[1] + face[1] * 7 + up[1] * 2})`}
        />
      ) : (
        <rect x={s.head[0] - 7} y={s.head[1] - 3} width={14} height={4} rx={2} fill="#0b0f17" opacity={0.6} />
      )}

      {/* Near side */}
      <g>
        <Bone a={s.hipN} b={s.kneeN} w={W.thigh} stroke={c("thigh")} filter={fl("thigh")} />
        <Bone
          a={s.kneeN}
          b={s.ankleN}
          w={W.shin}
          stroke={c(work.has("calf") ? "calf" : "shin")}
          filter={fl(work.has("calf") ? "calf" : "shin")}
        />
        <Bone a={s.heelN} b={s.toeN} w={W.foot} stroke={near} />
        {!compact && <circle cx={s.kneeN[0]} cy={s.kneeN[1]} r={2.6} fill="#0b0f17" opacity={0.5} />}
        <Bone a={s.shN} b={s.elbowN} w={W.upper} stroke={c("upper")} filter={fl("upper")} />
        <Bone a={s.elbowN} b={s.wristN} w={W.fore} stroke={c("fore")} filter={fl("fore")} />
        <circle cx={s.wristN[0]} cy={s.wristN[1]} r={5} fill={near} />
        {front && <circle cx={s.wristF[0]} cy={s.wristF[1]} r={5} fill={near} />}
        {!compact && <circle cx={s.elbowN[0]} cy={s.elbowN[1]} r={2.2} fill="#0b0f17" opacity={0.5} />}
      </g>

      {/* Load */}
      {lp && load?.type === "barbell" && (
        <g>
          {front ? (
            <>
              <line x1={lp[0] - 95} y1={lp[1]} x2={lp[0] + 95} y2={lp[1]} stroke="#c9d0de" strokeWidth={3.5} strokeLinecap="round" />
              <rect x={lp[0] - 92} y={lp[1] - 22} width={9} height={44} rx={3} fill="#1a2132" stroke="#8b4dff" strokeWidth={2} />
              <rect x={lp[0] + 83} y={lp[1] - 22} width={9} height={44} rx={3} fill="#1a2132" stroke="#8b4dff" strokeWidth={2} />
            </>
          ) : (
            <>
              <circle cx={lp[0]} cy={lp[1]} r={21} fill="#141a27" fillOpacity={0.92} stroke="#8b4dff" strokeWidth={3} />
              <circle cx={lp[0]} cy={lp[1]} r={13} fill="none" stroke="rgb(255 255 255 / 0.12)" strokeWidth={1.5} />
              <circle cx={lp[0]} cy={lp[1]} r={3.5} fill="#c9d0de" />
            </>
          )}
        </g>
      )}
      {load?.type === "dumbbell" &&
        (front ? (
          <>
            {dumbbell(s.wristN)}
            {dumbbell(s.wristF)}
          </>
        ) : (
          dumbbell(s.wristN)
        ))}
      {lp && load?.type === "kettlebell" && (
        <g>
          <path
            d={`M${lp[0] - 6},${lp[1] - 4} Q${lp[0]},${lp[1] - 14} ${lp[0] + 6},${lp[1] - 4}`}
            fill="none"
            stroke="#8792a8"
            strokeWidth={3}
          />
          <circle cx={lp[0]} cy={lp[1] + 8} r={11} fill="#141a27" stroke="#8792a8" strokeWidth={2.5} />
        </g>
      )}
      {lp && load?.type === "cable" && <circle cx={lp[0]} cy={lp[1]} r={4} fill="#c9d0de" />}

      {frontProps.map((p, i) => (
        <PropShape key={i} p={p} ground={ground} />
      ))}
    </svg>
  );
}
