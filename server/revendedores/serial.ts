import { createHash, randomInt } from 'node:crypto';

// El número de serie con el que entra cada revendedor.
//
// Es la única credencial que tienen, así que tiene que ser imposible de
// adivinar: 16 caracteres de un alfabeto de 32 son 80 bits al azar, y
// la ruta de entrada además limita los intentos. Se guarda sólo su hash
// (SHA-256): con 80 bits de azar no hace falta un hash lento, y si la
// tabla se filtrara no sirve para entrar.
//
// El alfabeto no trae 0/O ni 1/I/L: el serial se dicta por teléfono y se
// copia a mano.

const ALFABETO = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const GRUPOS = 4;
const POR_GRUPO = 4;

/** Uno nuevo, con la forma ECX-XXXX-XXXX-XXXX-XXXX. */
export function generarSerial(): string {
  const grupos: string[] = [];
  for (let g = 0; g < GRUPOS; g++) {
    let s = '';
    for (let i = 0; i < POR_GRUPO; i++) s += ALFABETO[randomInt(ALFABETO.length)];
    grupos.push(s);
  }
  return `ECX-${grupos.join('-')}`;
}

/**
 * Lo que escribió la persona, en forma canónica: sin espacios ni
 * guiones, en mayúsculas y sin el prefijo ECX. Así "ecx-abcd efgh…" y
 * "ABCDEFGH…" son el mismo serial.
 */
export function normalizarSerial(texto: string): string {
  const limpio = texto.toUpperCase().replace(/[\s-]/g, '');
  return limpio.startsWith('ECX') ? limpio.slice(3) : limpio;
}

export function formaValida(texto: string): boolean {
  const n = normalizarSerial(texto);
  return n.length === GRUPOS * POR_GRUPO && n.split("").every((c) => ALFABETO.includes(c));
}

export function hashSerial(texto: string): string {
  return createHash('sha256').update(`ecx-revendedor:${normalizarSerial(texto)}`).digest('hex');
}

/** Los últimos 4, para reconocerlo en el panel sin mostrarlo entero. */
export function pistaSerial(texto: string): string {
  return normalizarSerial(texto).slice(-4);
}
