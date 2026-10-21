/**
 * The technique rig: a 2D articulated figure solved from a handful of
 * numbers per keyframe.
 *
 * Coordinates are SVG units with y pointing down. In the side view the
 * figure faces +x; "N" limbs are the ones nearest the camera and "F" the
 * far ones (drawn darker, behind the torso). In the front view N is the
 * figure's left (image right) and F its right.
 *
 * Limbs are posed either by a target point for the hand/ankle, solved
 * with two-bone IK (so a barbell travels in the straight line it should),
 * or by absolute segment angles (so a curl or a swing moves in a real
 * arc). Angles are measured from straight down, positive towards +x
 * (towards the midline-outwards side in the front view).
 */

export type Vec = readonly [number, number];

export const SEG = {
  thigh: 58,
  shin: 56,
  torso: 72,
  neck: 24,
  headR: 14,
  upper: 44,
  fore: 40,
} as const;

export interface Pose {
  /** Pelvis position. Give either `hip` or `sh` (shoulder anchor). */
  hip?: Vec;
  sh?: Vec;
  /** Torso lean in degrees from vertical; positive leans towards +x. */
  torso: number;
  /** Head direction in degrees from vertical; defaults to the torso's. */
  head?: number;
  /** Spine curvature in px: positive rounds (flexion), negative arches. */
  round?: number;
  armN: Vec;
  armF: Vec;
  legN: Vec;
  legF: Vec;
  /** Foot angle in degrees; positive points the toes down. */
  footN?: number;
  footF?: number;
}

export type ArmMode = "abs" | "shoulder" | "hip" | "angles";
export type LegMode = "abs" | "hip" | "angles";

export type Step =
  | { to: number; dur: number; label: string; ease?: "inOut" | "out" | "linear" }
  | { hold: number; label: string };

export type LoadType = "barbell" | "dumbbell" | "kettlebell" | "cable";

export interface Load {
  type: LoadType;
  /** Where the load sits; defaults to the near hand. */
  at?: "hands" | "back" | "hip";
  offset?: Vec;
  /** Pulley position for cable loads. */
  anchor?: Vec;
  /** Only the near hand holds a weight (one-arm work). */
  single?: boolean;
}

export type Prop =
  | { type: "bench"; x: number; y: number; w: number }
  | { type: "incline"; x: number; y: number; angle: number; len: number; seat?: Vec }
  | { type: "bar"; x: number; y: number }
  | { type: "parallel"; x1: number; x2: number; y: number }
  | { type: "box"; x: number; y: number; w: number; h: number }
  | { type: "pulley"; x: number; y: number }
  | { type: "pad"; x: number; y: number }
  | { type: "mat"; x: number; w: number };

export type Segment = "thigh" | "shin" | "torso" | "upper" | "fore" | "glute" | "calf";

export interface Demo {
  view: "side" | "front";
  /** viewBox [x, y, w, h]. */
  vb?: [number, number, number, number];
  /** Floor height, or false to hide it (hanging exercises). */
  ground?: number | false;
  arms: ArmMode;
  legs: LegMode;
  bend?: { kneeN?: 1 | -1; kneeF?: 1 | -1; elbowN?: 1 | -1; elbowF?: 1 | -1 };
  poses: Pose[];
  seq: Step[];
  load?: Load;
  props?: Prop[];
  work: Segment[];
  metric?: { joint: "knee" | "hip" | "elbow" | "shoulder"; label: string };
  trail?: "load" | "hip" | "shoulder" | "handN" | "ankleN";
  /** Vertical reference line (e.g. mid-foot for barbell lifts). */
  guide?: number;
  /** Pose index used for the static thumbnail. */
  thumb?: number;
  /** The most common mistake, as a patch applied to every pose. */
  wrong?: { title: string; note: string; patch: Partial<Pose>[] };
}

export interface Skeleton {
  view: "side" | "front";
  hip: Vec;
  shoulder: Vec;
  spineCtrl: Vec;
  neck: Vec;
  head: Vec;
  headDir: number;
  hipN: Vec;
  hipF: Vec;
  shN: Vec;
  shF: Vec;
  kneeN: Vec;
  kneeF: Vec;
  ankleN: Vec;
  ankleF: Vec;
  toeN: Vec;
  toeF: Vec;
  heelN: Vec;
  heelF: Vec;
  elbowN: Vec;
  elbowF: Vec;
  wristN: Vec;
  wristF: Vec;
  load?: Vec;
}

