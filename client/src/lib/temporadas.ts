// Las fechas especiales del comercio en EE. UU.: cuándo caen, cuánto se
// suele descontar y cuánto más se vende ese mes. Son supuestos de partida
// para la proyección (el cliente cambia el descuento); la calculadora los
// pone en el mes del calendario que toca según cuándo empieza a vender.

export interface FechaEspecial {
  id: string;
  /** Mes del calendario, 1 = enero. */
  mes: number;
  nombre: string;
  nombreEn: string;
  cuando: string;
  cuandoEn: string;
  /** Descuento sugerido sobre el precio, como fracción. */
  descuento: number;
  /** Cuántas veces las ventas de un mes normal se venden ese mes. */
  alza: number;
  /** Las que conviene hacer de entrada. */
  recomendada: boolean;
}

export const FECHAS_ESPECIALES: FechaEspecial[] = [
  { id: 'san-valentin', mes: 2, nombre: 'San Valentín', nombreEn: "Valentine's Day", cuando: '14 de febrero', cuandoEn: 'February 14', descuento: 0.1, alza: 1.2, recomendada: false },
  { id: 'dia-madre', mes: 5, nombre: 'Día de la Madre', nombreEn: "Mother's Day", cuando: '2.º domingo de mayo', cuandoEn: '2nd Sunday of May', descuento: 0.1, alza: 1.2, recomendada: false },
  { id: 'dia-padre', mes: 6, nombre: 'Día del Padre', nombreEn: "Father's Day", cuando: '3.er domingo de junio', cuandoEn: '3rd Sunday of June', descuento: 0.1, alza: 1.15, recomendada: false },
  { id: 'prime-day', mes: 7, nombre: 'Prime Day de Amazon', nombreEn: 'Amazon Prime Day', cuando: 'mediados de julio', cuandoEn: 'mid-July', descuento: 0.2, alza: 1.8, recomendada: true },
  { id: 'regreso-clases', mes: 8, nombre: 'Regreso a clases', nombreEn: 'Back to school', cuando: 'agosto', cuandoEn: 'August', descuento: 0.1, alza: 1.2, recomendada: false },
  { id: 'prime-octubre', mes: 10, nombre: 'Prime Big Deal Days', nombreEn: 'Prime Big Deal Days', cuando: 'octubre', cuandoEn: 'October', descuento: 0.15, alza: 1.4, recomendada: true },
  { id: 'black-friday', mes: 11, nombre: 'Black Friday y Cyber Monday', nombreEn: 'Black Friday & Cyber Monday', cuando: 'fin de noviembre', cuandoEn: 'late November', descuento: 0.25, alza: 2.2, recomendada: true },
  { id: 'navidad', mes: 12, nombre: 'Temporada navideña', nombreEn: 'Holiday season', cuando: '1 al 20 de diciembre', cuandoEn: 'December 1–20', descuento: 0.15, alza: 1.6, recomendada: true },
];

export const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
export const MESES_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Lo que viaja al servidor: el mes en que empieza a vender y las fechas que hace. */
export interface Promociones {
  inicioMes: number;
  fechas: Array<{ mes: number; descuento: number; alza: number }>;
}

/** El mes del calendario (1-12) del mes `i` de la proyección (0 = el primero). */
export const mesDelCalendario = (inicioMes: number, i: number) => ((inicioMes - 1 + i) % 12) + 1;

/** El descuento y el alza del mes `i` de la proyección; sin promoción, 0 y 1. */
export function promoDelMes(p: Promociones | null | undefined, i: number): { descuento: number; alza: number } {
  if (!p) return { descuento: 0, alza: 1 };
  const f = p.fechas.find((x) => x.mes === mesDelCalendario(p.inicioMes, i));
  return f ? { descuento: f.descuento, alza: f.alza } : { descuento: 0, alza: 1 };
}
