import { describe, expect, it } from 'vitest';
import { inicioDelMes, sumarMeses } from './research';

// El mes de un plan de tokens, visto desde el servidor. Tiene que
// coincidir con la base (make_interval + age): si no, la pantalla diría
// que quedan tokens que la base ya no da, o al revés.

const d = (s: string) => new Date(s);

describe('meses de un plan', () => {
  it('suma meses de calendario y respeta el fin de mes', () => {
    expect(sumarMeses(d('2026-01-15T10:00:00Z'), 1).toISOString()).toBe('2026-02-15T10:00:00.000Z');
    expect(sumarMeses(d('2026-01-31T10:00:00Z'), 1).toISOString()).toBe('2026-02-28T10:00:00.000Z');
    expect(sumarMeses(d('2026-11-10T00:00:00Z'), 3).toISOString()).toBe('2027-02-10T00:00:00.000Z');
  });

  it('el mes en curso empieza el mismo día del mes en que empezó el plan', () => {
    const inicio = d('2026-01-15T10:00:00Z');
    expect(inicioDelMes(inicio, d('2026-01-20T00:00:00Z')).toISOString()).toBe('2026-01-15T10:00:00.000Z');
    expect(inicioDelMes(inicio, d('2026-02-15T09:59:59Z')).toISOString()).toBe('2026-01-15T10:00:00.000Z');
    expect(inicioDelMes(inicio, d('2026-02-15T10:00:00Z')).toISOString()).toBe('2026-02-15T10:00:00.000Z');
    expect(inicioDelMes(inicio, d('2026-06-01T00:00:00Z')).toISOString()).toBe('2026-05-15T10:00:00.000Z');
  });
});