export const DEFAULT_VB: [number, number, number, number] = [0, 20, 360, 270];
export const DEFAULT_GROUND = 272;

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1]];
const sub = (a: Vec, b: Vec): Vec => [a[0] - b[0], a[1] - b[1]];
const scale = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k];
const len = (a: Vec) => Math.hypot(a[0], a[1]);

export const lerpVec = (a: Vec, b: Vec, t: number): Vec => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
];

/** Direction for an angle measured from straight down, positive to +x. */
const fromDown = (a: number, mirror = false): Vec => [
  (mirror ? -1 : 1) * Math.sin(rad(a)),
  Math.cos(rad(a)),
];

/** Direction for an angle measured from straight up, positive to +x. */
const fromUp = (a: number): Vec => [Math.sin(rad(a)), -Math.cos(rad(a))];

function rotate(v: Vec, a: number): Vec {
  const c = Math.cos(rad(a));
  const s = Math.sin(rad(a));
  return [v[0] * c - v[1] * s, v[0] * s + v[1] * c];
}

/**
 * Two-bone IK. Returns the middle joint (knee/elbow) for a chain of
 * lengths a, b from `root` reaching for `target`. `sign` picks which of
 * the two mirror solutions bends the joint.
 */
export function solveTwoBone(
  root: Vec,
  target: Vec,
  a: number,
  b: number,
  sign: 1 | -1
): { joint: Vec; end: Vec } {
  const d0 = sub(target, root);
  const dist = len(d0);
  const d = Math.min(a + b - 0.001, Math.max(Math.abs(a - b) + 0.001, dist));
  const base = Math.atan2(d0[1], d0[0]);
  const cosA = (a * a + d * d - b * b) / (2 * a * d);
  const A = Math.acos(Math.max(-1, Math.min(1, cosA)));
  const ang = base + sign * A;
  const joint: Vec = [root[0] + a * Math.cos(ang), root[1] + a * Math.sin(ang)];
  const toTarget = sub(target, joint);
  const l = len(toTarget) || 1;
  const end = add(joint, scale(toTarget, b / l));
  return { joint, end };
}

/** Interior angle at `b` between b→a and b→c, in degrees (180 = straight). */
export function jointAngle(a: Vec, b: Vec, c: Vec) {
  const u = sub(a, b);
  const v = sub(c, b);
  const cos = (u[0] * v[0] + u[1] * v[1]) / ((len(u) || 1) * (len(v) || 1));
  return deg(Math.acos(Math.max(-1, Math.min(1, cos))));
}

export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const n = (x: number | undefined, y: number | undefined, d = 0) =>
    (x ?? d) + ((y ?? d) - (x ?? d)) * t;
  return {
    hip: a.hip && b.hip ? lerpVec(a.hip, b.hip, t) : undefined,
    sh: a.sh && b.sh ? lerpVec(a.sh, b.sh, t) : undefined,
    torso: n(a.torso, b.torso),
    head:
      a.head === undefined && b.head === undefined
        ? undefined
        : n(a.head ?? a.torso, b.head ?? b.torso),
    round: n(a.round, b.round),
    armN: lerpVec(a.armN, b.armN, t),
    armF: lerpVec(a.armF, b.armF, t),
    legN: lerpVec(a.legN, b.legN, t),
    legF: lerpVec(a.legF, b.legF, t),
    footN: n(a.footN, b.footN),
    footF: n(a.footF, b.footF),
  };
}

