import { describe, expect, it } from 'vitest';
import { esErrorDeCarga } from './errorCarga';

describe('errores de carga tras una actualización', () => {
  it('reconoce los mensajes de los distintos navegadores', () => {
    expect(esErrorDeCarga(new TypeError('Failed to fetch dynamically imported module: https://x.co/assets/Casillero-abc.js'))).toBe(true);
    expect(esErrorDeCarga(new Error('Importing a module script failed.'))).toBe(true);
    expect(esErrorDeCarga(new Error('error loading dynamically imported module'))).toBe(true);
    expect(esErrorDeCarga({ message: 'Loading chunk 12 failed.' })).toBe(true);
    expect(esErrorDeCarga('Unable to preload CSS for /assets/x.css')).toBe(true);
  });
  it('no confunde otros errores', () => {
    expect(esErrorDeCarga(new Error("Cannot read properties of undefined (reading 'x')"))).toBe(false);
    expect(esErrorDeCarga(null)).toBe(false);
    expect(esErrorDeCarga(undefined)).toBe(false);
    expect(esErrorDeCarga(42)).toBe(false);
  });
});
