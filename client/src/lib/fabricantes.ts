// Fabricantes patrocinados, del lado del navegador: los que se sugieren
// para una búsqueda, el directorio, el contacto, la solicitud para
// aparecer y la administración (cuentas maestras). Todo pasa por
// /api/fabricantes; las tablas no se leen desde acá.

export interface Fabricante {
  id: string;
  nombre: string;
  descripcion: string | null;
  pais: string;
  ciudad: string | null;
  pedido_minimo: string | null;
  certificaciones: string | null;
  sitio_web: string | null;
}

export type Lugar = 'chat' | 'roi' | 'directorio' | 'etiqueta';

export interface Metricas {
  impresiones30: number;
  contactos30: number;
  contactos: number;
}

export interface ContactoRecibido {
  id: string;
  lugar: string | null;
  contexto: string | null;
  nombre: string | null;
  correo: string | null;
  telefono: string | null;
  mensaje: string | null;
  created_at: string;
}

export interface FabricanteEditable {
  nombre: string;
  descripcion: string | null;
  pais: string;
  ciudad: string | null;
  categorias: string[];
  palabras: string[];
  pedido_minimo: string | null;
  certificaciones: string | null;
  contacto_nombre: string | null;
  contacto_email: string | null;
  contacto_whatsapp: string | null;
  sitio_web: string | null;
  estado: 'pendiente' | 'aprobado';
  activo: boolean;
  pauta_hasta: string | null;
  prioridad: number;
  plan: string | null;
  precio_mensual_usd: number | null;
  notas: string | null;
}

export interface FabricanteAdmin extends FabricanteEditable {
  id: string;
  created_at: string;
  vigente: boolean;
  metricas: Metricas;
  contactos: ContactoRecibido[];
}

type Resultado<T> = { ok: true; data: T } | { ok: false; status: number; message: string };

async function pedir<T>(ruta: string, token: string | null = null, init: RequestInit = {}): Promise<Resultado<T>> {
  try {
    const res = await fetch(`/api/fabricantes${ruta}`, {
      ...init,
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, status: res.status, message: (data as { message?: string }).message || 'No se pudo completar. Intenta de nuevo.' };
    return { ok: true, data: data as T };
  } catch {
    return { ok: false, status: 0, message: 'Sin conexión. Intenta de nuevo.' };
  }
}

/** Los patrocinados para una búsqueda. Si algo falla, ninguno: nunca rompe la página que los muestra. */
export async function fabricantesSugeridos(b: { q?: string; codigo?: string; lugar: Lugar }): Promise<Fabricante[]> {
  const params = new URLSearchParams({ lugar: b.lugar });
  if (b.q) params.set('q', b.q.slice(0, 200));
  if (b.codigo) params.set('codigo', b.codigo);
  const r = await pedir<{ fabricantes: Fabricante[] }>(`/sugeridos?${params}`);
  return r.ok ? r.data.fabricantes : [];
}

export async function directorioFabricantes(q: string): Promise<Fabricante[] | null> {
  const r = await pedir<{ fabricantes: Fabricante[] }>(q ? `?q=${encodeURIComponent(q)}` : '');
  return r.ok ? r.data.fabricantes : null;
}

export function contactarFabricante(
  token: string | null,
  id: string,
  datos: { nombre: string; correo: string; telefono: string; mensaje: string; contexto: string; lugar: Lugar }
) {
  return pedir<{ ok: true; whatsapp: string | null }>(`/${id}/contacto`, token, { method: 'POST', body: JSON.stringify(datos) });
}

export function solicitarAparecer(datos: { empresa: string; contacto_nombre: string; correo: string; telefono: string; pais: string; ciudad: string; que_fabrica: string }) {
  return pedir<{ ok: true }>('/solicitud', null, { method: 'POST', body: JSON.stringify(datos) });
}

export const listarFabricantesAdmin = (token: string | null) => pedir<{ fabricantes: FabricanteAdmin[]; hoy: string }>('/admin', token);

export const crearFabricante = (token: string | null, f: FabricanteEditable) =>
  pedir<{ id: string }>('/admin', token, { method: 'POST', body: JSON.stringify(f) });

export const guardarFabricante = (token: string | null, id: string, f: FabricanteEditable) =>
  pedir<{ ok: true }>(`/admin/${id}`, token, { method: 'POST', body: JSON.stringify(f) });

export const borrarFabricante = (token: string | null, id: string) => pedir<{ ok: true }>(`/admin/${id}`, token, { method: 'DELETE' });

/** "33, 3304" o "shampoo, crema" → lista. */
export const aLista = (texto: string) =>
  texto
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);

/** Un mes más de pauta desde hoy o desde que vence, lo que sea más tarde. */
export function extenderUnMes(pautaHasta: string | null, hoy: string): string {
  const base = pautaHasta && pautaHasta >= hoy ? pautaHasta : hoy;
  const [y, m, d] = base.split('-').map(Number);
  const fin = new Date(Date.UTC(y, m, d));
  // Si el mes siguiente no tiene ese día (31 de enero → 3 de marzo), se queda en su último día.
  if (fin.getUTCDate() !== d) fin.setUTCDate(0);
  return fin.toISOString().slice(0, 10);
}
