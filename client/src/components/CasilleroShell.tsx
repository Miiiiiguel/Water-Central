import { InputHTMLAttributes, ReactNode, forwardRef, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import NotificationBell from '@/components/NotificationBell';

export interface ItemMenu {
  ruta: string;
  etiqueta: string;
}

/** El campo de texto de Easycomex (mismo que en login y registro). */
export const CLASE_CAMPO =
  'w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white text-sm focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all';

export const Entrada = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className = '', ...p }, ref) => (
  <input ref={ref} className={`${CLASE_CAMPO} ${className}`} {...p} />
));
Entrada.displayName = 'Entrada';

export function Logo({ className = 'text-xl md:text-2xl' }: { className?: string }) {
  return (
    <span className={`font-logo tracking-tight ${className}`}>
      <span className="text-accent">easy</span>
      <span className="text-primary">comex</span>
    </span>
  );
}

/**
 * Marco del casillero, con la misma cara que el dashboard de Easycomex:
 * encabezado blanco con el logo, pastilla de rol, campanita y salir; el
 * menú de secciones va como pastillas debajo. Quien no ha iniciado sesión
 * va al login de Easycomex y vuelve aquí (?next=); quien no es del equipo
 * no entra al panel de administración (eso además lo impone RLS).
 */
export default function CasilleroShell({ menu, actual, titulo, soloEquipo, children }: {
  menu: ItemMenu[];
  actual: string;
  titulo: string;
  soloEquipo?: boolean;
  children: ReactNode;
}) {
  const { user, profile, loading, signOut } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!loading && !user) navigate(`/login?next=${encodeURIComponent(window.location.pathname)}`);
  }, [loading, user, navigate]);

  if (loading || !user || !profile) return <div className="min-h-screen bg-gray-50" />;
  if (soloEquipo && profile.role !== 'vendedor') {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-foreground">Esta sección es solo para el equipo de Easycomex.</p>
        <Link href="/casillero" className="font-bold text-accent hover:underline">Ir a mi casillero</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-foreground">
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xl border-b border-gray-100 pt-[env(safe-area-inset-top)]">
        <div className="container flex items-center justify-between h-16 md:h-20">
          <Link href="/casillero"><Logo /></Link>
          <div className="flex items-center gap-3">
            <span className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground text-xs font-bold uppercase tracking-wide">
              {profile.role === 'vendedor' ? 'Equipo Easycomex' : `Casillero ${profile.casillero_codigo ?? ''}`}
            </span>
            <span className="hidden md:inline text-sm text-muted-foreground">{profile.full_name || user.email}</span>
            <NotificationBell />
            <button
              onClick={() => void signOut().then(() => navigate('/login'))}
              className="tap-scale-sm flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 hover:bg-gray-50 text-sm font-bold text-foreground transition-colors bg-transparent cursor-pointer"
            >
              <LogOut size={16} />Salir
            </button>
          </div>
        </div>
      </header>
      <div className="container py-6">
        <nav className="mb-6 flex gap-2 overflow-x-auto pb-1">
          {menu.map((m) => (
            <Link
              key={m.ruta}
              href={m.ruta}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                actual === m.ruta ? 'bg-primary text-white' : 'bg-white border border-gray-200 text-foreground hover:bg-gray-100'
              }`}
            >
              {m.etiqueta}
            </Link>
          ))}
        </nav>
        {profile.role === 'vendedor' && <Link href="/admin/casillero/resumen" className="mb-4 inline-flex items-center rounded-full bg-secondary px-4 py-2 text-sm font-bold text-secondary-foreground hover:underline">← Volver al portal del administrador</Link>}
        <main className="min-w-0">
          <h1 className="mb-5 text-2xl md:text-3xl font-black text-primary">{titulo}</h1>
          {children}
        </main>
      </div>
    </div>
  );
}

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`mb-5 overflow-x-auto rounded-3xl border border-gray-100 bg-white p-6 app-shadow ${className}`}>{children}</section>;
}

export function Etiqueta({ valor }: { valor: string }) {
  const bueno = ['recibido', 'aprobado', 'entregado'].includes(valor);
  const malo = ['rechazado', 'cancelado'].includes(valor);
  const azul = valor === 'despachado';
  const cls = bueno ? 'bg-green-50 text-green-700' : malo ? 'bg-red-50 text-red-700' : azul ? 'bg-blue-50 text-blue-700' : 'bg-secondary text-secondary-foreground';
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${cls}`}>{valor}</span>;
}

/** Tarjeta de cifra, como las del dashboard. */
export function Cifra({ etiqueta, valor, acento = false }: { etiqueta: string; valor: string; acento?: boolean }) {
  return (
    <div className={`rounded-3xl p-6 app-shadow ${acento ? 'bg-primary text-white' : 'bg-white border border-gray-100'}`}>
      <p className={`text-sm ${acento ? 'text-white/70' : 'text-muted-foreground'}`}>{etiqueta}</p>
      <p className="mt-1 text-3xl font-black">{valor}</p>
    </div>
  );
}
