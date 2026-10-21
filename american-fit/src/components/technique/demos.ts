import type { Demo } from "./rig";

/*
 * Keyframes for every animated technique demo.
 *
 * Floor is y=272 and a flat-footed ankle sits at y=263. The figure faces
 * +x. Numbers were tuned against the rig's segment lengths (see SEG in
 * rig.ts); `pnpm test` checks that no limb target is out of reach.
 */

const ANK = 263;
const STAND = { hip: [180, 149] as const, torso: 0 };

export const DEMOS: Record<string, Demo> = {
  squat_barbell: {
    view: "side",
    arms: "shoulder",
    legs: "abs",
    bend: { elbowN: -1, elbowF: -1 },
    load: { type: "barbell" },
    guide: 190,
    trail: "load",
    work: ["thigh", "glute"],
    metric: { joint: "knee", label: "Rodilla" },
    thumb: 1,
    poses: [
      { hip: [180, 149], torso: 16, armN: [-14, -4], armF: [-14, -4], legN: [184, ANK], legF: [182, ANK] },
      { hip: [154, 219], torso: 42, armN: [-14, -4], armF: [-14, -4], legN: [184, ANK], legF: [182, ANK] },
    ],
    seq: [
      { hold: 0.6, label: "Pecho arriba, abdomen firme, barra sobre medio pie" },
      { to: 1, dur: 2.4, label: "Baja: cadera atrás y abajo, rodillas siguen la punta del pie" },
      { hold: 0.35, label: "Profundidad: cadera a la altura de la rodilla o más abajo" },
      { to: 0, dur: 1.2, ease: "out", label: "Sube empujando el suelo con todo el pie" },
      { hold: 0.5, label: "Bloquea arriba sin hiperextender la espalda" },
    ],
    wrong: {
      title: "Talones arriba y pecho que cae",
      note: "Si los talones se despegan y el torso se desploma, la carga se va a las rodillas y a la zona lumbar. Peso repartido en todo el pie y pecho orgulloso.",
      patch: [{}, { torso: 60, round: 14, legN: [192, 252], legF: [190, 252], footN: 32, footF: 32 }],
    },
  },

  squat_goblet: {
    view: "side",
    arms: "shoulder",
    legs: "abs",
    load: { type: "kettlebell", offset: [0, 0] },
    work: ["thigh", "glute"],
    metric: { joint: "knee", label: "Rodilla" },
    thumb: 1,
    poses: [
      { hip: [180, 149], torso: 4, armN: [16, 26], armF: [16, 26], legN: [184, ANK], legF: [182, ANK] },
      { hip: [158, 224], torso: 24, armN: [16, 26], armF: [16, 26], legN: [184, ANK], legF: [182, ANK] },
    ],
    seq: [
      { hold: 0.5, label: "Pesa pegada al pecho, codos abajo" },
      { to: 1, dur: 2.2, label: "Baja entre las piernas, torso alto" },
      { hold: 0.4, label: "Codos por dentro de las rodillas" },
      { to: 0, dur: 1.2, ease: "out", label: "Sube con fuerza manteniendo el pecho" },
      { hold: 0.4, label: "Aprieta glúteos arriba" },
    ],
  },

  squat_air: {
    view: "side",
    arms: "angles",
    legs: "abs",
    work: ["thigh", "glute"],
    metric: { joint: "knee", label: "Rodilla" },
    thumb: 1,
    poses: [
      { hip: [180, 149], torso: 6, armN: [4, 4], armF: [4, 4], legN: [184, ANK], legF: [182, ANK] },
      { hip: [154, 222], torso: 36, armN: [88, 90], armF: [88, 90], legN: [184, ANK], legF: [182, ANK] },
    ],
    seq: [
      { hold: 0.4, label: "Pies al ancho de hombros, puntas algo abiertas" },
      { to: 1, dur: 1.8, label: "Baja llevando los brazos al frente para equilibrar" },
      { hold: 0.3, label: "Talones en el suelo, espalda neutra" },
      { to: 0, dur: 1.0, ease: "out", label: "Sube y extiende la cadera completa" },
      { hold: 0.3, label: "De pie, glúteos firmes" },
    ],
  },

  split_squat: {
    view: "side",
    arms: "shoulder",
    legs: "abs",
    load: { type: "dumbbell" },
    work: ["thigh", "glute"],
    metric: { joint: "knee", label: "Rodilla delantera" },
    thumb: 1,
    poses: [
      { hip: [176, 158], torso: 4, armN: [2, 80], armF: [2, 80], legN: [214, ANK], legF: [118, 252], footF: 40 },
      { hip: [170, 208], torso: 8, armN: [2, 80], armF: [2, 80], legN: [214, ANK], legF: [118, 252], footF: 40 },
    ],
    seq: [
      { hold: 0.4, label: "Zancada larga, pies al ancho de cadera" },
      { to: 1, dur: 2.0, label: "Baja vertical, rodilla trasera hacia el suelo" },
      { hold: 0.3, label: "Ambas rodillas a ~90°" },
      { to: 0, dur: 1.1, ease: "out", label: "Empuja con el talón delantero" },
      { hold: 0.3, label: "Torso alto todo el recorrido" },
    ],
  },

  bulgarian: {
    view: "side",
    arms: "shoulder",
    legs: "abs",
    load: { type: "dumbbell" },
    props: [{ type: "bench", x: 34, y: 214, w: 90 }],
    work: ["thigh", "glute"],
    metric: { joint: "knee", label: "Rodilla delantera" },
    thumb: 1,
    poses: [
      { hip: [186, 162], torso: 8, armN: [2, 80], armF: [2, 80], legN: [236, ANK], legF: [116, 207], footF: 165 },
      { hip: [176, 212], torso: 18, armN: [2, 80], armF: [2, 80], legN: [236, ANK], legF: [116, 207], footF: 165 },
    ],
    seq: [
      { hold: 0.4, label: "Empeine trasero sobre el banco" },
      { to: 1, dur: 2.2, label: "Baja controlado, peso en la pierna delantera" },
      { hold: 0.3, label: "Ligera inclinación del torso = más glúteo" },
      { to: 0, dur: 1.2, ease: "out", label: "Sube empujando el talón delantero" },
      { hold: 0.3, label: "Rodilla alineada con el pie" },
    ],
  },

  calf_raise: {
    view: "side",
    arms: "shoulder",
    legs: "abs",
    work: ["calf"],
    trail: "ankleN",
    thumb: 1,
    poses: [
      { hip: [180, 149], torso: 0, armN: [2, 82], armF: [2, 82], legN: [184, ANK], legF: [182, ANK] },
      { hip: [191, 138], torso: 0, armN: [2, 82], armF: [2, 82], legN: [195.5, 251], legF: [193.5, 251], footN: 45, footF: 45 },
    ],
    seq: [
      { hold: 0.3, label: "Rodillas extendidas, peso en el antepié" },
      { to: 1, dur: 0.9, ease: "out", label: "Sube lo más alto posible" },
      { hold: 0.8, label: "Pausa de 1 s arriba" },
      { to: 0, dur: 1.8, label: "Baja lento hasta estirar" },
      { hold: 0.4, label: "Estira abajo sin rebotar" },
    ],
  },

  rdl: {
    view: "side",
    arms: "shoulder",
    legs: "abs",
    load: { type: "barbell" },
    guide: 188,
    trail: "load",
    work: ["thigh", "glute"],
    metric: { joint: "hip", label: "Cadera" },
    thumb: 1,
    poses: [
      { hip: [178, 150], torso: 2, armN: [3, 82], armF: [3, 82], legN: [184, ANK], legF: [182, ANK] },
      { hip: [126, 168], torso: 66, armN: [-6, 83], armF: [-6, 83], legN: [184, ANK], legF: [182, ANK] },
    ],
    seq: [
      { hold: 0.4, label: "Rodillas suaves, barra pegada a los muslos" },
      { to: 1, dur: 2.4, label: "Lleva la cadera atrás; la barra roza las piernas" },
      { hold: 0.4, label: "Para cuando sientas el estiramiento del isquio" },
      { to: 0, dur: 1.3, ease: "out", label: "Empuja la cadera adelante para subir" },
      { hold: 0.4, label: "Glúteos apretados arriba" },
    ],
    wrong: {
      title: "Espalda redondeada",
      note: "Redondear la espalda pasa la carga de los isquios a los discos lumbares. Cadera atrás, pecho largo y barra pegada a las piernas.",
      patch: [{}, { round: 18, head: 100 }],
    },
  },

  deadlift: {
    view: "side",
    arms: "abs",
    legs: "abs",
    load: { type: "barbell" },
    guide: 189,
    trail: "load",
    work: ["thigh", "glute", "torso"],
    metric: { joint: "hip", label: "Cadera" },
    thumb: 0,
    poses: [
      { hip: [137, 205], torso: 58, armN: [192, 250], armF: [192, 250], legN: [184, ANK], legF: [182, ANK] },
      { hip: [182, 149], torso: 0, armN: [186, 160], armF: [186, 160], legN: [184, ANK], legF: [182, ANK] },
    ],
    seq: [
      { hold: 0.7, label: "Barra sobre medio pie, espinillas cerca, espalda neutra" },
      { to: 1, dur: 1.6, label: "Empuja el suelo; la barra sube pegada a las piernas" },
      { hold: 0.5, label: "Bloquea con glúteos, sin echarte atrás" },
      { to: 0, dur: 1.8, label: "Baja: cadera atrás primero, luego rodillas" },
      { hold: 0.3, label: "Reinicia la tensión antes de cada repetición" },
    ],
    wrong: {
      title: "Espalda redondeada al despegar",
      note: "Tirar con la espalda curvada concentra la fuerza en la columna. Tensa los dorsales (\"exprime naranjas bajo las axilas\") y saca el pecho antes de tirar.",
      patch: [{ round: 20, head: 82 }, {}],
    },
  },

  hip_thrust: {
    view: "side",
    arms: "hip",
    legs: "abs",
    load: { type: "barbell", at: "hip", offset: [2, -17] },
    props: [{ type: "bench", x: 14, y: 222, w: 94 }],
    trail: "hip",
    work: ["glute", "thigh"],
    metric: { joint: "hip", label: "Cadera" },
    thumb: 1,
    poses: [
      { sh: [100, 208], torso: -62, head: -40, armN: [4, -16], armF: [4, -16], legN: [238, ANK], legF: [236, ANK] },
      { sh: [100, 208], torso: -90, head: -58, armN: [4, -16], armF: [4, -16], legN: [238, ANK], legF: [236, ANK] },
    ],
    seq: [
      { hold: 0.4, label: "Borde del banco bajo las escápulas, mentón al pecho" },
      { to: 1, dur: 1.0, ease: "out", label: "Empuja con los talones y sube la cadera" },
      { hold: 0.9, label: "Arriba: tibias verticales, glúteos al máximo" },
      { to: 0, dur: 1.8, label: "Baja controlado sin perder la posición" },
      { hold: 0.3, label: "Costillas abajo todo el tiempo" },
    ],
    wrong: {
      title: "Arquear la lumbar arriba",
      note: "Subir arqueando la espalda en vez de extender la cadera quita trabajo al glúteo. Mira al frente, costillas abajo y termina con la pelvis en retroversión.",
      patch: [{}, { round: -14, head: -100 }],
    },
  },

  glute_bridge: {
    view: "side",
    vb: [0, 110, 360, 180],
    arms: "shoulder",
    legs: "abs",
    bend: { elbowN: -1, elbowF: -1 },
    props: [{ type: "mat", x: 20, w: 240 }],
    trail: "hip",
    work: ["glute", "thigh"],
    metric: { joint: "hip", label: "Cadera" },
    thumb: 1,
    poses: [
      { sh: [70, 258], torso: -90, head: -90, armN: [83, 7], armF: [83, 7], legN: [212, ANK], legF: [210, ANK] },
      { sh: [70, 258], torso: -118, head: -95, armN: [83, 7], armF: [83, 7], legN: [212, ANK], legF: [210, ANK] },
    ],
    seq: [
      { hold: 0.4, label: "Pies cerca de los glúteos, lumbar neutra" },
      { to: 1, dur: 1.0, ease: "out", label: "Empuja con los talones" },
      { hold: 1.0, label: "Aprieta 1 s: línea de hombros a rodillas" },
      { to: 0, dur: 1.6, label: "Baja vértebra a vértebra" },
      { hold: 0.3, label: "Toca el suelo sin descansar" },
    ],
  },

  kb_swing: {
    view: "side",
    arms: "angles",
    legs: "abs",
    load: { type: "kettlebell", offset: [0, 4] },
    trail: "load",
    work: ["glute", "thigh"],
    metric: { joint: "hip", label: "Cadera" },
    thumb: 1,
    poses: [
      { hip: [140, 162], torso: 62, armN: [-25, -25], armF: [-25, -25], legN: [190, ANK], legF: [188, ANK] },
      { hip: [182, 149], torso: -4, armN: [90, 90], armF: [90, 90], legN: [190, ANK], legF: [188, ANK] },
    ],
    seq: [
      { hold: 0.2, label: "Bisagra: pesa entre los muslos, espalda neutra" },
      { to: 1, dur: 0.55, ease: "out", label: "Explota con la cadera, no con los brazos" },
      { hold: 0.2, label: "Arriba: cuerpo en plancha de pie" },
      { to: 0, dur: 0.75, label: "Deja caer y haz la bisagra en el último momento" },
    ],
  },

  bench_press: {
    view: "side",
    arms: "abs",
    legs: "abs",
    load: { type: "barbell" },
    props: [{ type: "bench", x: 26, y: 230, w: 152 }],
    trail: "load",
    work: ["torso", "upper"],
    metric: { joint: "elbow", label: "Codo" },
    thumb: 1,
    poses: [
      { sh: [80, 218], torso: -90, head: -90, round: -6, armN: [84, 135], armF: [84, 135], legN: [214, ANK], legF: [212, ANK] },
      { sh: [80, 218], torso: -90, head: -90, round: -6, armN: [98, 196], armF: [98, 196], legN: [214, ANK], legF: [212, ANK] },
    ],
    seq: [
      { hold: 0.5, label: "Escápulas juntas y abajo, pies firmes en el suelo" },
      { to: 1, dur: 2.0, label: "Baja a la parte baja del pecho, codos a ~45°" },
      { hold: 0.3, label: "Toca el pecho sin rebotar" },
      { to: 0, dur: 1.1, ease: "out", label: "Empuja hacia arriba y un poco atrás" },
      { hold: 0.4, label: "Bloquea sobre los hombros" },
    ],
    wrong: {
      title: "Glúteos despegados del banco",
      note: "Levantar la cadera para mover más peso estresa la zona lumbar y no cuenta como repetición. Glúteos, cabeza y escápulas siempre apoyados.",
      patch: [{}, { torso: -78, round: -16 }],
    },
  },

  incline_db_press: {
    view: "side",
    arms: "abs",
    legs: "abs",
    load: { type: "dumbbell" },
    props: [{ type: "incline", x: 161, y: 213, angle: -130, len: 106, seat: [180, 214] }],
    trail: "handN",
    work: ["torso", "upper"],
    metric: { joint: "elbow", label: "Codo" },
    thumb: 1,
    poses: [
      { hip: [172, 204], torso: -40, armN: [132, 66], armF: [132, 66], legN: [236, ANK], legF: [234, ANK] },
      { hip: [172, 204], torso: -40, armN: [140, 138], armF: [140, 138], legN: [236, ANK], legF: [234, ANK] },
    ],
    seq: [
      { hold: 0.4, label: "Banco a 30–45°, escápulas atrás" },
      { to: 1, dur: 2.0, label: "Baja a los lados del pecho alto" },
      { hold: 0.3, label: "Estira el pectoral sin perder control" },
      { to: 0, dur: 1.1, ease: "out", label: "Empuja juntando ligeramente las mancuernas" },
      { hold: 0.3, label: "Arriba sin chocar las pesas" },
    ],
  },

  pushup: {
    view: "side",
    arms: "abs",
    legs: "abs",
    work: ["torso", "upper"],
    metric: { joint: "elbow", label: "Codo" },
    thumb: 1,
    poses: [
      { sh: [205.8, 184.4], torso: 70, armN: [210, 266], armF: [210, 266], legN: [31, 248], legF: [31, 248], footN: 75, footF: 75 },
      { sh: [216.7, 238.3], torso: 87, armN: [210, 266], armF: [210, 266], legN: [31, 248], legF: [31, 248], footN: 75, footF: 75 },
    ],
    seq: [
      { hold: 0.4, label: "Manos bajo hombros, cuerpo en línea recta" },
      { to: 1, dur: 1.6, label: "Baja en bloque, codos a 45° del cuerpo" },
      { hold: 0.2, label: "Pecho a un puño del suelo" },
      { to: 0, dur: 0.9, ease: "out", label: "Empuja el suelo lejos de ti" },
      { hold: 0.3, label: "Glúteos y abdomen apretados" },
    ],
    wrong: {
      title: "Cadera hundida",
      note: "Si la cadera cae, la zona lumbar se arquea y pierdes tensión en el core. Aprieta glúteos y piensa en una tabla rígida de cabeza a talones.",
      patch: [{ round: -22 }, { round: -26 }],
    },
  },

  ohp: {
    view: "side",
    vb: [0, -40, 360, 330],
    arms: "shoulder",
    legs: "abs",
    load: { type: "barbell" },
    guide: 186,
    trail: "load",
    work: ["upper"],
    metric: { joint: "elbow", label: "Codo" },
    thumb: 2,
    poses: [
      { hip: [180, 150], torso: -3, head: 0, armN: [16, 2], armF: [16, 2], legN: [184, ANK], legF: [182, ANK] },
      { hip: [180, 150], torso: 0, head: 6, armN: [2, -82], armF: [2, -82], legN: [184, ANK], legF: [182, ANK] },
      { hip: [180, 150], torso: -6, head: -14, armN: [12, -40], armF: [12, -40], legN: [184, ANK], legF: [182, ANK] },
    ],
    seq: [
      { hold: 0.5, label: "Barra en las clavículas, glúteos y abdomen firmes" },
      { to: 2, dur: 0.5, label: "Cabeza atrás para dejar pasar la barra" },
      { to: 1, dur: 0.6, ease: "out", label: "Empuja vertical y mete la cabeza bajo la barra" },
      { hold: 0.5, label: "Bloquea: bíceps junto a las orejas" },
      { to: 2, dur: 0.9, label: "Baja controlado" },
      { to: 0, dur: 0.8, label: "Vuelve a las clavículas" },
    ],
    wrong: {
      title: "Arquear la zona lumbar",
      note: "Echarse atrás convierte el press en un press inclinado y carga la lumbar. Aprieta glúteos, costillas abajo y empuja vertical.",
      patch: [
        { round: -14, torso: -10 },
        { round: -18, torso: -12 },
        { round: -16, torso: -11 },
      ],
    },
  },

  dips: {
    view: "side",
    arms: "abs",
    legs: "hip",
    props: [{ type: "parallel", x1: 140, x2: 244, y: 150 }],
    trail: "shoulder",
    work: ["upper", "torso"],
    metric: { joint: "elbow", label: "Codo" },
    thumb: 1,
    poses: [
      { sh: [192, 68], torso: 8, armN: [196, 150], armF: [196, 150], legN: [-30, 96], legF: [-34, 94] },
      { sh: [200, 110], torso: 26, armN: [196, 150], armF: [196, 150], legN: [-30, 96], legF: [-34, 94] },
    ],
    seq: [
      { hold: 0.4, label: "Brazos bloqueados, hombros lejos de las orejas" },
      { to: 1, dur: 1.8, label: "Baja inclinando el torso, codos atrás" },
      { hold: 0.3, label: "Brazo paralelo al suelo como máximo" },
      { to: 0, dur: 1.0, ease: "out", label: "Empuja las barras hacia abajo" },
      { hold: 0.3, label: "Bloquea sin encoger hombros" },
    ],
  },

  lateral_raise: {
    view: "front",
    vb: [40, 20, 280, 270],
    arms: "angles",
    legs: "abs",
    load: { type: "dumbbell" },
    work: ["upper"],
    metric: { joint: "shoulder", label: "Hombro" },
    thumb: 1,
    poses: [
      { hip: [180, 150], torso: 0, armN: [8, 6], armF: [8, 6], legN: [196, ANK], legF: [164, ANK] },
      { hip: [180, 150], torso: 0, armN: [84, 76], armF: [84, 76], legN: [196, ANK], legF: [164, ANK] },
    ],
    seq: [
      { hold: 0.4, label: "Ligera flexión de codo, hombros abajo" },
      { to: 1, dur: 1.2, label: "Abre los brazos: el codo guía el movimiento" },
      { hold: 0.4, label: "Hasta la altura del hombro, sin encogerte" },
      { to: 0, dur: 2.2, label: "Baja lento resistiendo el peso" },
      { hold: 0.2, label: "No descanses abajo" },
    ],
  },

  triceps_pushdown: {
    view: "side",
    vb: [0, -20, 360, 310],
    arms: "angles",
    legs: "abs",
    load: { type: "cable", anchor: [236, 0] },
    props: [{ type: "pulley", x: 236, y: 0 }],
    work: ["upper"],
    metric: { joint: "elbow", label: "Codo" },
    thumb: 1,
    poses: [
      { hip: [176, 150], torso: 10, armN: [-4, 95], armF: [-4, 95], legN: [186, ANK], legF: [176, ANK] },
      { hip: [176, 150], torso: 10, armN: [-4, 0], armF: [-4, 0], legN: [186, ANK], legF: [176, ANK] },
    ],
    seq: [
      { hold: 0.3, label: "Codos pegados a los costados" },
      { to: 1, dur: 0.9, ease: "out", label: "Extiende hasta bloquear el codo" },
      { hold: 0.5, label: "Aprieta el tríceps abajo" },
      { to: 0, dur: 1.8, label: "Sube controlado sin mover el codo" },
    ],
  },

  pullup: {
    view: "side",
    vb: [40, 0, 280, 300],
    ground: false,
    arms: "abs",
    legs: "hip",
    props: [{ type: "bar", x: 176, y: 30 }],
    trail: "shoulder",
    work: ["upper", "torso"],
    metric: { joint: "elbow", label: "Codo" },
    thumb: 1,
    poses: [
      { sh: [168, 112], torso: -6, armN: [176, 30], armF: [176, 30], legN: [4, 112], legF: [0, 112] },
      { sh: [158, 40], torso: -16, head: -10, armN: [176, 30], armF: [176, 30], legN: [4, 112], legF: [0, 112] },
    ],
    seq: [
      { hold: 0.5, label: "Colgado, escápulas activas (hombros abajo)" },
      { to: 1, dur: 1.1, ease: "out", label: "Tira llevando los codos hacia las costillas" },
      { hold: 0.4, label: "Mentón sobre la barra, pecho hacia ella" },
      { to: 0, dur: 2.0, label: "Baja controlado hasta extender" },
    ],
    wrong: {
      title: "Rango incompleto",
      note: "Medias repeticiones no desarrollan la fuerza completa. Empieza desde brazos extendidos y termina con el mentón sobre la barra; usa una banda si hace falta.",
      patch: [{ sh: [166, 92] }, { sh: [163, 72], torso: -10, head: -6 }],
    },
  },

  lat_pulldown: {
    view: "side",
    vb: [0, -40, 360, 330],
    arms: "abs",
    legs: "abs",
    load: { type: "cable", anchor: [178, -30] },
    props: [
      { type: "pulley", x: 178, y: -30 },
      { type: "box", x: 140, y: 200, w: 56, h: 72 },
      { type: "pad", x: 222, y: 178 },
    ],
    trail: "handN",
    work: ["upper", "torso"],
    metric: { joint: "elbow", label: "Codo" },
    thumb: 1,
    poses: [
      { hip: [172, 190], torso: -6, armN: [176, 38], armF: [176, 38], legN: [230, ANK], legF: [228, ANK] },
      { hip: [172, 190], torso: -14, armN: [182, 114], armF: [182, 114], legN: [230, ANK], legF: [228, ANK] },
    ],
    seq: [
      { hold: 0.4, label: "Muslos bajo el rodillo, agarre algo más ancho que hombros" },
      { to: 1, dur: 1.1, ease: "out", label: "Lleva la barra al pecho alto, codos hacia abajo" },
      { hold: 0.4, label: "Aprieta escápulas abajo y atrás" },
      { to: 0, dur: 2.0, label: "Sube controlado hasta estirar los dorsales" },
    ],
  },

  row_barbell: {
    view: "side",
    arms: "shoulder",
    legs: "abs",
    load: { type: "barbell" },
    trail: "load",
    work: ["upper", "torso"],
    metric: { joint: "elbow", label: "Codo" },
    thumb: 1,
    poses: [
      { hip: [140, 168], torso: 70, armN: [-14, 80], armF: [-14, 80], legN: [186, ANK], legF: [184, ANK] },
      { hip: [140, 168], torso: 70, armN: [-36, 30], armF: [-36, 30], legN: [186, ANK], legF: [184, ANK] },
    ],
    seq: [
      { hold: 0.4, label: "Bisagra a ~45°, espalda neutra, rodillas suaves" },
      { to: 1, dur: 1.0, ease: "out", label: "Tira la barra al ombligo, codos atrás" },
      { hold: 0.4, label: "Junta las escápulas" },
      { to: 0, dur: 1.8, label: "Baja controlado sin perder la bisagra" },
    ],
    wrong: {
      title: "Espalda redondeada",
      note: "Redondear la espalda en la bisagra carga la columna en flexión. Pecho largo, mirada al suelo un metro delante y abdomen firme.",
      patch: [{ round: 16, head: 100 }, { round: 16, head: 100 }],
    },
  },

  row_db: {
    view: "side",
    arms: "abs",
    legs: "abs",
    load: { type: "dumbbell", single: true },
    props: [{ type: "bench", x: 228, y: 212, w: 110 }],
    trail: "handN",
    work: ["upper", "torso"],
    metric: { joint: "elbow", label: "Codo" },
    thumb: 1,
    poses: [
      { hip: [150, 170], torso: 78, armN: [214, 236], armF: [246, 208], legN: [196, ANK], legF: [130, ANK] },
      { hip: [150, 170], torso: 78, armN: [180, 170], armF: [246, 208], legN: [196, ANK], legF: [130, ANK] },
    ],
    seq: [
      { hold: 0.4, label: "Mano libre en el banco, espalda plana" },
      { to: 1, dur: 1.0, ease: "out", label: "Lleva la mancuerna a la cadera" },
      { hold: 0.4, label: "Codo pegado, aprieta el dorsal" },
      { to: 0, dur: 1.8, label: "Baja hasta estirar sin girar el torso" },
    ],
  },

  curl: {
    view: "side",
    arms: "angles",
    legs: "abs",
    load: { type: "dumbbell" },
    work: ["upper"],
    metric: { joint: "elbow", label: "Codo" },
    thumb: 1,
    poses: [
      { ...STAND, armN: [2, 2], armF: [2, 2], legN: [184, ANK], legF: [182, ANK] },
      { ...STAND, armN: [10, 150], armF: [10, 150], legN: [184, ANK], legF: [182, ANK] },
    ],
    seq: [
      { hold: 0.3, label: "Codos a los costados, muñecas neutras" },
      { to: 1, dur: 1.0, ease: "out", label: "Sube sin mover el codo ni balancearte" },
      { hold: 0.4, label: "Aprieta el bíceps arriba" },
      { to: 0, dur: 2.2, label: "Baja en 2–3 s hasta extender" },
    ],
    wrong: {
      title: "Balancear el torso",
      note: "Usar impulso de la espalda quita trabajo al bíceps y carga la lumbar. Baja el peso, glúteos firmes y solo se mueve el antebrazo.",
      patch: [{}, { torso: -14, hip: [186, 150] }],
    },
  },

  plank: {
    view: "side",
    vb: [0, 110, 360, 180],
    arms: "abs",
    legs: "abs",
    props: [{ type: "mat", x: 10, w: 270 }],
    work: ["torso"],
    metric: { joint: "hip", label: "Línea de cadera" },
    thumb: 0,
    poses: [
      { sh: [210, 222], torso: 80, armN: [250, 266], armF: [250, 266], legN: [27, 254], legF: [27, 254], footN: 72, footF: 72 },
      { sh: [210, 221], torso: 80.6, armN: [250, 266], armF: [250, 266], legN: [27, 254], legF: [27, 254], footN: 72, footF: 72 },
    ],
    seq: [
      { to: 1, dur: 2, label: "Codos bajo los hombros, empuja el suelo" },
      { to: 0, dur: 2, label: "Glúteos y abdomen apretados" },
      { to: 1, dur: 2, label: "Línea recta de cabeza a talones" },
      { to: 0, dur: 2, label: "Respira sin perder la posición" },
    ],
    wrong: {
      title: "Cadera hundida",
      note: "Dejar caer la cadera arquea la lumbar y apaga el abdomen. Retroversión pélvica (mete el coxis) y aprieta glúteos.",
      patch: [{ round: -24 }, { round: -24 }],
    },
  },

  dead_bug: {
    view: "side",
    vb: [0, 110, 360, 180],
    arms: "angles",
    legs: "angles",
    props: [{ type: "mat", x: 20, w: 300 }],
    work: ["torso"],
    thumb: 1,
    poses: [
      { sh: [80, 258], torso: -90, armN: [180, 180], armF: [180, 180], legN: [180, 90], legF: [180, 90] },
      { sh: [80, 258], torso: -90, armN: [260, 262], armF: [180, 180], legN: [180, 90], legF: [100, 96] },
      { sh: [80, 258], torso: -90, armN: [180, 180], armF: [260, 262], legN: [100, 96], legF: [180, 90] },
    ],
    seq: [
      { hold: 0.5, label: "Lumbar pegada al suelo, rodillas a 90°" },
      { to: 1, dur: 1.6, label: "Extiende brazo y pierna contrarios" },
      { hold: 0.3, label: "Sin despegar la espalda" },
      { to: 0, dur: 1.2, label: "Vuelve al centro exhalando" },
      { to: 2, dur: 1.6, label: "Cambia de lado" },
      { hold: 0.3, label: "Movimiento lento y controlado" },
      { to: 0, dur: 1.2, label: "Vuelve al centro" },
    ],
  },

  crunch: {
    view: "side",
    vb: [0, 110, 360, 180],
    arms: "shoulder",
    legs: "abs",
    props: [{ type: "mat", x: 20, w: 260 }],
    work: ["torso"],
    thumb: 1,
    poses: [
      { hip: [150, 258], torso: -90, head: -90, armN: [-20, -6], armF: [-20, -6], legN: [212, ANK], legF: [210, ANK] },
      { hip: [150, 258], torso: -64, head: -46, round: 10, armN: [-12, -18], armF: [-12, -18], legN: [212, ANK], legF: [210, ANK] },
    ],
    seq: [
      { hold: 0.3, label: "Rodillas flexionadas, brazos cruzados" },
      { to: 1, dur: 0.9, ease: "out", label: "Enrolla el tronco despegando escápulas" },
      { hold: 0.5, label: "Exhala y aprieta el abdomen" },
      { to: 0, dur: 1.5, label: "Baja controlado" },
    ],
  },

  hanging_leg_raise: {
    view: "side",
    vb: [40, 0, 300, 300],
    ground: false,
    arms: "abs",
    legs: "angles",
    props: [{ type: "bar", x: 176, y: 30 }],
    work: ["torso", "thigh"],
    metric: { joint: "hip", label: "Cadera" },
    thumb: 1,
    poses: [
      { sh: [168, 112], torso: -4, armN: [176, 30], armF: [176, 30], legN: [2, 2], legF: [0, 0] },
      { sh: [168, 112], torso: -12, round: 8, armN: [176, 30], armF: [176, 30], legN: [92, 92], legF: [90, 90] },
    ],
    seq: [
      { hold: 0.4, label: "Colgado con hombros activos, sin balanceo" },
      { to: 1, dur: 1.4, label: "Sube las piernas rectas a 90°" },
      { hold: 0.4, label: "Inclina la pelvis hacia atrás arriba" },
      { to: 0, dur: 2.0, label: "Baja lento sin columpiarte" },
    ],
  },

  burpee: {
    view: "side",
    vb: [0, -50, 360, 340],
    arms: "abs",
    legs: "abs",
    trail: "hip",
    work: ["thigh", "torso"],
    thumb: 2,
    poses: [
      { hip: [180, 150], torso: 0, armN: [184, 160], armF: [182, 160], legN: [184, ANK], legF: [182, ANK] },
      { hip: [160, 228], torso: 48, armN: [216, 262], armF: [216, 262], legN: [184, ANK], legF: [182, ANK] },
      { sh: [212, 180], torso: 70, armN: [216, 262], armF: [216, 262], legN: [37, 244], legF: [37, 244], footN: 75, footF: 75 },
      { hip: [180, 128], torso: 0, armN: [186, -26], armF: [184, -26], legN: [184, 241], legF: [182, 241], footN: 30, footF: 30 },
    ],
    seq: [
      { to: 1, dur: 0.5, label: "Baja en cuclillas, manos al suelo" },
      { to: 2, dur: 0.35, label: "Salta atrás a plancha" },
      { hold: 0.25, label: "Plancha firme, cadera alineada" },
      { to: 1, dur: 0.35, label: "Pies hacia las manos" },
      { to: 3, dur: 0.4, ease: "out", label: "Salta con los brazos arriba" },
      { to: 0, dur: 0.35, label: "Aterriza suave, rodillas flexionadas" },
      { hold: 0.3, label: "Ritmo constante" },
    ],
  },

  mountain_climber: {
    view: "side",
    arms: "abs",
    legs: "abs",
    work: ["thigh", "torso"],
    thumb: 1,
    poses: [
      { sh: [205.8, 184.4], torso: 70, armN: [210, 266], armF: [210, 266], legN: [31, 248], legF: [31, 248], footN: 75, footF: 75 },
      { sh: [205.8, 184.4], torso: 70, armN: [210, 266], armF: [210, 266], legN: [150, 250], legF: [31, 248], footN: 40, footF: 75 },
      { sh: [205.8, 184.4], torso: 70, armN: [210, 266], armF: [210, 266], legN: [31, 248], legF: [150, 250], footN: 75, footF: 40 },
    ],
    seq: [
      { to: 1, dur: 0.3, label: "Rodilla al pecho" },
      { to: 2, dur: 0.3, label: "Cambia de pierna rápido" },
      { to: 1, dur: 0.3, label: "Hombros sobre las manos" },
      { to: 0, dur: 0.3, label: "Cadera baja y estable" },
    ],
  },

  jumping_jack: {
    view: "front",
    vb: [40, -50, 280, 340],
    arms: "angles",
    legs: "abs",
    work: ["thigh", "upper"],
    thumb: 1,
    poses: [
      { hip: [180, 150], torso: 0, armN: [6, 6], armF: [6, 6], legN: [194, ANK], legF: [166, ANK] },
      { hip: [180, 156], torso: 0, armN: [170, 172], armF: [170, 172], legN: [226, ANK], legF: [134, ANK] },
      { hip: [180, 138], torso: 0, armN: [90, 92], armF: [90, 92], legN: [210, 252], legF: [150, 252] },
    ],
    seq: [
      { to: 2, dur: 0.18, label: "Salta abriendo piernas" },
      { to: 1, dur: 0.18, label: "Brazos arriba" },
      { hold: 0.08, label: "Aterriza en el antepié" },
      { to: 2, dur: 0.18, label: "Salta cerrando" },
      { to: 0, dur: 0.18, label: "Brazos abajo" },
      { hold: 0.08, label: "Ritmo constante" },
    ],
  },

  hip_flexor_stretch: {
    view: "side",
    arms: "angles",
    legs: "abs",
    props: [{ type: "mat", x: 50, w: 230 }],
    work: ["thigh"],
    thumb: 1,
    poses: [
      { hip: [160, 206], torso: 0, armN: [0, 0], armF: [30, 60], legN: [236, ANK], legF: [96, 262], footF: 175 },
      { hip: [176, 212], torso: -6, armN: [175, 178], armF: [30, 60], legN: [236, ANK], legF: [96, 262], footF: 175 },
    ],
    seq: [
      { hold: 0.6, label: "Rodilla trasera en el suelo, pelvis neutra" },
      { to: 1, dur: 2.5, label: "Aprieta el glúteo trasero y lleva la cadera adelante" },
      { hold: 3.0, label: "Mantén 30–45 s respirando profundo" },
      { to: 0, dur: 2.0, label: "Vuelve suave y cambia de lado" },
    ],
  },
};

export const DEMO_IDS = Object.keys(DEMOS);
