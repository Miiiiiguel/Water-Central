import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

// Un Supabase mínimo en memoria, solo para probar de punta a punta las rutas
// de inventario (webhooks, lote, API con llave) sin red. Imita lo que esas
// rutas usan: filtros eq/in/lte, order/limit/range, insert/upsert/update/delete,
// restricciones únicas y la vista casillero_inventario. El SQL de verdad se
// prueba aparte sobre PGlite (supabase/casillero.sql).

type Fila = Record<string, any>;
const UNICOS: Record<string, string[][]> = {
  casillero_inv_mov: [['ref_externa']],
  casillero_integraciones: [['user_id', 'plataforma', 'dominio']],
  casillero_productos: [['user_id', 'sku']],
  casillero_api_keys: [['hash']],
};
const PK: Record<string, string[]> = { casillero_productos_externos: ['producto_id', 'integracion_id'], casillero_integraciones_secretos: ['integracion_id'] };

export function dbFalsa(inicial: Record<string, Fila[]> = {}) {
  const tablas: Record<string, Fila[]> = {};
  for (const [k, v] of Object.entries(inicial)) tablas[k] = v.map((f) => ({ ...f }));
  const filas = (t: string) => (tablas[t] ??= []);
  let serie = 1;

  const valor = (f: Fila, clave: string) => (clave.includes('->>') ? (f[clave.split('->>')[0]] ?? {})[clave.split('->>')[1]] : f[clave]);

  function inventario(): Fila[] {
    return filas('casillero_productos').map((p) => {
      const m = filas('casillero_inv_mov').filter((x) => x.producto_id === p.id);
      const suma = (fn: (x: Fila) => boolean) => m.filter(fn).reduce((a, x) => a + x.cantidad, 0);
      return { ...p, disponibles: suma(() => true), vendidos: -suma((x) => x.tipo === 'venta'), total_unidades: suma((x) => ['ingreso', 'devolucion'].includes(x.tipo) || (x.tipo === 'ajuste' && x.cantidad > 0)) };
    });
  }
  const fuente = (t: string) => (t === 'casillero_inventario' ? inventario() : filas(t));

  function from(t: string) {
    const filtros: ((f: Fila) => boolean)[] = [];
    let accion: 'select' | 'insert' | 'upsert' | 'update' | 'delete' = 'select';
    let payload: any;
    let orden: { col: string; asc: boolean } | null = null;
    let tope: [number, number] | null = null;
    let uno: 'single' | 'maybe' | null = null;
    let cuenta = false;
    let seleccion = false;

    const q: any = {
      select: (_c?: string, o?: { count?: string; head?: boolean }) => { seleccion = true; if (o?.count) cuenta = true; return q; },
      eq: (k: string, v: unknown) => { filtros.push((f) => valor(f, k) === v); return q; },
      in: (k: string, vs: unknown[]) => { filtros.push((f) => vs.includes(valor(f, k))); return q; },
      lte: (k: string, v: number) => { filtros.push((f) => valor(f, k) <= v); return q; },
      order: (col: string, o?: { ascending?: boolean }) => { orden = { col, asc: o?.ascending !== false }; return q; },
      limit: (n: number) => { tope = [0, n - 1]; return q; },
      range: (a: number, b: number) => { tope = [a, b]; return q; },
      insert: (p: Fila | Fila[]) => { accion = 'insert'; payload = p; return q; },
      upsert: (p: Fila) => { accion = 'upsert'; payload = p; return q; },
      update: (p: Fila) => { accion = 'update'; payload = p; return q; },
      delete: () => { accion = 'delete'; return q; },
      single: () => { uno = 'single'; return q; },
      maybeSingle: () => { uno = 'maybe'; return q; },
      then: (ok: (r: any) => unknown, ko: (e: unknown) => unknown) => Promise.resolve(ejecutar()).then(ok, ko),
    };

    function violaUnico(fila: Fila, ignorar?: Fila): boolean {
      return (UNICOS[t] ?? []).some((cols) => cols.every((c) => fila[c] != null) && filas(t).some((x) => x !== ignorar && cols.every((c) => x[c] === fila[c])));
    }

    function ejecutar() {
      const coincide = (f: Fila) => filtros.every((fn) => fn(f));
      if (accion === 'insert' || accion === 'upsert') {
        const nuevos: Fila[] = [];
        for (const p of Array.isArray(payload) ? payload : [payload]) {
          const fila: Fila = { created_at: new Date().toISOString(), ...p };
          if (t === 'casillero_integracion_eventos') { fila.id ??= serie++; fila.resuelto ??= false; } else fila.id ??= randomUUID();
          if (t === 'casillero_integraciones') { fila.estado ??= 'activa'; fila.sync_stock ??= false; fila.webhooks ??= []; }
          const pk = PK[t];
          const previa = pk ? filas(t).find((x) => pk.every((c) => x[c] === fila[c])) : undefined;
          if (previa && accion === 'upsert') { Object.assign(previa, fila); nuevos.push(previa); continue; }
          if (previa || violaUnico(fila)) return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } };
          filas(t).push(fila);
          nuevos.push(fila);
        }
        return resultado(seleccion ? nuevos : null);
      }
      if (accion === 'update') {
        const tocadas = filas(t).filter(coincide);
        tocadas.forEach((f) => Object.assign(f, payload));
        return resultado(seleccion ? tocadas : null);
      }
      if (accion === 'delete') {
        tablas[t] = filas(t).filter((f) => !coincide(f));
        return resultado(null);
      }
      let r = fuente(t).filter(coincide);
      if (orden) { const { col, asc } = orden; r = [...r].sort((a, b) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0) * (asc ? 1 : -1)); }
      if (tope) r = r.slice(tope[0], tope[1] + 1);
      if (cuenta) return { data: null, error: null, count: r.length };
      return resultado(r);
    }

    function resultado(datos: Fila[] | null) {
      if (uno && datos) {
        if (uno === 'single' && datos.length !== 1) return { data: null, error: { code: 'PGRST116', message: 'no rows' } };
        return { data: datos[0] ?? null, error: null };
      }
      return { data: datos, error: null };
    }
    return q;
  }
  return { db: { from } as unknown as SupabaseClient, tablas, filas, inventario };
}