export function solve(demo: Demo, pose: Pose): Skeleton {
  const front = demo.view === "front";
  const tDir = fromUp(pose.torso);
  let hip: Vec;
  let shoulder: Vec;
  if (pose.sh) {
    shoulder = pose.sh;
    hip = sub(shoulder, scale(tDir, SEG.torso));
  } else {
    hip = pose.hip ?? [180, 150];
    shoulder = add(hip, scale(tDir, SEG.torso));
  }

  // Perpendicular to the spine, pointing to the figure's front (side
  // view) or to its left (front view).
  const perp: Vec = [Math.cos(rad(pose.torso)), Math.sin(rad(pose.torso))];
  const mid = lerpVec(hip, shoulder, 0.5);
  const round = pose.round ?? 0;
  // Positive rounding bows the back outwards, i.e. away from the front.
  const spineCtrl = add(mid, scale(perp, -round));

  const headDir = pose.head ?? pose.torso;
  const neck = add(shoulder, scale(fromUp(headDir), 6));
  const head = add(shoulder, scale(fromUp(headDir), SEG.neck));

  const hipN = front ? add(hip, scale(perp, 11)) : hip;
  const hipF = front ? add(hip, scale(perp, -11)) : add(hip, [-2, 0]);
  const shN = front ? add(shoulder, scale(perp, 24)) : shoulder;
  const shF = front ? add(shoulder, scale(perp, -24)) : add(shoulder, [-2, -2]);

  const bend = demo.bend ?? {};
  // Knees bend forward in the side view and outwards in the front view.
  const kneeSignN = bend.kneeN ?? -1;
  const kneeSignF = bend.kneeF ?? (front ? 1 : -1);
  const elbowSignN = bend.elbowN ?? (front ? -1 : 1);
  const elbowSignF = bend.elbowF ?? (front ? 1 : 1);

  const leg = (root: Vec, spec: Vec, sign: 1 | -1, mirror: boolean) => {
    if (demo.legs === "angles") {
      const knee = add(root, scale(fromDown(spec[0], mirror), SEG.thigh));
      const ankle = add(knee, scale(fromDown(spec[1], mirror), SEG.shin));
      return { joint: knee, end: ankle };
    }
    const target = demo.legs === "hip" ? add(hip, spec) : spec;
    return solveTwoBone(root, target, SEG.thigh, SEG.shin, sign);
  };

  const arm = (root: Vec, spec: Vec, sign: 1 | -1, mirror: boolean) => {
    if (demo.arms === "angles") {
      const elbow = add(root, scale(fromDown(spec[0], mirror), SEG.upper));
      const wrist = add(elbow, scale(fromDown(spec[1], mirror), SEG.fore));
      return { joint: elbow, end: wrist };
    }
    const target =
      demo.arms === "shoulder"
        ? add(root, spec)
        : demo.arms === "hip"
          ? add(hip, spec)
          : spec;
    return solveTwoBone(root, target, SEG.upper, SEG.fore, sign);
  };

  const lN = leg(hipN, pose.legN, kneeSignN, false);
  const lF = leg(hipF, pose.legF, kneeSignF, front);
  const aN = arm(shN, pose.armN, elbowSignN, false);
  const aF = arm(shF, pose.armF, elbowSignF, front);

  const foot = (ankle: Vec, angle: number, mirror: boolean) => {
    if (front) {
      const s = mirror ? -1 : 1;
      return {
        toe: add(ankle, [s * 7, 9]),
        heel: add(ankle, [s * -2, 8]),
      };
    }
    return {
      toe: add(ankle, rotate([20, 8], angle)),
      heel: add(ankle, rotate([-6, 8], angle)),
    };
  };
  const fN = foot(lN.end, pose.footN ?? 0, false);
  const fF = foot(lF.end, pose.footF ?? 0, true);

  let load: Vec | undefined;
  if (demo.load) {
    const off = demo.load.offset ?? [0, 0];
    const at = demo.load.at ?? "hands";
    const base =
      at === "back"
        ? shoulder
        : at === "hip"
          ? hip
          : front
            ? lerpVec(aN.end, aF.end, 0.5)
            : aN.end;
    load = add(base, off);
  }

  return {
    view: demo.view,
    hip,
    shoulder,
    spineCtrl,
    neck,
    head,
    headDir,
    hipN,
    hipF,
    shN,
    shF,
    kneeN: lN.joint,
    kneeF: lF.joint,
    ankleN: lN.end,
    ankleF: lF.end,
    toeN: fN.toe,
    toeF: fF.toe,
    heelN: fN.heel,
    heelF: fF.heel,
    elbowN: aN.joint,
    elbowF: aF.joint,
    wristN: aN.end,
    wristF: aF.end,
    load,
  };
}

const ease = {
  inOut: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
  out: (t: number) => 1 - Math.pow(1 - t, 3),
  linear: (t: number) => t,
};

