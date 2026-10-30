import { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes, createContext, forwardRef, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { animate, motion, useReducedMotion } from 'framer-motion';
import { AlertTriangle, Check, Copy, Loader2, RotateCcw, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export { Skeleton, cn };

// Kit de diseño del portal (cliente y administrador). Todo el casillero se
// construye con esto para que se vea y se comporte igual en todas partes.

/* ------------------------------ Logo ------------------------------ */
export function Logo({ className = 'text-xl md:text-2xl', claro = false }: { className?: string; claro?: boolean }) {
  return (
    <span className={cn('font-logo tracking-tight', className)}>
      <span className="text-accent">easy</span>
      <span className={claro ? 'text-white' : 'text-primary'}>comex</span>
    </span>
  );
}

/* ------------------------------ Tarjeta y encabezado ------------------------------ */
export function Card({ className, children, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-3xl border border-gray-100 bg-white p-5 app-shadow md:p-6', className)} {...p}>{children}</div>;
}

export function PageHeader({ titulo, subtitulo, acciones }: { titulo: string; subtitulo?: ReactNode; acciones?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-heading text-2xl font-black tracking-tight text-primary md:text-3xl">{titulo}</h1>
        {subtitulo && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{subtitulo}</p>}
      </div>
      {acciones && <div className="flex flex-wrap items-center gap-2">{acciones}</div>}
    </div>
  );
}

export function Seccion({ titulo, ayuda, acciones, children, className }: { titulo: string; ayuda?: ReactNode; acciones?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div><h2 className="text-base font-bold text-primary">{titulo}</h2>{ayuda && <p className="mt-0.5 text-sm text-muted-foreground">{ayuda}</p>}</div>
        {acciones}
      </div>
      {children}
    </Card>
  );
}

/* ------------------------------ Botones ------------------------------ */
type Variante = 'primario' | 'oscuro' | 'suave' | 'fantasma' | 'peligro';
const VARIANTES: Record<Variante, string> = {
  primario: 'bg-accent text-white hover:bg-accent/90 shadow-[0_6px_16px_-6px_rgba(255,90,54,.7)]',
  oscuro: 'bg-primary text-white hover:bg-primary/90',
  suave: 'border border-gray-200 bg-white text-foreground hover:bg-gray-50',
  fantasma: 'bg-transparent text-foreground hover:bg-gray-100',
  peligro: 'border border-red-200 bg-white text-red-600 hover:bg-red-50',
};
export const Boton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; chico?: boolean; cargando?: boolean; icono?: ReactNode }>(
  ({ variante = 'suave', chico, cargando, icono, className, children, disabled, ...p }, ref) => (
    <button
      ref={ref}
      type="button"
      disabled={disabled || cargando}
      className={cn(
        'tap-scale-sm inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-full font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 disabled:cursor-not-allowed disabled:opacity-50',
        chico ? 'px-3.5 py-1.5 text-xs' : 'px-5 py-2.5 text-sm', VARIANTES[variante], className,
      )}
      {...p}
    >
      {cargando ? <Loader2 size={chico ? 13 : 16} className="animate-spin" /> : icono}
      {children}
    </button>
  ),
);
Boton.displayName = 'Boton';

/* ------------------------------ Campos ------------------------------ */
const CAMPO = 'w-full rounded-2xl border border-gray-200 bg-white px-4 py-2.5 text-sm text-foreground outline-none transition-all placeholder:text-gray-400 focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:bg-gray-50 disabled:text-gray-400 aria-[invalid=true]:border-red-400 aria-[invalid=true]:ring-red-100';
export const CLASE_CAMPO = CAMPO;

export function Campo({ etiqueta, ayuda, error, children, className, id }: { etiqueta: string; ayuda?: ReactNode; error?: string | null; children: ReactNode; className?: string; id?: string }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-foreground">{etiqueta}</label>
      {children}
      {error ? <p role="alert" className="mt-1.5 text-xs font-medium text-red-600">{error}</p> : ayuda ? <p className="mt-1.5 text-xs text-muted-foreground">{ayuda}</p> : null}
    </div>
  );
}
export const Entrada = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...p }, ref) => <input ref={ref} className={cn(CAMPO, className)} {...p} />);
Entrada.displayName = 'Entrada';
export const Seleccion = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...p }, ref) => <select ref={ref} className={cn(CAMPO, 'cursor-pointer pr-8', className)} {...p}>{children}</select>);
Seleccion.displayName = 'Seleccion';
export const AreaTexto = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...p }, ref) => <textarea ref={ref} className={cn(CAMPO, 'min-h-24', className)} {...p} />);
AreaTexto.displayName = 'AreaTexto';

