// Lectura de la auditoría del casillero: qué cambió, en palabras de persona.

export interface FilaAuditoria {
  id: number;
  actor: string | null;
  tabla: string;
  accion: 'INSERT' | 'UPDATE' | 'DELETE';
  fila: string | null;
  detalle: Record<string, unknown> | null;
  created_at: string;
}

export const TABLAS: Record<string, { uno: string; muchos: string }> = {
  casillero_paquetes: { uno: 'un paquete', muchos: 'Paquetes' },
  casillero_despachos: { uno: 'un despacho', muchos: 'Despachos' },
  casillero_wallet: { uno: 'un movimiento del wallet', muchos: 'Wallet' },
  casillero_tarifas: { uno: 'una tarifa', muchos: 'Tarifas' },
  casillero_config: { uno: 'un ajuste de configuración', muchos: 'Configuración' },
  casillero_inv_mov: { uno: 'un movimiento de inventario', muchos: 'Inventario' },
  profiles: { uno: 'los datos de un cliente', muchos: 'Clientes' },
  anuncio: { uno: 'un anuncio', muchos: 'Anuncios' },
};

const VERBO = { INSERT: 'Creó', UPDATE: 'Modificó', DELETE: 'Eliminó' } as const;

/** «Modificó un paquete», «Creó un anuncio». */
export const titulo = (f: Pick<FilaAuditoria, 'tabla' | 'accion'>) => `${VERBO[f.accion] ?? f.accion} ${TABLAS[f.tabla]?.uno ?? f.tabla}`;

/** Campos que cambian sin que a nadie le importe. */
const RUIDO = new Set(['updated_at']);

export interface Diferencia { campo: string; antes: unknown; despues: unknown }

/** En un UPDATE, solo los campos cuyo valor cambió. En un INSERT/DELETE, todos los campos de la fila. */
export function diferencias(f: Pick<FilaAuditoria, 'accion' | 'detalle'>): Diferencia[] {
  const d = f.detalle ?? {};
  if (f.accion === 'UPDATE') {
    const antes = (d.antes ?? {}) as Record<string, unknown>;
    const despues = (d.despues ?? {}) as Record<string, unknown>;
    return Object.keys({ ...antes, ...despues })
      .filter((k) => !RUIDO.has(k) && JSON.stringify(antes[k]) !== JSON.stringify(despues[k]))
      .map((campo) => ({ campo, antes: antes[campo], despues: despues[campo] }));
  }
  const campos = d as Record<string, unknown>;
  return Object.keys(campos).filter((k) => !RUIDO.has(k)).map((campo) => (f.accion === 'DELETE' ? { campo, antes: campos[campo], despues: undefined } : { campo, antes: undefined, despues: campos[campo] }));
}

/** Valor legible para una celda. */
export function valorLegible(v: unknown): string {
  if (v === undefined) return '';
  if (v === null || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'sí' : 'no';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/** Una línea que dice de qué trató el cambio. */
export function resumen(f: Pick<FilaAuditoria, 'tabla' | 'accion' | 'detalle' | 'fila'>): string {
  const d = f.detalle ?? {};
  const fila = (f.accion === 'UPDATE' ? d.despues : d) as Record<string, unknown> | undefined;
  const cambios = f.accion === 'UPDATE' ? diferencias(f) : [];
  const que = (k: string) => cambios.find((c) => c.campo === k);
  const cambio = (k: string) => { const c = que(k); return c ? `${k.replace(/_/g, ' ')}: ${valorLegible(c.antes)} → ${valorLegible(c.despues)}` : null; };

  switch (f.tabla) {
    case 'anuncio': return String(d.titulo ?? '');
    case 'casillero_paquetes': return [`guía ${fila?.guia ?? f.fila}`, cambio('estado'), cambio('peso_lb')].filter(Boolean).join(' · ');
    case 'casillero_despachos': return [`despacho ${String(f.fila ?? '').slice(0, 8)}`, cambio('estado'), cambio('guia_despacho')].filter(Boolean).join(' · ');
    case 'casillero_wallet': return [fila?.tipo ? String(fila.tipo) : null, fila?.monto !== undefined ? `USD ${fila.monto}` : null, cambio('estado'), fila?.referencia ? String(fila.referencia) : null].filter(Boolean).join(' · ');
    case 'casillero_config': return [String(f.fila ?? ''), cambio('valor')].filter(Boolean).join(' · ');
    case 'casillero_tarifas': return fila ? `${fila.libras_desde}–${fila.libras_hasta} lb` : String(f.fila ?? '');
    case 'casillero_inv_mov': return fila ? [fila.tipo, fila.cantidad !== undefined ? `${Number(fila.cantidad) > 0 ? '+' : ''}${fila.cantidad} u` : null, fila.referencia].filter(Boolean).join(' · ') : '';
    case 'profiles': return [String(fila?.casillero_codigo ?? ''), cambio('casillero_bloqueado'), cambio('role'), cambios.length && !que('casillero_bloqueado') && !que('role') ? `${cambios.length} ${cambios.length === 1 ? 'dato' : 'datos'}` : null].filter(Boolean).join(' · ');
    default: return String(f.fila ?? '');
  }
}
