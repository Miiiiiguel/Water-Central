// Qué producto es, dicho por quien vio la foto.
//
// Muchas etiquetas no dicen qué es el producto. La de un buzo dice
// "45% algodón, 20% lana" y nada más; la de un reloj, "acero
// inoxidable, 5 ATM". Quien mira la foto ve el buzo y el reloj; el
// texto transcrito, no. Por eso el lector, además de transcribir,
// agrega al final una línea "PRODUCTO_VISTO: ...", y esa línea viaja
// con el texto. El nombre es raro a propósito: hay etiquetas que traen
// impreso "PRODUCTO: CAFÉ TOSTADO", y esa línea es de la etiqueta.
//
// Lo que se hace con ella es poco y a propósito:
//   - Sirve para decidir de qué familia es el producto, como una señal
//     más. No es un código: la partida sigue saliendo sólo del arancel.
//   - NO pasa por los lectores de datos. "PRODUCTO_VISTO: reloj de acero" no
//     puede terminar en pantalla como "Leí: acero", porque la etiqueta
//     no lo decía: lo dijo quien miró la foto.

export const PREFIJO_PISTA = 'PRODUCTO_VISTO:';

const LINEA = /^\s*PRODUCTO_VISTO:\s*(.*)$/i;
const SIN_TEXTO = /^\s*SIN_TEXTO\s*$/i;
/** "desconocido" es la respuesta honesta de quien no pudo saberlo. */
const NO_SABE = /^(desconocido|unknown|no se sabe|n\/a|-)?\.?$/i;

/** Separa la línea de la pista del texto de la etiqueta. */
export function separarPista(texto: string): { etiqueta: string; pista: string | null } {
  let pista: string | null = null;
  const resto: string[] = [];
  for (const linea of (texto || '').split('\n')) {
    const m = LINEA.exec(linea);
    if (m) {
      // Si viniera más de una, vale la última: es la que se escribió
      // después de leer todo lo demás.
      const valor = m[1].trim();
      pista = NO_SABE.test(valor) ? null : valor.slice(0, 120);
    } else {
      resto.push(linea);
    }
  }
  return { etiqueta: resto.join('\n').trim(), pista };
}

/**
 * Lo que devuelve el lector, puesto en limpio. Una foto sin texto pero
 * con un producto reconocible (una taza lisa, un sombrero sin marquilla)
 * ya no es "no se leyó nada": se sabe qué es, y con eso alcanza para
 * empezar.
 */
export function interpretarSalida(crudo: string): { texto: string; ilegible: boolean } {
  const lineas = (crudo || '').split('\n').filter((l) => !SIN_TEXTO.test(l));
  const { etiqueta, pista } = separarPista(lineas.join('\n'));
  const texto = [etiqueta, pista ? `${PREFIJO_PISTA} ${pista}` : ''].filter(Boolean).join('\n');
  return { texto, ilegible: !texto };
}
