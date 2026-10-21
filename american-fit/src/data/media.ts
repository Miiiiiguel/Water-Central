import type { Challenge, ClassCategory, LiveClass, VideoClass, VideoSeries } from "@/lib/types";

/*
 * Live schedule and on-demand catalog.
 *
 * Nothing here is recorded yet. When a class is streamed, put its HLS
 * playback URL in `streamUrl`; when a video is recorded and uploaded, put
 * its URL in `video.src`. Every screen already handles both states, so
 * no UI change is needed — see README.md → "Videos reales y en vivo".
 */

export const CATEGORY_LABEL: Record<ClassCategory, string> = {
  fuerza: "Fuerza",
  hiit: "HIIT",
  cardio: "Cardio",
  yoga: "Yoga",
  movilidad: "Movilidad",
  core: "Core",
  baile: "Baile",
  boxeo: "Boxeo",
  nutricion: "Nutrición",
};

export const CATEGORY_HUE: Record<ClassCategory, number> = {
  fuerza: 352,
  hiit: 18,
  cardio: 214,
  yoga: 160,
  movilidad: 180,
  core: 280,
  baile: 310,
  boxeo: 4,
  nutricion: 120,
};

const h = (hh: number, mm = 0) => hh * 60 + mm;
const WEEKDAYS = [1, 2, 3, 4, 5];

export const LIVE_CLASSES: LiveClass[] = [
  { id: "despierta-hiit", title: "Despierta HIIT", coachId: "marcus", category: "hiit", level: "intermedio", durationMin: 25, weekdays: WEEKDAYS, startMin: h(6, 30), equipment: ["bodyweight"], kcal: 280, description: "Intervalos cortos para activar el cuerpo antes del trabajo. Sin material, con marcador de esfuerzo en vivo." },
  { id: "fuerza-total", title: "Fuerza total con mancuernas", coachId: "valentina", category: "fuerza", level: "intermedio", durationMin: 45, weekdays: [1, 3, 5], startMin: h(12, 15), equipment: ["dumbbell"], kcal: 330, description: "Cuerpo completo con mancuernas, técnica corregida en tiempo real y progresión semanal." },
  { id: "yoga-mediodia", title: "Yoga de mediodía", coachId: "camila", category: "yoga", level: "principiante", durationMin: 30, weekdays: [2, 4], startMin: h(12, 30), equipment: ["bodyweight"], kcal: 120, description: "Flujo suave para descomprimir la espalda y volver al trabajo con energía." },
  { id: "tecnica-basicos", title: "Clínica de técnica: los básicos", coachId: "andres", category: "fuerza", level: "principiante", durationMin: 40, weekdays: [2], startMin: h(19, 0), equipment: ["barbell"], kcal: 180, description: "Sentadilla, peso muerto y banca explicados paso a paso. Envía tu video en el chat y lo corregimos en vivo." },
  { id: "gluteos-live", title: "Glúteos en vivo", coachId: "valentina", category: "fuerza", level: "intermedio", durationMin: 40, weekdays: [2, 4], startMin: h(18, 30), equipment: ["dumbbell", "band"], kcal: 300, description: "Hip thrust, bisagras y trabajo con banda para un glúteo fuerte." },
  { id: "dance-cardio", title: "Dance cardio", coachId: "jasmine", category: "baile", level: "principiante", durationMin: 35, weekdays: [1, 3], startMin: h(19, 30), equipment: ["bodyweight"], kcal: 340, description: "Coreografías fáciles de seguir y sudor garantizado." },
  { id: "box-fit", title: "Box fit", coachId: "diego", category: "boxeo", level: "intermedio", durationMin: 40, weekdays: [1, 4], startMin: h(20, 0), equipment: ["bodyweight"], kcal: 420, description: "Combinaciones de boxeo sin contacto, rounds de 3 minutos y core." },
  { id: "core-15", title: "Core exprés 15'", coachId: "jasmine", category: "core", level: "principiante", durationMin: 15, weekdays: WEEKDAYS, startMin: h(21, 0), equipment: ["bodyweight"], kcal: 90, description: "15 minutos de abdomen para cerrar el día." },
  { id: "movilidad-noche", title: "Movilidad antes de dormir", coachId: "camila", category: "movilidad", level: "principiante", durationMin: 20, weekdays: [0, 1, 2, 3, 4, 5, 6], startMin: h(21, 30), equipment: ["bodyweight"], kcal: 60, description: "Estiramientos y respiración para dormir mejor." },
  { id: "pregunta-nutri", title: "Pregúntale a la nutricionista", coachId: "laura", category: "nutricion", level: "principiante", durationMin: 30, weekdays: [3], startMin: h(20, 0), equipment: [], kcal: 0, description: "Sesión de preguntas en vivo sobre alimentación, suplementos y planes." },
  { id: "sabado-sweat", title: "Sábado Sweat", coachId: "marcus", category: "hiit", level: "avanzado", durationMin: 45, weekdays: [6], startMin: h(9, 0), equipment: ["dumbbell", "kettlebell"], kcal: 520, description: "La clase más dura de la semana. Ranking en vivo y retos por equipos." },
  { id: "domingo-yoga", title: "Yoga restaurativo", coachId: "camila", category: "yoga", level: "principiante", durationMin: 45, weekdays: [0], startMin: h(10, 0), equipment: ["bodyweight"], kcal: 140, description: "Posturas sostenidas para recuperar después de la semana." },
];

