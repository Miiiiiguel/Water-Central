import { ReactNode, useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import NotificationBell from '@/components/NotificationBell';
import { useMarcaDMatrix } from '@/lib/marca';

export interface ItemMenu {
  ruta: string;
  etiqueta: string;
}

/**
 * Marco del casillero: barra roja de DMatrixUSA, menú de secciones y la
 * puerta de entrada. Quien no ha iniciado sesión va al login de
 * Easycomex y vuelve aquí (?next=); quien no es del equipo no entra al
 * panel de administración (eso además lo impone RLS en la base).
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
  useMarcaDMatrix();

  useEffect(() => {
    if (!loading && !user) navigate('/casillero/login');
  }, [loading, user, navigate]);

  if (loading || !user || !profile) return <div className="min-h-screen bg-neutral-50" />;
  if (soloEquipo && profile.role !== 'vendedor') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3">
        <p>Esta sección es solo para el equipo de DMatrixUSA.</p>
        <Link href="/casillero" className="text-[#b01c2e] underline">Ir a mi casillero</Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between bg-white px-4 shadow">
        <Link href="/casillero"><img src="/dmatrix/logo.png" alt="DMatrixUSA" className="h-9" /></Link>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden sm:inline">{profile.full_name}</span>
          {profile.casillero_codigo && <span className="rounded-full bg-[#fbe4e6] px-2 py-0.5 text-xs font-semibold text-[#8e1523]">{profile.casillero_codigo}</span>}
          <NotificationBell />
          <Button variant="ghost" size="sm" onClick={() => void signOut().then(() => navigate('/casillero/login'))}><LogOut className="mr-1 h-4 w-4" />Salir</Button>
        </div>
      </header>
      <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4 md:flex-row">
        <nav className="flex gap-1 overflow-x-auto md:w-52 md:flex-col md:shrink-0">
          {menu.map((m) => (
            <Link
              key={m.ruta}
              href={m.ruta}
              className={`whitespace-nowrap rounded px-3 py-2 text-sm ${actual === m.ruta ? 'bg-[#fbe4e6] font-bold text-[#8e1523]' : 'hover:bg-neutral-100'}`}
            >
              {m.etiqueta}
            </Link>
          ))}
        </nav>
        <main className="min-w-0 flex-1">
          <h1 className="mb-4 text-2xl font-semibold">{titulo}</h1>
          {children}
        </main>
      </div>
    </div>
  );
}

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`mb-4 overflow-x-auto rounded-lg bg-white p-4 shadow-sm ${className}`}>{children}</section>;
}

export function Etiqueta({ valor }: { valor: string }) {
  const bueno = ['recibido', 'aprobado', 'entregado'].includes(valor);
  const malo = ['rechazado', 'cancelado'].includes(valor);
  const azul = valor === 'despachado';
  const cls = bueno ? 'bg-green-100 text-green-800' : malo ? 'bg-red-100 text-red-800' : azul ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800';
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${cls}`}>{valor}</span>;
}
