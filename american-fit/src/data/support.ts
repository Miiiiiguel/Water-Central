/*
 * Help center content and the assistant's knowledge. The assistant
 * answers from these entries instantly, any hour; anything it can't
 * answer becomes a ticket for the human team.
 */

export type SupportCategory = "pagos" | "cuenta" | "entrenamiento" | "nutricion" | "live" | "tecnica" | "app";

export const SUPPORT_CATEGORY_LABEL: Record<SupportCategory, string> = {
  pagos: "Pagos y planes",
  cuenta: "Cuenta y acceso",
  entrenamiento: "Entrenamiento",
  nutricion: "Nutrición",
  live: "Clases en vivo y videos",
  tecnica: "Técnica y lesiones",
  app: "La app",
};

export interface Faq {
  id: string;
  category: SupportCategory;
  q: string;
  a: string;
  keywords: string[];
  action?: { label: string; href: string };
}

export const FAQS: Faq[] = [
  {
    id: "metodos-pago",
    category: "pagos",
    q: "¿Cómo puedo pagar?",
    a: "En Colombia pagas en pesos con Wompi: PSE, Nequi, Bancolombia o tarjeta débito/crédito. Desde cualquier país puedes pagar en dólares con tarjeta internacional, Apple Pay o Google Pay a través de Stripe.",
    keywords: ["pagar", "pago", "pse", "nequi", "tarjeta", "bancolombia", "metodo", "medio", "wompi", "stripe", "dolares", "pesos"],
    action: { label: "Ver planes", href: "/planes" },
  },
  {
    id: "pago-rechazado",
    category: "pagos",
    q: "Mi pago fue rechazado o quedó pendiente",
    a: "Si fue rechazado no se hizo ningún cobro: intenta con otro método o revisa el cupo de tu tarjeta. Con PSE la confirmación del banco puede tardar unos minutos; tu plan se activa solo cuando llega. Si después de 30 minutos sigue pendiente, crea un ticket con la referencia del pago y lo revisamos.",
    keywords: ["rechazado", "rechazo", "pendiente", "fallo", "error", "no paso", "declinado", "cobro", "no se activo", "activa"],
    action: { label: "Ver mis pagos", href: "/historial" },
  },
  {
    id: "cancelar",
    category: "pagos",
    q: "¿Cómo cancelo mi plan?",
    a: "Ve a Perfil → Suscripción y pagos → Cancelar. Mantienes todos los beneficios hasta el final del periodo que ya pagaste y no se hacen más cobros.",
    keywords: ["cancelar", "cancelo", "baja", "dar de baja", "suscripcion", "renovacion", "no quiero", "quitar plan"],
    action: { label: "Ir a mi perfil", href: "/perfil" },
  },
  {
    id: "reembolso",
    category: "pagos",
    q: "¿Puedo pedir un reembolso?",
    a: "Sí. Si pagaste por error o la app no funcionó como esperabas, crea un ticket en la categoría Pagos con la referencia del pago dentro de los 7 días siguientes y lo revisamos.",
    keywords: ["reembolso", "devolucion", "devolver", "dinero", "plata", "cobro doble", "doble cobro", "error de cobro"],
  },
  {
    id: "factura",
    category: "pagos",
    q: "Necesito factura",
    a: "Las pasarelas te envían el comprobante al correo. Si necesitas factura electrónica con tus datos (NIT o cédula), crea un ticket en Pagos con la referencia y tus datos de facturación.",
    keywords: ["factura", "facturacion", "comprobante", "recibo", "nit", "cedula"],
  },
  {
    id: "diferencias-planes",
    category: "pagos",
    q: "¿Qué incluye cada plan?",
    a: "Free: técnica, registro de entrenos y nutrición, y 1 clase en vivo por semana. Pro: clases en vivo ilimitadas, todos los programas y videos, entreno inteligente y coach de calorías. Elite: todo lo de Pro más revisión de técnica por video, plan de nutrición personalizado y chat con tu coach.",
    keywords: ["plan", "planes", "pro", "elite", "free", "gratis", "incluye", "diferencia", "precio", "cuanto cuesta", "costo"],
    action: { label: "Comparar planes", href: "/planes" },
  },
  {
    id: "olvide-clave",
    category: "cuenta",
    q: "Olvidé mi contraseña",
    a: "En la pantalla de inicio de sesión toca “¿Olvidaste tu contraseña?” y te enviaremos un enlace para crear una nueva. Si entraste con Google, usa de nuevo “Continuar con Google”.",
    keywords: ["contrasena", "clave", "olvide", "olvido", "password", "recuperar", "no puedo entrar", "acceso", "login", "iniciar sesion"],
  },
  {
    id: "cambiar-dispositivo",
    category: "cuenta",
    q: "¿Mi historial se pasa a otro teléfono?",
    a: "Sí, al iniciar sesión con la misma cuenta tus entrenos, comidas, peso y pagos se sincronizan en la nube y aparecen en cualquier dispositivo.",
    keywords: ["otro telefono", "celular nuevo", "dispositivo", "sincronizar", "historial", "perdi", "datos", "computador"],
    action: { label: "Ver mi historial", href: "/historial" },
  },
  {
    id: "borrar-cuenta",
    category: "cuenta",
    q: "Quiero borrar mi cuenta o mis datos",
    a: "Desde Perfil → Datos puedes exportar todo en un archivo o empezar de cero. Para eliminar la cuenta por completo de nuestros servidores, crea un ticket en Cuenta y la eliminamos.",
    keywords: ["borrar", "eliminar", "cuenta", "datos", "privacidad", "exportar"],
    action: { label: "Ir a Perfil", href: "/perfil" },
  },
  {
    id: "empezar",
    category: "entrenamiento",
    q: "Soy principiante, ¿por dónde empiezo?",
    a: "Empieza con el programa Fundamentos: 3 días por semana, 45 minutos, y cada ejercicio trae su demostración animada. Si entrenas en casa, prueba Quema en casa.",
    keywords: ["principiante", "empezar", "empiezo", "nuevo", "comenzar", "primera vez", "rutina", "que hago"],
    action: { label: "Ver programas", href: "/entrenar" },
  },
  {
    id: "cuanto-peso",
    category: "entrenamiento",
    q: "¿Cuánto peso debo usar?",
    a: "Elige un peso con el que completes todas las series dejando 1–3 repeticiones en reserva. Cuando hagas el tope del rango en todas las series con buena técnica, sube un 2,5–5 %. El registro te muestra lo que hiciste la última vez.",
    keywords: ["peso", "cuanto peso", "kilos", "carga", "subir peso", "progresion", "repeticiones"],
  },
  {
    id: "dolor",
    category: "tecnica",
    q: "Siento dolor al hacer un ejercicio",
    a: "Detente. Un dolor punzante o en la articulación no es normal. Revisa la sección “Errores comunes” y la demo de ese ejercicio, prueba la variante más fácil y, si el dolor sigue, consulta a un profesional de la salud. Con Elite un coach puede revisar tu técnica por video.",
    keywords: ["dolor", "duele", "lesion", "rodilla", "espalda", "hombro", "molestia", "lumbar"],
    action: { label: "Biblioteca de técnica", href: "/tecnica" },
  },
  {
    id: "revisar-tecnica",
    category: "tecnica",
    q: "¿Pueden revisar mi técnica?",
    a: "Sí. En cada ejercicio usa “Compárate” para verte junto a la demo. Para que un coach te corrija, compra un pack de revisiones en la Tienda o hazte Elite.",
    keywords: ["revisar", "corregir", "tecnica", "video", "coach", "forma", "postura"],
    action: { label: "Ir a la Tienda", href: "/tienda" },
  },
  {
    id: "calorias",
    category: "nutricion",
    q: "¿Cómo se calculan mis calorías?",
    a: "Usamos la fórmula Mifflin–St Jeor con tu peso, estatura, edad y actividad, y la ajustamos a tu objetivo. Si registras comidas y peso dos semanas, el coach adaptativo calcula tu gasto real con tus datos.",
    keywords: ["calorias", "kcal", "macros", "proteina", "deficit", "cuanto comer", "dieta"],
    action: { label: "Ir a Nutrición", href: "/nutricion" },
  },
  {
    id: "registrar-comida",
    category: "nutricion",
    q: "¿Cómo registro una comida?",
    a: "En Nutrición toca el + de la comida del día, busca el alimento (hay más de 80 alimentos latinos y americanos), escanea el código de barras o usa el registro rápido con calorías y macros.",
    keywords: ["registrar", "comida", "alimento", "anotar", "codigo de barras", "escanear", "diario"],
    action: { label: "Registrar comida", href: "/nutricion" },
  },
  {
    id: "clase-en-vivo",
    category: "live",
    q: "¿Cómo me uno a una clase en vivo?",
    a: "Ve a Live, elige la clase en la agenda y toca Reservar para recibir el aviso. Cuando empiece, toca Unirme. Si te la perdiste, búscala en Repeticiones.",
    keywords: ["clase", "en vivo", "live", "unirme", "reservar", "agenda", "horario", "directo"],
    action: { label: "Ver agenda", href: "/live" },
  },
  {
    id: "video-no-carga",
    category: "app",
    q: "Un video no carga",
    a: "Los videos que dicen “Grabación en producción” aún se están grabando: activa “Avísame” y te notificamos el estreno. Si un video publicado no carga, revisa tu conexión y vuelve a abrirlo; si sigue fallando, crea un ticket con el nombre del video.",
    keywords: ["video", "no carga", "no funciona", "pantalla negra", "lento", "error", "produccion"],
  },
  {
    id: "letra",
    category: "app",
    q: "No leo bien los textos",
    a: "Toca el botón Aa (arriba) para cambiar a tema claro, activar alto contraste o agrandar la letra. El cambio es inmediato.",
    keywords: ["leer", "letra", "texto", "no se ve", "pequeno", "contraste", "claro", "oscuro", "tamano", "vista"],
  },
];

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9ñ ]/g, " ");

/** Best FAQ matches for a free-text question, by keyword overlap. */
export function searchFaqs(text: string, limit = 3) {
  const q = ` ${norm(text)} `;
  return FAQS.map(f => ({
    f,
    score:
      f.keywords.reduce((s, k) => s + (q.includes(` ${norm(k)}`) || q.includes(norm(k)) ? (k.includes(" ") ? 3 : 2) : 0), 0) +
      norm(f.q)
        .split(" ")
        .filter(w => w.length > 3 && q.includes(w)).length,
  }))
    .filter(x => x.score > 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(x => x.f);
}

export const SUPPORT_WHATSAPP = (import.meta.env.VITE_SUPPORT_WHATSAPP as string | undefined)?.replace(/\D/g, "") || "";
export const SUPPORT_EMAIL = (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined) || "";
