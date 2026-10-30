import { Suspense, lazy } from 'react';
import { useRoute } from 'wouter';
import { ArrowLeftRight, BellPlus, Boxes, Home, Package, Plug, Truck, UserRound, Wallet } from 'lucide-react';
import Shell, { type ItemNav } from '@/portal/Shell';
import { DatosProvider, useDatos } from '@/portal/datos';
import { ConfirmarProvider, Skeleton } from '@/portal/ui';

// Portal del cliente del casillero (/casillero/*). Cada sección es su propio
// archivo en pages/casillero/ y se carga cuando se abre.

const SECCIONES = {
  inicio: { titulo: 'Inicio', Pagina: lazy(() => import('./casillero/Inicio')) },
  prealerta: { titulo: 'Prealertar', Pagina: lazy(() => import('./casillero/Prealerta')) },
  paquetes: { titulo: 'Mis paquetes', Pagina: lazy(() => import('./casillero/Paquetes')) },
  inventario: { titulo: 'Inventario', Pagina: lazy(() => import('./casillero/Inventario')) },
  integraciones: { titulo: 'Integraciones', Pagina: lazy(() => import('./casillero/Integraciones')) },
  despacho: { titulo: 'Despachar', Pagina: lazy(() => import('./casillero/Despacho')) },
  wallet: { titulo: 'Wallet', Pagina: lazy(() => import('./casillero/Wallet')) },
  tarifas: { titulo: 'Tarifas', Pagina: lazy(() => import('./casillero/Tarifas')) },
  perfil: { titulo: 'Mi perfil', Pagina: lazy(() => import('./casillero/Perfil')) },
} as const;
type Id = keyof typeof SECCIONES;

function Portal({ seccion }: { seccion: string }) {
  const { paquetes } = useDatos();
  const listos = paquetes.filter((p) => p.estado === 'recibido' && p.peso_lb != null).length;
  const items: ItemNav[] = [
    { id: 'inicio', etiqueta: 'Inicio', icono: Home, ruta: '/casillero', principal: true },
    { id: 'prealerta', etiqueta: 'Prealertar', icono: BellPlus, ruta: '/casillero/prealerta', grupo: 'Envíos' },
    { id: 'paquetes', etiqueta: 'Paquetes', icono: Package, ruta: '/casillero/paquetes', grupo: 'Envíos', principal: true },
    { id: 'despacho', etiqueta: 'Despachar', icono: Truck, ruta: '/casillero/despacho', grupo: 'Envíos', insignia: listos, principal: false },
    { id: 'inventario', etiqueta: 'Inventario', icono: Boxes, ruta: '/casillero/inventario', grupo: 'Inventario', principal: true },
    { id: 'integraciones', etiqueta: 'Integraciones', icono: Plug, ruta: '/casillero/integraciones', grupo: 'Inventario' },
    { id: 'wallet', etiqueta: 'Wallet', icono: Wallet, ruta: '/casillero/wallet', grupo: 'Cuenta', principal: true },
    { id: 'tarifas', etiqueta: 'Tarifas', icono: ArrowLeftRight, ruta: '/casillero/tarifas', grupo: 'Cuenta' },
    { id: 'perfil', etiqueta: 'Mi perfil', icono: UserRound, ruta: '/casillero/perfil', grupo: 'Cuenta' },
  ];
  const id = (seccion in SECCIONES ? seccion : 'inicio') as Id;
  const { titulo, Pagina } = SECCIONES[id];
  return (
    <Shell variante="cliente" items={items} actual={id} titulo={titulo}>
      <Suspense fallback={<div className="space-y-4"><Skeleton className="h-40 w-full rounded-3xl" /><Skeleton className="h-72 w-full rounded-3xl" /></div>}>
        <Pagina />
      </Suspense>
    </Shell>
  );
}

export default function Casillero() {
  const [, params] = useRoute('/casillero/:seccion');
  return (
    <ConfirmarProvider>
      <DatosProvider>
        <Portal seccion={params?.seccion ?? 'inicio'} />
      </DatosProvider>
    </ConfirmarProvider>
  );
}
