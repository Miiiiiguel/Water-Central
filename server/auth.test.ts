import { describe, expect, it } from 'vitest';
import { AUTH_RESPONSE } from './auth';

// Durante semanas, cinco fallas distintas contestaban exactamente lo
// mismo: 401, "necesito saber quién sos". Una de ellas era "la base de
// datos del proyecto no existe", y quien la sufría veía un mensaje que
// le decía que se creara una cuenta que ya tenía. Estas pruebas están
// para que eso no vuelva a colapsarse en un solo mensaje.

describe('por qué no se pudo identificar a quien llama', () => {
  it('cada causa tiene su propio código', () => {
    const codigos = Object.values(AUTH_RESPONSE).map((r) => r.error);
    expect(new Set(codigos).size).toBe(codigos.length);
  });

  it('lo que se arregla entrando es 401; lo nuestro es 503', () => {
    expect(AUTH_RESPONSE.sin_token.status).toBe(401);
    expect(AUTH_RESPONSE.token_invalido.status).toBe(401);
    // Un 401 acá haría que el navegador mande a crear cuenta a alguien
    // que ya la tiene. No es su sesión: es configuración nuestra.
    expect(AUTH_RESPONSE.servidor_sin_llaves.status).toBe(503);
    expect(AUTH_RESPONSE.base_sin_preparar.status).toBe(503);
    expect(AUTH_RESPONSE.sin_perfil.status).toBe(503);
  });

  it('las fallas nuestras dicen que no es culpa de quien las ve', () => {
    for (const reason of ['servidor_sin_llaves', 'base_sin_preparar', 'sin_perfil'] as const) {
      expect(AUTH_RESPONSE[reason].message).toMatch(/equipo/i);
    }
    expect(AUTH_RESPONSE.servidor_sin_llaves.message).toMatch(/no tuya/i);
  });

  it('la sesión vencida dice qué hacer, y no es crear una cuenta', () => {
    expect(AUTH_RESPONSE.token_invalido.message).toMatch(/entrá de nuevo/i);
    expect(AUTH_RESPONSE.token_invalido.message).not.toMatch(/creá tu cuenta/i);
  });

  it('ningún mensaje le regala al cliente el detalle interno', () => {
    // Nombres de tablas, de variables de entorno o del proveedor de
    // datos no salen del servidor: el detalle técnico va al log.
    for (const r of Object.values(AUTH_RESPONSE)) {
      expect(r.message).not.toMatch(/profiles|research_usage|kalodata|sicex|service_role|SUPABASE_/i);
    }
  });
});
