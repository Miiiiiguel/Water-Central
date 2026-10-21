/*
 * Tienda: one-time purchases on top of the Pro/Elite plans. Prices must
 * match PRODUCTS in supabase/functions/checkout/index.ts, which is what
 * actually gets charged.
 */

export type ShopCategory = "coaching" | "programas" | "nutricion" | "clases" | "retos" | "regalos" | "propinas";

export interface Product {
  id: string;
  name: string;
  category: ShopCategory;
  COP: number;
  USD: number;
  tagline: string;
  includes: string[];
  hue: number;
  badge?: string;
  /** Program this purchase unlocks for accounts without Pro. */
  unlocksProgram?: string;
  hidden?: boolean;
}

export const SHOP_CATEGORY_LABEL: Record<ShopCategory, string> = {
  coaching: "Coaching",
  programas: "Programas",
  nutricion: "Nutrición",
  clases: "Clases privadas",
  retos: "Retos",
  regalos: "Regalos",
  propinas: "Propinas",
};

export const PRODUCTS: Product[] = [
  {
    id: "revision-tecnica-3",
    name: "3 revisiones de técnica",
    category: "coaching",
    COP: 59_900,
    USD: 15.99,
    tagline: "Envía tu video y un coach te corrige en 48 h",
    includes: ["3 videos revisados por un coach certificado", "Correcciones escritas y en audio", "Ejercicios correctivos para tu caso"],
    hue: 214,
    badge: "Más vendido",
  },
  {
    id: "sesion-1a1",
    name: "Sesión 1:1 con coach",
    category: "coaching",
    COP: 99_900,
    USD: 25.99,
    tagline: "45 minutos por videollamada, solo para ti",
    includes: ["Evaluación de objetivos y movilidad", "Ajuste de tu programa", "Plan de acción por escrito"],
    hue: 352,
  },
  {
    id: "plan-nutricional",
    name: "Plan de alimentación personalizado",
    category: "nutricion",
    COP: 149_900,
    USD: 39.99,
    tagline: "Diseñado por nuestra nutricionista para tu objetivo",
    includes: ["Menú de 4 semanas con comida latina", "Lista de mercado", "2 ajustes según tu progreso"],
    hue: 130,
    badge: "Nuevo",
  },
  {
    id: "programa-gluteos",
    name: "Programa Glúteos de acero",
    category: "programas",
    COP: 89_900,
    USD: 22.99,
    tagline: "8 semanas, tuyo para siempre, sin suscripción",
    includes: ["32 sesiones guiadas", "Videos de técnica de cada ejercicio", "Progresión semana a semana"],
    hue: 330,
    unlocksProgram: "gluteos-de-acero",
  },
  {
    id: "programa-hipertrofia",
    name: "Programa Hipertrofia Torso / Pierna",
    category: "programas",
    COP: 89_900,
    USD: 22.99,
    tagline: "8 semanas para ganar músculo, pago único",
    includes: ["4 días por semana", "Sobrecarga progresiva automática", "Semanas de descarga incluidas"],
    hue: 4,
    unlocksProgram: "hipertrofia-tren-superior-inferior",
  },
  {
    id: "programa-fuerza",
    name: "Programa Fuerza 5×5",
    category: "programas",
    COP: 79_900,
    USD: 19.99,
    tagline: "12 semanas para levantar más, pago único",
    includes: ["3 días por semana", "Progresión lineal", "Calculadora de 1RM"],
    hue: 28,
    unlocksProgram: "fuerza-5x5",
  },
  {
    id: "clases-privadas-4",
    name: "4 clases privadas en vivo",
    category: "clases",
    COP: 349_900,
    USD: 89.99,
    tagline: "Tú y tu coach, en el horario que elijas",
    includes: ["4 sesiones de 45 min por video", "Rutina adaptada a tu espacio", "Válidas por 60 días"],
    hue: 18,
  },
  {
    id: "reto-21",
    name: "Reto 21 días guiado",
    category: "retos",
    COP: 39_900,
    USD: 9.99,
    tagline: "Entreno + comidas día a día durante 3 semanas",
    includes: ["21 entrenos cortos", "Menú diario", "Insignia y certificado al terminar"],
    hue: 280,
  },
  {
    id: "regalo-pro-3m",
    name: "Tarjeta regalo Pro · 3 meses",
    category: "regalos",
    COP: 139_900,
    USD: 34.99,
    tagline: "Regala American Fit Pro a quien quieras",
    includes: ["Código canjeable de 3 meses de Pro", "Llega a tu correo para reenviarlo", "Sin fecha de vencimiento para canjear"],
    hue: 48,
  },
  {
    id: "regalo-pro-12m",
    name: "Tarjeta regalo Pro · 12 meses",
    category: "regalos",
    COP: 399_900,
    USD: 99.99,
    tagline: "Un año completo de entrenamiento para regalar",
    includes: ["Código canjeable de 12 meses de Pro", "Llega a tu correo para reenviarlo", "Sin fecha de vencimiento para canjear"],
    hue: 40,
  },
  { id: "propina-5", name: "Propina para el coach", category: "propinas", COP: 5_000, USD: 1.49, tagline: "Gracias por la clase", includes: ["100 % para el coach"], hue: 18, hidden: true },
  { id: "propina-10", name: "Propina para el coach", category: "propinas", COP: 10_000, USD: 2.99, tagline: "Gracias por la clase", includes: ["100 % para el coach"], hue: 18, hidden: true },
  { id: "propina-20", name: "Propina para el coach", category: "propinas", COP: 20_000, USD: 5.49, tagline: "Gracias por la clase", includes: ["100 % para el coach"], hue: 18, hidden: true },
];

export const PRODUCT_BY_ID = Object.fromEntries(PRODUCTS.map(p => [p.id, p])) as Record<string, Product>;

export const PROGRAM_PRODUCT = Object.fromEntries(PRODUCTS.filter(p => p.unlocksProgram).map(p => [p.unlocksProgram!, p])) as Record<string, Product>;