export const LIVE_BY_ID = Object.fromEntries(LIVE_CLASSES.map(c => [c.id, c])) as Record<string, LiveClass>;

export const SERIES: VideoSeries[] = [
  { id: "tecnica", title: "Técnica perfecta", subtitle: "Los básicos explicados por expertos", hue: 352 },
  { id: "hiit20", title: "HIIT 20", subtitle: "20 minutos, cero excusas", hue: 18 },
  { id: "yoga", title: "Yoga y movilidad", subtitle: "Muévete mejor, entrena más años", hue: 160 },
  { id: "gluteos", title: "Programa glúteos", subtitle: "8 semanas con Valentina", hue: 330 },
  { id: "cocina", title: "Cocina fit", subtitle: "Recetas con la Dra. Laura", hue: 120 },
];

const v = (
  id: string,
  title: string,
  coachId: string,
  category: ClassCategory,
  level: VideoClass["level"],
  durationMin: number,
  kcal: number,
  description: string,
  extra: Partial<VideoClass> = {}
): VideoClass => ({
  id,
  title,
  coachId,
  category,
  level,
  durationMin,
  kcal,
  description,
  equipment: ["bodyweight"],
  video: {},
  ...extra,
});

export const VIDEOS: VideoClass[] = [
  v("tec-sentadilla", "La sentadilla perfecta", "andres", "fuerza", "principiante", 12, 40, "Postura, profundidad, respiración y los 4 errores más comunes, con correcciones en cámara lenta.", { seriesId: "tecnica", episode: 1, equipment: ["barbell"], isNew: true, chapters: [{ at: 0, title: "Postura inicial" }, { at: 150, title: "Bracing" }, { at: 300, title: "Profundidad" }, { at: 480, title: "Errores comunes" }] }),
  v("tec-peso-muerto", "Peso muerto sin miedo", "andres", "fuerza", "intermedio", 14, 40, "Setup en 5 pasos, cómo tensar la barra y cómo proteger la espalda.", { seriesId: "tecnica", episode: 2, equipment: ["barbell"] }),
  v("tec-banca", "Press de banca: arco, escápulas y codos", "andres", "fuerza", "intermedio", 11, 35, "Todo lo que necesitas para un press de banca fuerte y sano para el hombro.", { seriesId: "tecnica", episode: 3, equipment: ["barbell", "bench"] }),
  v("tec-dominadas", "De cero a tu primera dominada", "valentina", "fuerza", "principiante", 10, 45, "Progresión completa: colgarse, escápulas, negativas y bandas.", { seriesId: "tecnica", episode: 4, equipment: ["pullupBar", "band"] }),
  v("tec-hip-thrust", "Hip thrust: activa de verdad el glúteo", "valentina", "fuerza", "principiante", 9, 30, "Posición del banco, pies y pelvis para sentirlo donde debe.", { seriesId: "tecnica", episode: 5, equipment: ["barbell", "bench"] }),
  v("hiit-1", "HIIT 20 · Cuerpo completo", "marcus", "hiit", "intermedio", 20, 260, "Cuatro bloques de 4 minutos con 40/20 de trabajo-descanso.", { seriesId: "hiit20", episode: 1, isNew: true }),
  v("hiit-2", "HIIT 20 · Piernas que arden", "marcus", "hiit", "intermedio", 20, 280, "Sentadillas, zancadas y saltos en intervalos.", { seriesId: "hiit20", episode: 2 }),
  v("hiit-3", "HIIT 20 · Sin saltos", "marcus", "hiit", "principiante", 20, 200, "Bajo impacto, alta intensidad: perfecto para apartamentos.", { seriesId: "hiit20", episode: 3 }),
  v("yoga-1", "Yoga para levantadores", "camila", "yoga", "principiante", 25, 90, "Cadera, tobillos y columna torácica para sentadillas más profundas.", { seriesId: "yoga", episode: 1 }),
  v("yoga-2", "Movilidad de hombro en 15'", "camila", "movilidad", "principiante", 15, 50, "Rutina diaria para hombros que suben sin dolor.", { seriesId: "yoga", episode: 2 }),
  v("yoga-3", "Respiración y recuperación", "camila", "yoga", "principiante", 12, 30, "Técnicas de respiración para bajar pulsaciones y dormir mejor.", { seriesId: "yoga", episode: 3 }),
  v("gluteos-1", "Glúteos · Semana 1", "valentina", "fuerza", "intermedio", 40, 300, "Primera sesión del programa: patrón de bisagra y hip thrust.", { seriesId: "gluteos", episode: 1, equipment: ["dumbbell", "band"] }),
  v("gluteos-2", "Glúteos · Semana 2", "valentina", "fuerza", "intermedio", 42, 320, "Unilateral y trabajo con banda.", { seriesId: "gluteos", episode: 2, equipment: ["dumbbell", "band"] }),
  v("cocina-1", "Meal prep del domingo", "laura", "nutricion", "principiante", 18, 0, "Cocina 5 almuerzos altos en proteína en una hora.", { seriesId: "cocina", episode: 1, isNew: true }),
  v("cocina-2", "Desayunos latinos fit", "laura", "nutricion", "principiante", 14, 0, "Arepas, calentado y pancakes ajustados a tus macros.", { seriesId: "cocina", episode: 2 }),
  v("box-1", "Box fit · Fundamentos", "diego", "boxeo", "principiante", 30, 360, "Guardia, jab, cross y desplazamientos.", {}),
  v("dance-1", "Dance cardio · Latino", "jasmine", "baile", "principiante", 30, 320, "Salsa, reguetón y cumbia para sudar sin darte cuenta.", {}),
  v("replay-sabado", "Repetición: Sábado Sweat", "marcus", "hiit", "avanzado", 45, 520, "La clase en vivo del sábado pasado, con el ranking de los mejores.", { isReplay: true, equipment: ["dumbbell", "kettlebell"] }),
  v("replay-tecnica", "Repetición: Clínica de técnica", "andres", "fuerza", "principiante", 40, 180, "Correcciones en vivo de los videos enviados por la comunidad.", { isReplay: true, equipment: ["barbell"] }),
];

