import { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { useRoute } from 'wouter';
import { ArrowLeftRight, BarChart3, Boxes, ClipboardList, Megaphone, Package, Plug, ScanLine, Settings, ShieldCheck, Truck, UserCog, Users, Wallet } from 'lucide-react';
import Shell, { type ItemNav } from '@/portal/Shell';
import { AdminContext, type Stats } from '@/portal/admin';
import { ConfirmarProvider, Skeleton } from '@/portal/ui';
import { db } from '@/lib/casillero';

// Portal del administrador del casillero (/admin/casillero/*): control total.
// Todo pasa por RLS y por funciones que verifican que quien llama es del
// equipo (supabase/casillero.sql), y queda en la auditoría.

const SECCIONES = {
  resumen: { titulo: 'Resumen', Pagina: lazy(() => import('./admin/Resumen')) },
  recepcion: { titulo: 'Recepción', Pagina: lazy(() => import('./admin/Recepcion')) },
  paquetes: { titulo: 'Paquetes', Pagina: lazy(() => import('./admin/Paquetes')) },
  despachos: { titulo: 'Despachos', Pagina: lazy(() => import('./admin/Despachos')) },
  inventario: { titulo: 'Inventario', Pagina: lazy(() => import('./admin/Inventario')) },
  integraciones: { titulo: 'Integraciones', Pagina: lazy(() => import('./admin/Integraciones')) },
  wallet: { titulo: 'Wallet y recargas', Pagina: lazy(() => import('./admin/Wallet')) },
  tarifas: { titulo: 'Tarifas', Pagina: lazy(() => import('./admin/Tarifas')) },
  clientes: { titulo: 'Clientes', Pagina: lazy(() => import('./admin/Clientes')) },
  anuncios: { titulo: 'Anuncios', Pagina: lazy(() => import('./admin/Anuncios')) },
  config: { titulo: 'Configuración', Pagina: lazy(() => import('./admin/Configuracion')) },
  equipo: { titulo: 'Equipo', Pagina: lazy(() => import('./admin/Equipo')) },
  auditoria: { titulo: 'Auditoría', Pagina: lazy(() => import('./admin/Auditoria')) },
} as const;
type Id = keyof typeof SECCIONES;

export default function CasilleroAdmin() {
  const [, params] = useRoute('/admin/casillero/:seccion');
  const id = (params?.seccion && params.seccion in SECCIONES ? params.seccion : 'resumen') as Id;
  const [stats, setStats] = useState<Stats | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const recargar = useCallback(async () => {
    const { data, error: e } = await (await db()).rpc('casillero_stats');
    if (e) setError(e.message); else { setStats(data as Stats); setError(null); }
    setCargando(false);
  }, []);
  useEffect(() => { void recargar(); }, [recargar]);
  useEffect(() => {
    const alVolver = () => { if (document.visibilityState === 'visible') void recargar(); };
    document.addEventListener('visibilitychange', alVolver);
    return () => document.removeEventListener('visibilitychange', alVolver);
  }, [recargar]);

  const c = stats?.cola;
  const items: ItemNav[] = useMemo(() => [
    { id: 'resumen', etiqueta: 'Resumen', icono: BarChart3, ruta: '/admin/casillero/resumen', principal: true },
    { id: 'recepcion', etiqueta: 'Recepción', icono: ScanLine, ruta: '/admin/casillero/recepcion', grupo: 'Operación', principal: true, insignia: c?.por_recibir },
    { id: 'paquetes', etiqueta: 'Paquetes', icono: Package, ruta: '/admin/casillero/paquetes', grupo: 'Operación' },
    { id: 'despachos', etiqueta: 'Despachos', icono: Truck, ruta: '/admin/casillero/despachos', grupo: 'Operación', principal: true, insignia: c?.por_alistar },
    { id: 'inventario', etiqueta: 'Inventario', icono: Boxes, ruta: '/admin/casillero/inventario', grupo: 'Inventario' },
    { id: 'integraciones', etiqueta: 'Integraciones', icono: Plug, ruta: '/admin/casillero/integraciones', grupo: 'Inventario', insignia: stats?.integraciones.con_error },
    { id: 'wallet', etiqueta: 'Wallet y recargas', icono: Wallet, ruta: '/admin/casillero/wallet', grupo: 'Finanzas', principal: true, insignia: c?.recargas },
    { id: 'tarifas', etiqueta: 'Tarifas', icono: ArrowLeftRight, ruta: '/admin/casillero/tarifas', grupo: 'Finanzas' },
    { id: 'clientes', etiqueta: 'Clientes', icono: Users, ruta: '/admin/casillero/clientes', grupo: 'Clientes' },
    { id: 'anuncios', etiqueta: 'Anuncios', icono: Megaphone, ruta: '/admin/casillero/anuncios', grupo: 'Clientes' },
    { id: 'config', etiqueta: 'Configuración', icono: Settings, ruta: '/admin/casillero/config', grupo: 'Sistema' },
    { id: 'equipo', etiqueta: 'Equipo', icono: UserCog, ruta: '/admin/casillero/equipo', grupo: 'Sistema' },
    { id: 'auditoria', etiqueta: 'Auditoría', icono: ClipboardList, ruta: '/admin/casillero/auditoria', grupo: 'Sistema' },
  ], [c, stats?.integraciones.con_error]);

  const { titulo, Pagina } = SECCIONES[id];
  return (
    <ConfirmarProvider>
      <AdminContext.Provider value={{ stats, cargando, error, recargar }}>
        <Shell variante="admin" items={items} actual={id} titulo={titulo} pie={<p className="flex items-center gap-2 text-[11px] text-white/40"><ShieldCheck size={13} />Cada cambio queda en la auditoría.</p>}>
          <Suspense fallback={<div className="space-y-4"><Skeleton className="h-32 w-full rounded-3xl" /><Skeleton className="h-80 w-full rounded-3xl" /></div>}><Pagina /></Suspense>
        </Shell>
      </AdminContext.Provider>
    </ConfirmarProvider>
  );
}
