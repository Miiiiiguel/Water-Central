import { describe, expect, it } from 'vitest';
import { FLAT, type Answer } from './diagnosticContent';
import { PASOS, TODAS, estadoDe, hechasPorDiagnostico } from './ruta';

describe('la ruta exportadora', () => {
  it('son 7 pasos, numerados en orden, y cada tarea tiene un id único', () => {
    expect(PASOS.map((p) => p.n)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    const ids = TODAS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('cada tarea ligada al diagnóstico apunta a una pregunta de sí/no que existe', () => {
    for (const t of TODAS) {
      if (t.diag === undefined) continue;
      const q = FLAT[t.diag];
      expect(q, t.id).toBeDefined();
      expect(q.type, t.id).not.toBe('input');
    }
  });

  it('las preguntas del diagnóstico caen en la tarea que corresponde', () => {
    // Si el cuestionario cambia de orden, esto falla antes que la ruta.
    const de = (id: string) => FLAT[TODAS.find((t) => t.id === id)!.diag!].t;
    expect(de('empresa')).toMatch(/empresa registrada/i);
    expect(de('marca')).toMatch(/marca registrada/i);
    expect(de('bodega')).toMatch(/bodega/i);
    expect(de('resenas')).toMatch(/reseñas/i);
    expect(de('competencia')).toMatch(/competidores/i);
  });

  it('un "Sí" en el diagnóstico marca la tarea; un "No" o sin responder no', () => {
    const answers: Answer[] = FLAT.map(() => null);
    answers[0] = 'si';
    answers[1] = 'no';
    const hechas = hechasPorDiagnostico(answers);
    expect(hechas.has('empresa')).toBe(true);
    expect(hechas.has('marca')).toBe(false);
    expect(hechas.size).toBe(1);
  });

  it('el paso actual es el primero con algo pendiente', () => {
    expect(estadoDe(new Set()).actual?.n).toBe(1);
    const paso1 = PASOS[0].tareas.map((t) => t.id);
    const e = estadoDe(new Set(paso1));
    expect(e.actual?.n).toBe(2);
    expect(e.porPaso[0].completo).toBe(true);
    expect(e.pct).toBe(Math.round((paso1.length / TODAS.length) * 100));
  });

  it('todo hecho: 100 % y sin paso actual', () => {
    const e = estadoDe(new Set(TODAS.map((t) => t.id)));
    expect(e.pct).toBe(100);
    expect(e.actual).toBeNull();
  });

  it('un diagnóstico con todo "Sí" deja pendientes sólo las tareas que no pregunta', () => {
    const todoSi = FLAT.map((q) => (q.type === 'input' ? null : ('si' as Answer)));
    const hechas = hechasPorDiagnostico(todoSi);
    const sinDiag = TODAS.filter((t) => t.diag === undefined).length;
    expect(TODAS.length - hechas.size).toBe(sinDiag);
  });
});