export interface Segmented {
  start: number;
  end: number;
  from: number;
  to: number;
  label: string;
  ease: (t: number) => number;
}

/** Flattens a demo's steps into absolute time segments. */
export function timeline(demo: Demo) {
  const segs: Segmented[] = [];
  let t = 0;
  let cur = 0;
  for (const s of demo.seq) {
    if ("hold" in s) {
      segs.push({ start: t, end: t + s.hold, from: cur, to: cur, label: s.label, ease: ease.linear });
      t += s.hold;
    } else {
      segs.push({
        start: t,
        end: t + s.dur,
        from: cur,
        to: s.to,
        label: s.label,
        ease: ease[s.ease ?? "inOut"],
      });
      t += s.dur;
      cur = s.to;
    }
  }
  return { segs, total: t };
}

export function poseAt(poses: Pose[], segs: Segmented[], total: number, time: number) {
  const tt = ((time % total) + total) % total;
  const seg = segs.find(s => tt >= s.start && tt < s.end) ?? segs[segs.length - 1]!;
  const p = seg.end > seg.start ? (tt - seg.start) / (seg.end - seg.start) : 1;
  const pose = lerpPose(poses[seg.from]!, poses[seg.to]!, seg.ease(Math.min(1, p)));
  return { pose, seg, index: segs.indexOf(seg), progress: p };
}

/** Applies the "common mistake" patch to every keyframe. */
export function wrongPoses(demo: Demo): Pose[] {
  if (!demo.wrong) return demo.poses;
  return demo.poses.map((p, i) => ({ ...p, ...(demo.wrong!.patch[i] ?? demo.wrong!.patch[0]) }));
}

export function metricValue(demo: Demo, s: Skeleton) {
  if (!demo.metric) return undefined;
  switch (demo.metric.joint) {
    case "knee":
      return jointAngle(s.hipN, s.kneeN, s.ankleN);
    case "hip":
      return jointAngle(s.shoulder, s.hip, s.kneeN);
    case "elbow":
      return jointAngle(s.shN, s.elbowN, s.wristN);
    case "shoulder":
      return jointAngle(s.hipN, s.shN, s.elbowN);
  }
}

/** Samples the path a point follows over the whole loop (bar path etc.). */
export function samplePath(demo: Demo, poses: Pose[], samples = 72): Vec[] {
  const { segs, total } = timeline(demo);
  const pts: Vec[] = [];
  for (let i = 0; i <= samples; i++) {
    const { pose } = poseAt(poses, segs, total, (i / samples) * total * 0.999);
    const s = solve(demo, pose);
    const key = demo.trail ?? "load";
    const p =
      key === "load"
        ? s.load ?? s.wristN
        : key === "hip"
          ? s.hip
          : key === "shoulder"
            ? s.shoulder
            : key === "ankleN"
              ? s.ankleN
              : s.wristN;
    pts.push(p);
  }
  return pts;
}

/** Largest distance a limb target falls short of its reach, per pose. */
export function reachReport(demo: Demo) {
  return demo.poses.map((pose, i) => {
    const s = solve(demo, pose);
    const out: string[] = [];
    const check = (name: string, root: Vec, end: Vec, target: Vec, max: number) => {
      const short = len(sub(target, root)) - max;
      const miss = len(sub(target, end));
      if (short > 2 && miss > 2) out.push(`${name} +${short.toFixed(1)}`);
    };
    if (demo.legs !== "angles") {
      const tN = demo.legs === "hip" ? add(s.hip, pose.legN) : pose.legN;
      const tF = demo.legs === "hip" ? add(s.hip, pose.legF) : pose.legF;
      check("legN", s.hipN, s.ankleN, tN, SEG.thigh + SEG.shin);
      check("legF", s.hipF, s.ankleF, tF, SEG.thigh + SEG.shin);
    }
    if (demo.arms !== "angles") {
      const tgt = (root: Vec, spec: Vec) =>
        demo.arms === "shoulder" ? add(root, spec) : demo.arms === "hip" ? add(s.hip, spec) : spec;
      check("armN", s.shN, s.wristN, tgt(s.shN, pose.armN), SEG.upper + SEG.fore);
      check("armF", s.shF, s.wristF, tgt(s.shF, pose.armF), SEG.upper + SEG.fore);
    }
    return { pose: i, issues: out };
  });
}
