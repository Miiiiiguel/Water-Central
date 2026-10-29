import { ReactNode, useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import {
  BarChart3, Boxes, ClipboardList, LogOut, Menu, Package, Settings, ShieldCheck, Truck, Users, UserCog, Wallet, X, Megaphone, ArrowLeftRight,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import NotificationBell from '@/components/NotificationBell';
import { Logo } from '@/components/CasilleroShell';

export const SECCIONES_ADMIN = [
  { id: 'resumen', etiqueta: 'Resumen', icono: BarChart3 },
  { id: 'paquetes', etiqueta: 'Paquetes', icono: Package },
  { id: 'despachos', etiqueta: 'Despachos', icono: Truck },
  { id: 'inventario', etiqueta: 'Inventario', icono: Boxes },
  { id: 'wallet', etiqueta: 'Wallet y recargas', icono: Wallet },
  { id: 'clientes', etiqueta: 'Clientes', icono: Users },
  { id: 'tarifas', etiqueta: 'Tarifas', icono: ArrowLeftRight },
  { id: 'anuncios', etiqueta: 'Anuncios', icono: Megaphone },
  { id: 'config', etiqueta: 'Configuración', icono: Settings },
  { id: 'equipo', etiqueta: 'Equipo', icono: UserCog },
  { id: 'auditoria', etiqueta: 'Auditoría', icono: ClipboardList },
] as const;

export type SeccionAdmin = (typeof SECCIONES_ADMIN)[number]['id'];

/**
 * Portal del administrador del casillero. Es un portal aparte del de los
 * clientes: barra lateral oscura con todas las áreas de control, y solo
 * entra el equipo (rol `vendedor`). Que el botón no se vea no es la
 * seguridad — la imponen RLS y las funciones de supabase/casillero.sql.
 */
export default function AdminShell({ actual, titulo, children }: { actual: SeccionAdmin; titulo: string; children: ReactNode }) {
  const { user, profile, loading, signOut } = useAuth();
  const [, navigate] = useLocation();
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate(`/login?next=${encodeURIComponent(window.location.pathname)}`);
  }, [loading, user, navigate]);

  if (loading || !user || !profile) return <div className="min-h-screen bg-gray-50" />;
  if (profile.role !== 'vendedor') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-3 px-4 text-center">
        <ShieldCheck className="text-accent" size={36} />
        <p className="font-bold text-primary">Portal del administrador</p>
        <p className="text-muted-foreground text-sm">Esta área es solo para el equipo de Easycomex.</p>
        <Link href="/casillero" className="font-bold text-accent hover:underline">Ir a mi casillero</Link>
      </div>
    );
  }

  const menu = (
    <nav className="flex flex-col gap-1 p-3">
      {SECCIONES_ADMIN.map(({ id, etiqueta, icono: Icono }) => (
        <Link
          key={id}
          href={`/admin/casillero/${id}`}
          onClick={() => setAbierto(false)}
          className={`flex items-center gap-3 rounded-2xl px-4 py-2.5 text-sm font-bold transition-colors ${
            actual === id ? 'bg-accent text-white' : 'text-white/75 hover:bg-white/10 hover:text-white'
          }`}
        >
          <Icono size={18} />{etiqueta}
        </Link>
      ))}
      <Link href="/casillero" className="mt-4 flex items-center gap-3 rounded-2xl border border-white/15 px-4 py-2.5 text-sm font-bold text-white/75 hover:bg-white/10">
        <Users size={18} />Ver portal del cliente
      </Link>
    </nav>
  );

  return (
    <div className="min-h-screen bg-gray-50 text-foreground lg:flex">
      <aside className="hidden w-64 shrink-0 bg-primary lg:block">
        <div className="sticky top-0">
          <div className="px-6 py-6"><Link href="/admin/casillero/resumen"><span className="font-logo text-2xl tracking-tight"><span className="text-accent">easy</span><span className="text-white">comex</span></span></Link>
            <p className="mt-1 text-xs font-bold uppercase tracking-wider text-white/50">Portal administrador</p></div>
          {menu}
        </div>
      </aside>

      {abierto && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setAbierto(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 overflow-y-auto bg-primary">
            <div className="flex items-center justify-between px-6 py-5"><span className="font-logo text-xl"><span className="text-accent">easy</span><span className="text-white">comex</span></span>
              <button onClick={() => setAbierto(false)} className="text-white bg-transparent border-0 cursor-pointer"><X /></button></div>
            {menu}
          </aside>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-100 bg-white/95 px-4 backdrop-blur-xl md:px-8">
          <div className="flex items-center gap-3">
            <button className="lg:hidden bg-transparent border-0 cursor-pointer" onClick={() => setAbierto(true)} aria-label="Menú"><Menu /></button>
            <span className="lg:hidden"><Logo /></span>
            <span className="hidden sm:flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-secondary-foreground"><ShieldCheck size={14} />Administrador</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden md:inline text-sm text-muted-foreground">{profile.full_name || user.email}</span>
            <NotificationBell />
            <button onClick={() => void signOut().then(() => navigate('/login'))} className="tap-scale-sm flex items-center gap-2 rounded-full border border-gray-200 bg-transparent px-4 py-2 text-sm font-bold text-foreground hover:bg-gray-50 cursor-pointer">
              <LogOut size={16} />Salir
            </button>
          </div>
        </header>
        <main className="p-4 md:p-8">
          <h1 className="mb-6 text-2xl font-black text-primary md:text-3xl">{titulo}</h1>
          {children}
        </main>
      </div>
    </div>
  );
}
