import { ReactNode, useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { LogOut, Menu, ShieldCheck, UserRound, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import NotificationBell from '@/components/NotificationBell';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Logo, Skeleton, cn } from './ui';
import { iniciales } from './format';

// Marco de los dos portales. Escritorio: barra lateral. Celular: barra
// inferior con lo principal y un cajón con todo lo demás. Quien no ha
// iniciado sesión va al login y vuelve; el portal del administrador exige
// el rol `vendedor` (la base de datos lo exige también, esto es solo UX).

export interface ItemNav { id: string; etiqueta: string; icono: LucideIcon; ruta: string; grupo?: string; insignia?: number; principal?: boolean }

export default function Shell({ variante, items, actual, titulo, children, pie }: {
  variante: 'cliente' | 'admin';
  items: ItemNav[];
  actual: string;
  titulo?: string;
  children: ReactNode;
  pie?: ReactNode;
}) {
  const { user, profile, loading, signOut } = useAuth();
  const [ruta, navigate] = useLocation();
  const [cajon, setCajon] = useState(false);
  const admin = variante === 'admin';

  useEffect(() => { setCajon(false); }, [ruta]);
  useEffect(() => {
    if (!loading && !user) navigate(`/login?next=${encodeURIComponent(window.location.pathname)}`);
  }, [loading, user, navigate]);
  useEffect(() => { if (titulo) document.title = `${titulo} · Easycomex`; }, [titulo]);

  if (loading || !user || !profile) return <div className="min-h-screen bg-gray-50 p-6"><Skeleton className="h-16 w-full rounded-3xl" /><Skeleton className="mt-6 h-96 w-full rounded-3xl" /></div>;
  if (admin && profile.role !== 'vendedor') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-gray-50 px-4 text-center">
        <ShieldCheck className="text-accent" size={40} />
        <p className="font-heading text-xl font-black text-primary">Portal del administrador</p>
        <p className="max-w-sm text-sm text-muted-foreground">Esta área es solo para el equipo de Easycomex. Si deberías tener acceso, pídele a un administrador que te lo dé desde Equipo.</p>
        <Link href="/casillero" className="font-bold text-accent hover:underline">Ir a mi casillero</Link>
      </div>
    );
  }

  const grupos = items.reduce<Record<string, ItemNav[]>>((a, i) => ((a[i.grupo ?? ''] ??= []).push(i), a), {});
  const principales = items.filter((i) => i.principal).slice(0, 4);

  const enlace = (i: ItemNav, cls = '') => {
    const Icono = i.icono;
    const activo = actual === i.id;
    return (
      <Link
        key={i.id} href={i.ruta} aria-current={activo ? 'page' : undefined}
        className={cn('group flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-bold transition-all', cls,
          admin ? (activo ? 'bg-accent text-white shadow-[0_8px_20px_-8px_rgba(255,90,54,.9)]' : 'text-white/70 hover:bg-white/10 hover:text-white')
                : (activo ? 'bg-primary text-white shadow-[0_8px_20px_-10px_rgba(27,26,69,.8)]' : 'text-foreground/75 hover:bg-gray-100 hover:text-primary'))}
      >
        <Icono size={18} className="shrink-0" /><span className="flex-1 truncate">{i.etiqueta}</span>
        {!!i.insignia && <span className={cn('min-w-5 rounded-full px-1.5 text-center text-[11px] font-black', activo ? 'bg-white/25 text-white' : 'bg-accent text-white')}>{i.insignia}</span>}
      </Link>
    );
  };

  const menu = (
    <nav className="space-y-5 p-3" aria-label="Secciones">
      {Object.entries(grupos).map(([g, lista]) => (
        <div key={g}>
          {g && <p className={cn('mb-1.5 px-3.5 text-[11px] font-black uppercase tracking-widest', admin ? 'text-white/40' : 'text-muted-foreground')}>{g}</p>}
          <div className="space-y-1">{lista.map((i) => enlace(i))}</div>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-gray-50 text-foreground lg:flex">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:font-bold">Saltar al contenido</a>

      <aside className={cn('hidden w-64 shrink-0 lg:block', admin ? 'bg-primary' : 'border-r border-gray-100 bg-white')}>
        <div className="sticky top-0 flex max-h-screen flex-col overflow-y-auto">
          <div className="px-6 pb-3 pt-6">
            <Link href={admin ? '/admin/casillero/resumen' : '/casillero'}><Logo className="text-2xl" claro={admin} /></Link>
            <p className={cn('mt-1 text-[11px] font-black uppercase tracking-widest', admin ? 'text-white/45' : 'text-muted-foreground')}>{admin ? 'Portal administrador' : 'Mi casillero'}</p>
          </div>
          {menu}
          {pie && <div className="mt-auto p-4">{pie}</div>}
        </div>
      </aside>

      {cajon && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menú">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setCajon(false)} />
          <aside className={cn('absolute left-0 top-0 h-full w-72 max-w-[85vw] overflow-y-auto', admin ? 'bg-primary' : 'bg-white')}>
            <div className="flex items-center justify-between px-5 py-5"><Logo className="text-xl" claro={admin} /><button aria-label="Cerrar menú" onClick={() => setCajon(false)} className={cn('cursor-pointer border-0 bg-transparent', admin ? 'text-white' : 'text-primary')}><X /></button></div>
            {menu}
          </aside>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-100 bg-white/90 px-4 pt-[env(safe-area-inset-top)] backdrop-blur-xl md:px-8">
          <div className="flex items-center gap-3">
            <button className="cursor-pointer border-0 bg-transparent text-primary lg:hidden" onClick={() => setCajon(true)} aria-label="Abrir menú"><Menu /></button>
            <span className="lg:hidden"><Logo /></span>
            {admin && <span className="hidden items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-black uppercase tracking-wide text-secondary-foreground sm:flex"><ShieldCheck size={14} />Administrador</span>}
            {!admin && profile.casillero_codigo && <span className="hidden rounded-full bg-secondary px-3 py-1.5 text-xs font-black uppercase tracking-wide text-secondary-foreground sm:block">Casillero {profile.casillero_codigo}</span>}
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex cursor-pointer items-center gap-2 rounded-full border border-gray-200 bg-white py-1 pl-1 pr-3 text-sm font-bold text-primary transition-colors hover:bg-gray-50" aria-label="Mi cuenta">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-black text-white">{iniciales(profile.full_name, user.email)}</span>
                  <span className="hidden max-w-32 truncate md:block">{profile.full_name || user.email}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60 rounded-2xl">
                <DropdownMenuLabel><p className="truncate font-bold text-primary">{profile.full_name}</p><p className="truncate text-xs font-normal text-muted-foreground">{user.email}</p></DropdownMenuLabel>
                <DropdownMenuSeparator />
                {profile.role === 'vendedor' && (admin
                  ? <DropdownMenuItem onClick={() => navigate('/casillero')}><UserRound size={16} className="mr-2" />Ver portal del cliente</DropdownMenuItem>
                  : <DropdownMenuItem onClick={() => navigate('/admin/casillero/resumen')}><ShieldCheck size={16} className="mr-2" />Portal del administrador</DropdownMenuItem>)}
                {!admin && <DropdownMenuItem onClick={() => navigate('/casillero/perfil')}><UserRound size={16} className="mr-2" />Mi perfil</DropdownMenuItem>}
                <DropdownMenuItem onClick={() => void signOut().then(() => navigate('/login'))}><LogOut size={16} className="mr-2" />Salir</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main id="contenido" className="mx-auto w-full max-w-7xl px-4 pb-28 pt-6 md:px-8 md:pt-8 lg:pb-12">{children}</main>
      </div>

      {/* Barra inferior (celular) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden" aria-label="Navegación rápida">
        <div className="mx-auto flex max-w-md items-stretch justify-between px-2 py-1.5">
          {principales.map((i) => {
            const Icono = i.icono; const activo = actual === i.id;
            return (
              <Link key={i.id} href={i.ruta} className={cn('tap-scale-sm relative flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[10px] font-bold', activo ? 'text-accent' : 'text-gray-500')}>
                <Icono size={22} strokeWidth={activo ? 2.6 : 2} />{i.etiqueta}
                {!!i.insignia && <span className="absolute right-[22%] top-0.5 min-w-4 rounded-full bg-accent px-1 text-center text-[9px] font-black text-white">{i.insignia}</span>}
              </Link>
            );
          })}
          <button onClick={() => setCajon(true)} className="tap-scale-sm flex flex-1 cursor-pointer flex-col items-center gap-0.5 rounded-2xl border-0 bg-transparent py-1.5 text-[10px] font-bold text-gray-500"><Menu size={22} />Más</button>
        </div>
      </nav>
    </div>
  );
}
