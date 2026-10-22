import type { Article } from "@/lib/types";

/*
 * Guides written from current consensus (ISSN position stands, ACSM
 * guidelines). They are general education, not medical advice: the
 * detail screen says so.
 */
export const ARTICLES: Article[] = [
  {
    id: "cuanta-proteina",
    title: "¿Cuánta proteína necesitas de verdad?",
    category: "nutricion",
    minutes: 4,
    hue: 352,
    summary: "La cifra que respalda la evidencia para ganar músculo o no perderlo en déficit, y cómo repartirla en el día.",
    body: [
      { p: "Para personas que entrenan fuerza, la evidencia sitúa la ingesta óptima entre 1,6 y 2,2 g de proteína por kilo de peso corporal al día. Por encima de esa cifra el beneficio extra es mínimo." },
      { h: "En déficit, un poco más", p: "Cuando comes menos calorías para perder grasa, apuntar a la parte alta del rango (2,0–2,4 g/kg) ayuda a conservar la masa muscular." },
      { h: "Repártela", p: "Divide la proteína en 3–5 comidas de 20–40 g. Cada toma estimula la síntesis muscular; concentrarlo todo en la cena es menos eficiente." },
      { h: "Fuentes prácticas", p: "Pollo, huevo, pescado, carne magra, lácteos, legumbres, tofu y, si te facilita la vida, proteína en polvo. Un batido no es mejor que la comida: es más cómodo." },
    ],
  },
  {
    id: "creatina",
    title: "Creatina: el suplemento con más evidencia",
    category: "suplementos",
    minutes: 3,
    hue: 214,
    summary: "Qué hace, cuánto tomar y los mitos más comunes.",
    body: [
      { p: "La creatina monohidrato aumenta las reservas de fosfocreatina del músculo, lo que mejora el rendimiento en esfuerzos cortos e intensos y, con el tiempo, la ganancia de fuerza y masa muscular." },
      { h: "Dosis", p: "3–5 g al día, todos los días, a cualquier hora. La fase de carga es opcional: solo acelera la saturación unas semanas." },
      { h: "Mitos", p: "No daña el riñón en personas sanas, no es un esteroide y el aumento de peso inicial es agua dentro del músculo, no grasa." },
      { h: "Consulta", p: "Si tienes una enfermedad renal o tomas medicación, habla antes con tu médico." },
    ],
  },
  {
    id: "deficit-sin-perder-musculo",
    title: "Perder grasa sin perder músculo",
    category: "nutricion",
    minutes: 5,
    hue: 4,
    summary: "Déficit moderado, proteína alta y entrenamiento de fuerza: la tríada que funciona.",
    body: [
      { p: "Un déficit de 300–500 kcal al día suele traducirse en perder entre 0,5 % y 1 % del peso corporal por semana, un ritmo que permite conservar músculo y rendimiento." },
      { h: "Sigue entrenando pesado", p: "El estímulo de la fuerza es la señal que le dice a tu cuerpo que necesita conservar el músculo. No cambies a solo cardio." },
      { h: "Mide tendencias, no días", p: "El peso fluctúa por agua, sal y carbohidratos. MyGym Community usa la media móvil de 7 días para ajustar tus calorías, igual que las mejores apps de nutrición adaptativa." },
      { h: "Descansos de dieta", p: "Tras 8–12 semanas en déficit, una o dos semanas en mantenimiento ayudan a la adherencia y al rendimiento." },
    ],
  },
  {
    id: "antes-despues-entrenar",
    title: "Qué comer antes y después de entrenar",
    category: "nutricion",
    minutes: 3,
    hue: 40,
    summary: "Timing práctico sin obsesionarse con la \"ventana anabólica\".",
    body: [
      { h: "Antes (1–3 h)", p: "Una comida con carbohidratos y algo de proteína, baja en grasa y fibra para que no pese: arepa con huevo, avena con yogur, arroz con pollo." },
      { h: "Si entrenas en ayunas", p: "Un banano o un café pueden bastar para sesiones cortas; para sesiones largas o pesadas rinde mejor comer algo." },
      { h: "Después", p: "Proteína (20–40 g) y carbohidratos en las 2 horas siguientes. Lo que importa de verdad es el total del día." },
    ],
  },
  {
    id: "hidratacion",
    title: "Hidratación para rendir",
    category: "nutricion",
    minutes: 2,
    hue: 200,
    summary: "Cuánta agua tomar y cuándo vale la pena una bebida isotónica.",
    body: [
      { p: "Una referencia práctica es 30–35 ml de agua por kilo de peso al día, más unos 500–750 ml por cada hora de entrenamiento." },
      { h: "Señales", p: "Orina clara y pocas ganas de beber son buena señal. La sed fuerte o la orina oscura indican que vas atrasado." },
      { h: "Electrolitos", p: "Para sesiones de más de 60–90 minutos o con mucho calor, una bebida con sodio ayuda a reponer lo que pierdes en el sudor." },
    ],
  },
  {
    id: "sobrecarga-progresiva",
    title: "Sobrecarga progresiva: cómo seguir avanzando",
    category: "entrenamiento",
    minutes: 4,
    hue: 28,
    summary: "La regla número uno del entrenamiento y cómo te ayuda la app a aplicarla.",
    body: [
      { p: "Para que el cuerpo siga adaptándose, el estímulo debe aumentar con el tiempo: más peso, más repeticiones, más series o mejor técnica." },
      { h: "Doble progresión", p: "Elige un rango (por ejemplo 8–10). Cuando completes todas las series con 10 repeticiones limpias, sube el peso un 2,5–5 % y vuelve a 8." },
      { h: "RIR", p: "Deja 1–3 repeticiones en reserva en la mayoría de las series. Llegar al fallo en todo aumenta la fatiga más que el resultado." },
      { h: "En la app", p: "El registro te muestra lo que hiciste la última vez y calcula tu 1RM estimado con la fórmula de Epley para detectar récords personales." },
    ],
  },
  {
    id: "sueno-recuperacion",
    title: "Dormir para crecer",
    category: "recuperacion",
    minutes: 3,
    hue: 260,
    summary: "El suplemento gratuito que la mayoría ignora.",
    body: [
      { p: "Dormir 7–9 horas mejora la recuperación, la fuerza, el control del apetito y la composición corporal. Dormir poco en déficit aumenta la pérdida de músculo." },
      { h: "Hábitos", p: "Horario regular, habitación oscura y fresca, cafeína solo hasta 8 horas antes de dormir y pantallas fuera de la cama." },
      { h: "Mapa de recuperación", p: "El mapa muscular de la app estima cuánto ha descansado cada grupo según tus entrenamientos: úsalo para decidir qué entrenar hoy." },
    ],
  },
];

export const ARTICLE_BY_ID = Object.fromEntries(ARTICLES.map(a => [a.id, a])) as Record<string, Article>;
