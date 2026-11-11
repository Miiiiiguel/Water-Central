import { describe, expect, it } from 'vitest';
import { googleActivo, rutaInterna } from './oauthReturn';

describe('regreso de Google', () => {
  it('solo vuelve a rutas de esta misma app', () => {
    expect(rutaInterna('/casillero')).toBe('/casillero');
    expect(rutaInterna('/admin/casillero/resumen')).toBe('/admin/casillero/resumen');
    expect(rutaInterna(undefined)).toBe('/dashboard');
    expect(rutaInterna('')).toBe('/dashboard');
    expect(rutaInterna('https://malo.example/robo')).toBe('/dashboard');
    expect(rutaInterna('//malo.example')).toBe('/dashboard');
    expect(rutaInterna('/\\malo.example')).toBe('/dashboard');
    expect(rutaInterna('/ok\r\nLocation: x')).toBe('/dashboard');
    expect(rutaInterna('casillero', '/casillero')).toBe('/casillero');
  });
  it('esconde Google solo si Supabase dice que está apagado', () => {
    expect(googleActivo({ external: { google: false, email: true } })).toBe(false);
    expect(googleActivo({ external: { google: true } })).toBe(true);
    expect(googleActivo(null)).toBe(true);
    expect(googleActivo({})).toBe(true);
    expect(googleActivo('raro')).toBe(true);
  });
});