export const VIDEO_BY_ID = Object.fromEntries(VIDEOS.map(x => [x.id, x])) as Record<string, VideoClass>;

export const CHALLENGES: Challenge[] = [
  { id: "plancha-30", title: "30 días de plancha", description: "Empieza con 20 segundos y suma 5 cada día.", days: 30, metric: "segundos", participants: 4210, hue: 280, reward: "Insignia Core de Acero" },
  { id: "volumen-10k", title: "10.000 kg en un mes", description: "Suma volumen total (series × reps × peso) en tus entrenamientos.", days: 30, metric: "kg", participants: 2875, hue: 352, reward: "Insignia Titán" },
  { id: "sin-azucar-21", title: "21 días sin azúcar añadida", description: "Registra tus comidas y evita bebidas y dulces con azúcar añadida.", days: 21, metric: "días", participants: 6120, hue: 120, reward: "Insignia Disciplina" },
  { id: "live-12", title: "12 clases en vivo", description: "Únete a 12 clases en vivo este mes.", days: 30, metric: "clases", participants: 1980, hue: 18, reward: "1 mes Elite gratis" },
];

/** Next start time for a live class at or after `from`. */
export function nextOccurrence(c: LiveClass, from: Date = new Date()): Date {
  for (let i = 0; i < 8; i++) {
    const d = new Date(from);
    d.setDate(d.getDate() + i);
    if (!c.weekdays.includes(d.getDay())) continue;
    d.setHours(Math.floor(c.startMin / 60), c.startMin % 60, 0, 0);
    const end = new Date(d.getTime() + c.durationMin * 60_000);
    if (end > from) return d;
  }
  return from;
}

export function isLiveNow(c: LiveClass, now: Date = new Date()) {
  const start = nextOccurrence(c, now);
  return start <= now && now.getTime() < start.getTime() + c.durationMin * 60_000;
}

/** Classes occurring on a given calendar day, sorted by start time. */
export function classesOn(day: Date) {
  return LIVE_CLASSES.filter(c => c.weekdays.includes(day.getDay())).sort((a, b) => a.startMin - b.startMin);
}