/* ------------------------------ Etiquetas de estado ------------------------------ */
const TONOS: Record<string, string> = {
  verde: 'bg-green-50 text-green-700', rojo: 'bg-red-50 text-red-700', azul: 'bg-blue-50 text-blue-700',
  naranja: 'bg-secondary text-secondary-foreground', gris: 'bg-gray-100 text-gray-600', morado: 'bg-violet-50 text-violet-700',
};
const ESTADO_TONO: Record<string, [string, string]> = {
  prealertado: ['naranja', 'Prealertado'], recibido: ['verde', 'En bodega'], alistamiento: ['morado', 'En alistamiento'], despachado: ['azul', 'Despachado'], entregado: ['verde', 'Entregado'],
  solicitado: ['naranja', 'Solicitado'], cancelado: ['rojo', 'Cancelado'],
  pendiente: ['naranja', 'Pendiente'], aprobado: ['verde', 'Aprobado'], rechazado: ['rojo', 'Rechazado'],
  activa: ['verde', 'Activa'], error: ['rojo', 'Con error'],
};
export function Etiqueta({ estado, tono, children }: { estado?: string; tono?: keyof typeof TONOS; children?: ReactNode }) {
  const [t, texto] = estado ? (ESTADO_TONO[estado] ?? ['gris', estado]) : [tono ?? 'gris', ''];
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold', TONOS[t as string])}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />{children ?? texto}
    </span>
  );
}

/* ------------------------------ Número animado y tarjeta de cifra ------------------------------ */
export function Animado({ valor, formato = (n) => String(Math.round(n)), className }: { valor: number; formato?: (n: number) => string; className?: string }) {
  const reducido = useReducedMotion();
  const [mostrado, setMostrado] = useState(reducido ? valor : 0);
  const previo = useRef(0);
  useEffect(() => {
    if (reducido) { setMostrado(valor); return; }
    const c = animate(previo.current, valor, { duration: 0.9, ease: 'easeOut', onUpdate: setMostrado });
    previo.current = valor;
    return () => c.stop();
  }, [valor, reducido]);
  return <span className={cn('tabular-nums', className)}>{formato(mostrado)}</span>;
}

export type TonoStat = 'neutro' | 'oscuro' | 'naranja' | 'verde' | 'azul' | 'rojo';
const STAT: Record<TonoStat, { caja: string; icono: string; sub: string }> = {
  neutro: { caja: 'bg-white border border-gray-100', icono: 'bg-gray-100 text-primary', sub: 'text-muted-foreground' },
  oscuro: { caja: 'bg-gradient-to-br from-primary to-[#2c2a78] text-white', icono: 'bg-white/15 text-white', sub: 'text-white/65' },
  naranja: { caja: 'bg-gradient-to-br from-accent to-[#ff8552] text-white', icono: 'bg-white/20 text-white', sub: 'text-white/80' },
  verde: { caja: 'bg-white border border-gray-100', icono: 'bg-green-50 text-green-600', sub: 'text-muted-foreground' },
  azul: { caja: 'bg-white border border-gray-100', icono: 'bg-blue-50 text-blue-600', sub: 'text-muted-foreground' },
  rojo: { caja: 'bg-white border border-gray-100', icono: 'bg-red-50 text-red-600', sub: 'text-muted-foreground' },
};
export function Stat({ etiqueta, valor, formato, icono, tono = 'neutro', pista, cargando, onClick, children }: {
  etiqueta: string; valor: number; formato?: (n: number) => string; icono?: ReactNode; tono?: TonoStat; pista?: ReactNode; cargando?: boolean; onClick?: () => void; children?: ReactNode;
}) {
  const t = STAT[tono];
  const cuerpo = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className={cn('text-xs font-bold uppercase tracking-wider', t.sub)}>{etiqueta}</p>
        {icono && <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', t.icono)}>{icono}</span>}
      </div>
      {cargando ? <Skeleton className="mt-3 h-9 w-24" /> : <p className="mt-2 font-heading text-3xl font-black tracking-tight"><Animado valor={valor} formato={formato} /></p>}
      {pista && <p className={cn('mt-1 text-xs', t.sub)}>{pista}</p>}
      {children}
    </>
  );
  const cls = cn('block w-full rounded-3xl p-5 text-left app-shadow', t.caja, onClick && 'tap-scale cursor-pointer transition-transform hover:-translate-y-0.5');
  return onClick ? <button type="button" onClick={onClick} className={cls}>{cuerpo}</button> : <div className={cls}>{cuerpo}</div>;
}

