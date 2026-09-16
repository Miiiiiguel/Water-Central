import { describe, expect, it } from 'vitest';
import { authErrorMessage, classifyAuthError } from './authErrors';

// "Revisa tu conexión" fue el mensaje que vio un cliente real cuando se
// intentó registrar. Su conexión estaba bien. Estas pruebas fijan que
// cada causa se diga por su nombre.

describe('por qué falló el registro', () => {
  it('reconoce el trozo de JavaScript que ya no existe, en los tres navegadores', () => {
    // Pasa siempre que se redespliega: el service worker guardó el
    // índice viejo, y los nombres de los archivos cambian en cada build.
    for (const texto of [
      'TypeError: Failed to fetch dynamically imported module: https://app/assets/x-a1b2.js',
      'Error: error loading dynamically imported module',
      'TypeError: Importing a module script failed.',
      'ChunkLoadError: Loading chunk 42 failed.',
    ]) {
      expect(classifyAuthError(new Error(texto)), texto).toBe('app_actualizada');
    }
  });

  it('reconoce que el servidor de cuentas no contestó', () => {
    for (const texto of ['TypeError: Failed to fetch', 'TypeError: NetworkError when attempting to fetch resource.', 'TypeError: Load failed']) {
      expect(classifyAuthError(new Error(texto)), texto).toBe('sin_respuesta');
    }
  });

  it('lo que no reconoce no lo disfraza de problema de conexión', () => {
    expect(classifyAuthError(new Error('x.y is not a function'))).toBe('inesperado');
    expect(classifyAuthError('algo raro')).toBe('inesperado');
    expect(classifyAuthError(null)).toBe('inesperado');
  });

  it('ningún mensaje le echa la culpa al internet de quien lo lee, salvo cuando puede serlo', () => {
    expect(authErrorMessage('app_actualizada', true)).toMatch(/recarg/i);
    expect(authErrorMessage('app_actualizada', true)).not.toMatch(/conexi[oó]n/i);
    expect(authErrorMessage('inesperado', true)).toMatch(/no fue tu conexión/i);
    expect(authErrorMessage('sin_respuesta', true)).toMatch(/problema es nuestro/i);
  });

  it('los tres mensajes existen en los dos idiomas', () => {
    for (const f of ['app_actualizada', 'sin_respuesta', 'inesperado'] as const) {
      expect(authErrorMessage(f, true).length, f).toBeGreaterThan(40);
      expect(authErrorMessage(f, false).length, f).toBeGreaterThan(40);
    }
  });
});
