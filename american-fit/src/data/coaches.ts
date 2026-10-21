import type { Coach } from "@/lib/types";

/*
 * Placeholder coach roster. Replace names, bios and handles with the real
 * American Fit coaches before launch; ids are what everything else links
 * to, so keep them stable.
 */
export const COACHES: Coach[] = [
  {
    id: "valentina",
    name: "Valentina Ríos",
    role: "Head coach · Fuerza e hipertrofia",
    specialties: ["Hipertrofia", "Técnica de barra", "Glúteos"],
    bio: "Entrenadora certificada en fuerza y acondicionamiento. Diseña los programas de hipertrofia de American Fit y graba la serie de técnica de los básicos.",
    hue: 352,
    rating: 4.9,
    classes: 214,
  },
  {
    id: "marcus",
    name: "Marcus Cole",
    role: "HIIT y acondicionamiento",
    specialties: ["HIIT", "Cardio", "Atletismo"],
    bio: "Ex atleta universitario de velocidad. Sus clases en vivo son cortas, intensas y medibles: sales sabiendo exactamente cuánto diste.",
    hue: 214,
    rating: 4.8,
    classes: 302,
  },
  {
    id: "camila",
    name: "Camila Ortega",
    role: "Yoga y movilidad",
    specialties: ["Yoga", "Movilidad", "Respiración"],
    bio: "Profesora de yoga y fisioterapeuta. Se enfoca en que te muevas mejor para entrenar más años sin lesiones.",
    hue: 160,
    rating: 4.9,
    classes: 187,
  },
  {
    id: "andres",
    name: "Andrés Gómez",
    role: "Powerlifting y técnica",
    specialties: ["Sentadilla", "Peso muerto", "Press de banca"],
    bio: "Competidor de powerlifting. Si quieres aprender a levantar pesado y seguro, sus correcciones de técnica son las más detalladas.",
    hue: 28,
    rating: 4.9,
    classes: 128,
  },
  {
    id: "jasmine",
    name: "Jasmine Brooks",
    role: "Dance cardio y core",
    specialties: ["Baile", "Core", "Cardio"],
    bio: "Bailarina profesional. Clases con música, energía y mucho abdomen.",
    hue: 300,
    rating: 4.8,
    classes: 156,
  },
  {
    id: "diego",
    name: "Diego Herrera",
    role: "Boxeo fitness",
    specialties: ["Boxeo", "Coordinación", "Resistencia"],
    bio: "Entrenador de boxeo amateur. Técnica de golpeo real sin contacto y un cardio brutal.",
    hue: 4,
    rating: 4.7,
    classes: 98,
  },
  {
    id: "laura",
    name: "Dra. Laura Méndez",
    role: "Nutricionista deportiva",
    specialties: ["Nutrición", "Composición corporal", "Suplementación"],
    bio: "Nutricionista dietista con especialización en deporte. Responde dudas en vivo cada semana y diseña los planes de alimentación.",
    hue: 130,
    rating: 5,
    classes: 64,
  },
];

export const COACH_BY_ID = Object.fromEntries(COACHES.map(c => [c.id, c])) as Record<string, Coach>;
