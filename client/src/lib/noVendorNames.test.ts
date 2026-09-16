import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// La regla del negocio, puesta donde no se puede olvidar.
//
// El cliente paga por la lectura, no por el acceso. Si aprende el nombre
// de la plataforma de donde salen los datos, lo siguiente que hace es
// contratarla directo — y ahí se acabó el servicio. Por eso esos nombres
// no pueden existir en NADA que baje al navegador: ni en un texto, ni en
// una palabra clave, ni en el id de una fuente dentro de un fetch, donde
// se leen abriendo la pestaña de red.
//
// El servidor sí los conoce (server/kalodata.ts, server/connectors.ts) y
// el equipo los ve en el panel de Integraciones, que se los pide al
// servidor con un token de vendedor. Acá, no.

const PROHIBIDOS = ['kalodata', 'sicex'];
const RAIZ = new URL('../', import.meta.url).pathname; // client/src/

function archivos(dir: string): string[] {
  const salida: string[] = [];
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) salida.push(...archivos(ruta));
    else if (/\.(ts|tsx|css|html)$/.test(nombre) && !nombre.endsWith('.test.ts')) salida.push(ruta);
  }
  return salida;
}

describe('el nombre del proveedor no cruza al navegador', () => {
  const todos = archivos(RAIZ);

  it('hay archivos que revisar (si esto falla, la prueba no está mirando nada)', () => {
    expect(todos.length).toBeGreaterThan(30);
  });

  for (const prohibido of PROHIBIDOS) {
    it(`"${prohibido}" no aparece en client/src`, () => {
      const culpables = todos.filter((f) => readFileSync(f, 'utf8').toLowerCase().includes(prohibido));
      expect(culpables.map((f) => f.slice(RAIZ.length))).toEqual([]);
    });
  }
});
