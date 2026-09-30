import { describe, expect, it } from 'vitest';
import { arancelDe, cargar } from './store';
import { parseEspecial, parseTasa } from '../../client/src/lib/tasaArancel';

// Contra el arancel real completo: ¿cuántas partidas se pueden calcular?
// El número mínimo está puesto para que un cambio en el lector que rompa
// un formato frecuente se note acá, no en la pantalla de un cliente.

describe('el arancel cargado, entero', () => {
  const idx = cargar();
  const partidas = idx.registros.filter((r) => r.digitos.length >= 8 && !/^9[89]/.test(r.digitos));

  it('casi todas las partidas tienen una tarifa que se puede calcular', () => {
    let calculables = 0;
    const raras = new Map<string, number>();
    for (const r of partidas) {
      const a = arancelDe(r.digitos, idx);
      const t = parseTasa(a?.texto ?? '');
      if (t.calculable) calculables++;
      else raras.set(t.texto, (raras.get(t.texto) ?? 0) + 1);
    }
    const proporcion = calculables / partidas.length;
    // Para el log de la prueba: qué queda afuera.
    console.log(
      `[tasas] ${calculables} de ${partidas.length} partidas calculables (${(proporcion * 100).toFixed(2)}%).`,
      'No calculables más frecuentes:',
      Array.from(raras.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5)
    );
    expect(partidas.length).toBeGreaterThan(20000);
    // Lo que queda afuera es de verdad incalculable con un solo precio:
    // los conjuntos de ropa ("la tarifa de cada prenda del conjunto"),
    // las tarifas por pieza de los relojes y las condicionadas.
    expect(proporcion).toBeGreaterThan(0.97);
  });

  it('la columna Special se lee sin perder programas', () => {
    let conEspecial = 0;
    let leidas = 0;
    for (const r of partidas) {
      const texto = r.fila.special.trim();
      if (!texto || !texto.includes('(')) continue;
      conEspecial++;
      if (parseEspecial(texto).length) leidas++;
    }
    expect(leidas / conEspecial).toBeGreaterThan(0.99);
  });
});
