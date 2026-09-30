import { describe, expect, it } from 'vitest';
import { explainOAuthError, readOAuthError } from './oauthReturn';

// Volver de Google y que la página no diga nada era el síntoma: "no
// carga". El motivo venía escrito en la URL y nadie lo leía.

describe('leer el motivo de la URL', () => {
  it('lo encuentra en el fragmento, que es donde suele venir', () => {
    const err = readOAuthError('#error=server_error&error_description=Unsupported+provider', '');
    expect(err).toEqual({ code: 'server_error', description: 'Unsupported provider' });
  });

  it('lo encuentra también en la consulta', () => {
    expect(readOAuthError('', '?error=access_denied')?.code).toBe('access_denied');
  });

  it('acepta error_code, que es como lo manda Supabase a veces', () => {
    expect(readOAuthError('#error_code=provider_disabled', '')?.code).toBe('provider_disabled');
  });

  it('no inventa un error donde no lo hay', () => {
    expect(readOAuthError('', '')).toBeNull();
    expect(readOAuthError('#access_token=abc123', '')).toBeNull();
    expect(readOAuthError('', '?code=abc123')).toBeNull(); // el código de un login BUENO
  });
});

describe('decir qué hacer, no "algo salió mal"', () => {
  it('proveedor apagado: dice dónde está el interruptor', () => {
    const msg = explainOAuthError({ code: 'server_error', description: 'Unsupported provider: provider is not enabled' }, true);
    expect(msg).toMatch(/Authentication → Providers → Google/);
    expect(msg).toMatch(/no tuya/);
  });

  it('dirección de retorno no autorizada: dice dónde se añade', () => {
    const msg = explainOAuthError({ code: 'invalid_request', description: 'redirect_uri not allowed' }, true);
    expect(msg).toMatch(/URL Configuration → Redirect URLs/);
  });

  it('si la persona canceló, no le echamos la culpa a nadie', () => {
    const msg = explainOAuthError({ code: 'access_denied', description: '' }, true);
    expect(msg).toMatch(/cancelaste/i);
    expect(msg).not.toMatch(/configuración/i);
  });

  it('lo que no reconoce lo enseña tal cual en vez de esconderlo', () => {
    const msg = explainOAuthError({ code: 'weird_thing', description: 'algo muy raro pasó' }, true);
    expect(msg).toContain('algo muy raro pasó');
  });

  it('funciona en los dos idiomas', () => {
    const err = { code: 'server_error', description: 'provider is not enabled' };
    expect(explainOAuthError(err, false)).toMatch(/Providers → Google/);
    expect(explainOAuthError(err, false)).toMatch(/not yours/);
  });
});