/** Entrada escalonada de bloques: aparecen de abajo hacia arriba, una sola vez. */
export function Aparece({ children, retraso = 0, className }: { children: ReactNode; retraso?: number; className?: string }) {
  const reducido = useReducedMotion();
  return (
    <motion.div className={className} initial={reducido ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: retraso, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </motion.div>
  );
}

/* ------------------------------ Estado vacío y progreso ------------------------------ */
export function EstadoVacio({ icono, titulo, texto, accion }: { icono: ReactNode; titulo: string; texto?: ReactNode; accion?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-4 py-10 text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary text-accent">{icono}</span>
      <p className="font-heading text-lg font-extrabold text-primary">{titulo}</p>
      {texto && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{texto}</p>}
      {accion && <div className="mt-4">{accion}</div>}
    </div>
  );
}

export function Progreso({ valor, className, tono = 'accent' }: { valor: number; className?: string; tono?: 'accent' | 'verde' | 'rojo' }) {
  const color = { accent: 'bg-accent', verde: 'bg-green-500', rojo: 'bg-red-500' }[tono];
  return (
    <div className={cn('h-2 overflow-hidden rounded-full bg-gray-100', className)} role="progressbar" aria-valuenow={Math.round(valor)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn('h-full rounded-full transition-all duration-700', color)} style={{ width: `${Math.max(0, Math.min(100, valor))}%` }} />
    </div>
  );
}

/* ------------------------------ Pestañas (control segmentado) ------------------------------ */
export function Segmentos<T extends string>({ valor, onCambio, opciones, className }: { valor: T; onCambio: (v: T) => void; opciones: { valor: T; etiqueta: ReactNode; cuenta?: number }[]; className?: string }) {
  return (
    <div role="tablist" className={cn('inline-flex max-w-full gap-1 overflow-x-auto rounded-full bg-gray-100 p-1', className)}>
      {opciones.map((o) => (
        <button
          key={o.valor} role="tab" type="button" aria-selected={valor === o.valor} onClick={() => onCambio(o.valor)}
          className={cn('flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-bold transition-all', valor === o.valor ? 'bg-white text-primary shadow-sm' : 'bg-transparent text-muted-foreground hover:text-primary')}
        >
          {o.etiqueta}
          {o.cuenta !== undefined && <span className={cn('rounded-full px-1.5 text-[11px]', valor === o.valor ? 'bg-secondary text-secondary-foreground' : 'bg-gray-200 text-gray-600')}>{o.cuenta}</span>}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------ Copiar ------------------------------ */
export function BotonCopiar({ texto, etiqueta = 'Copiar', className }: { texto: string; etiqueta?: string; className?: string }) {
  const [listo, setListo] = useState(false);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      toast.error('No pudimos copiar. Selecciona el texto y cópialo a mano.');
      return;
    }
    setListo(true);
    setTimeout(() => setListo(false), 1800);
  };
  return <Boton chico variante="suave" className={className} onClick={() => void copiar()} icono={listo ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}>{listo ? 'Copiado' : etiqueta}</Boton>;
}

/* ------------------------------ Diálogos ------------------------------ */
// Clases escritas completas para que Tailwind las vea (no se arman con texto).
const ANCHOS = { 'max-w-md': 'sm:max-w-md', 'max-w-lg': 'sm:max-w-lg', 'max-w-xl': 'sm:max-w-xl', 'max-w-2xl': 'sm:max-w-2xl', 'max-w-3xl': 'sm:max-w-3xl', 'max-w-4xl': 'sm:max-w-4xl' } as const;

export function Modal({ abierto, onCerrar, titulo, descripcion, children, ancho = 'max-w-2xl' }: { abierto: boolean; onCerrar: () => void; titulo: string; descripcion?: string; children: ReactNode; ancho?: keyof typeof ANCHOS }) {
  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent className={cn('max-h-[90vh] w-[calc(100%-2rem)] gap-0 overflow-y-auto rounded-3xl p-0', ANCHOS[ancho] ?? ANCHOS['max-w-2xl'])}>
        <DialogHeader className="border-b border-gray-100 px-6 py-5 text-left">
          <DialogTitle className="font-heading text-xl font-black text-primary">{titulo}</DialogTitle>
          {descripcion ? <DialogDescription>{descripcion}</DialogDescription> : <DialogDescription className="sr-only">{titulo}</DialogDescription>}
        </DialogHeader>
        <div className="px-6 py-5">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

export function PanelLateral({ abierto, onCerrar, titulo, descripcion, children }: { abierto: boolean; onCerrar: () => void; titulo: string; descripcion?: string; children: ReactNode }) {
  return (
    <Sheet open={abierto} onOpenChange={(o) => !o && onCerrar()}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto bg-gray-50 p-0 sm:max-w-2xl">
        <SheetHeader className="shrink-0 border-b border-gray-100 bg-white px-6 py-5 text-left">
          <SheetTitle className="font-heading text-xl font-black text-primary">{titulo}</SheetTitle>
          <SheetDescription className={descripcion ? '' : 'sr-only'}>{descripcion ?? titulo}</SheetDescription>
        </SheetHeader>
        <div className="space-y-4 p-5">{children}</div>
      </SheetContent>
    </Sheet>
  );
}

interface OpcionesConfirmar { titulo: string; texto?: ReactNode; confirmar?: string; peligro?: boolean }
const ConfirmarCtx = createContext<((o: OpcionesConfirmar) => Promise<boolean>) | null>(null);

/** Reemplaza confirm() del navegador: un diálogo propio, con foco y teclado, que devuelve true/false. */
export function ConfirmarProvider({ children }: { children: ReactNode }) {
  const [op, setOp] = useState<OpcionesConfirmar | null>(null);
  const resolver = useRef<((v: boolean) => void) | null>(null);
  const confirmar = useCallback((o: OpcionesConfirmar) => new Promise<boolean>((res) => { resolver.current = res; setOp(o); }), []);
  const cerrar = (v: boolean) => { resolver.current?.(v); resolver.current = null; setOp(null); };
  return (
    <ConfirmarCtx.Provider value={confirmar}>
      {children}
      <AlertDialog open={!!op} onOpenChange={(o) => !o && cerrar(false)}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 font-heading font-black text-primary">{op?.peligro && <AlertTriangle className="text-red-500" size={20} />}{op?.titulo}</AlertDialogTitle>
            <AlertDialogDescription asChild><div className="text-sm text-muted-foreground">{op?.texto}</div></AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full font-bold" onClick={() => cerrar(false)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction className={cn('rounded-full font-bold', op?.peligro ? 'bg-red-600 hover:bg-red-700' : 'bg-accent hover:bg-accent/90')} onClick={() => cerrar(true)}>{op?.confirmar ?? 'Confirmar'}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmarCtx.Provider>
  );
}
export function useConfirmar() {
  const c = useContext(ConfirmarCtx);
  if (!c) throw new Error('useConfirmar necesita <ConfirmarProvider>');
  return c;
}

/* ------------------------------ Carga de datos ------------------------------ */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [datos, setDatos] = useState<T | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const recargar = useCallback(async () => {
    try {
      setError(null);
      setDatos(await fnRef.current());
    } catch (e) {
      setError((e as { message?: string })?.message ?? 'No pudimos cargar los datos.');
    } finally {
      setCargando(false);
    }
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void recargar(); }, deps);
  return { datos, cargando, error, recargar, poner: setDatos };
}

export function ErrorCarga({ mensaje, onReintentar }: { mensaje: string; onReintentar?: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
      <X size={18} className="shrink-0" /><span className="min-w-0 flex-1">{mensaje}</span>
      {onReintentar && <Boton chico variante="peligro" onClick={onReintentar}>Reintentar</Boton>}
    </div>
  );
}

/** Barra fija con «Descartar» y «Guardar» que aparece cuando hay cambios sin guardar (y sube sobre la barra inferior del celular). */
export function BarraCambios({ visible, texto, detalle, onDescartar, onGuardar, guardando, deshabilitado, etiqueta = 'Guardar cambios' }: {
  visible: boolean; texto?: string; detalle?: ReactNode; onDescartar: () => void; onGuardar: () => void; guardando?: boolean; deshabilitado?: boolean; etiqueta?: string;
}) {
  if (!visible) return null;
  return (
    <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 border-t border-gray-200 bg-white/95 px-4 py-3 shadow-[0_-8px_24px_-12px_rgba(27,26,69,.25)] backdrop-blur lg:bottom-0 lg:left-64" role="region" aria-label="Cambios sin guardar">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 md:px-4">
        <p className="min-w-0 basis-full text-sm font-semibold text-primary sm:flex-1 sm:basis-0">{texto ?? 'Tienes cambios sin guardar'}{detalle && <span className="font-normal text-muted-foreground"> · {detalle}</span>}</p>
        <Boton className="flex-1 sm:flex-none" onClick={onDescartar} icono={<RotateCcw size={14} />}>Descartar</Boton>
        <Boton className="flex-1 sm:flex-none" variante="primario" cargando={guardando} disabled={deshabilitado} onClick={onGuardar} icono={<Save size={15} />}>{etiqueta}</Boton>
      </div>
    </div>
  );
}
