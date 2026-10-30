import { useState } from 'react';
import { Link } from 'wouter';
import { toast } from 'sonner';
import { BellPlus, Package, Trash2, Truck } from 'lucide-react';
import { Boton, EstadoVacio, Etiqueta, Segmentos, Skeleton, useAsync, useConfirmar } from '@/portal/ui';
import DataTable, { type Columna } from '@/portal/DataTable';
import Stepper from '@/portal/Stepper';
import { fecha, hace, transportista, usd } from '@/portal/format';
import { useDatos } from '@/portal/datos';
import { db, type EventoPaquete, type Paquete } from '@/lib/casillero';

type Filtro = 'todos' | 'prealertado' | 'recibido' | 'camino' | 'entregado';
const FILTROS: Record<Filtro, (p: Paquete) => boolean> = {
  todos: () => true, prealertado: (p) => p.estado === 'prealertado', recibido: (p) => p.estado === 'recibido',
  camino: (p) => p.estado === 'alistamiento' || p.estado === 'despachado', entregado: (p) => p.estado === 'entregado',
};

function Detalle({ p, onCambio }: { p: Paquete; onCambio: () => Promise<void> }) {
  const confirmar = useConfirmar();
  const ev = useAsync<EventoPaquete[]>(async () => {
    const { data, error } = await (await db()).from('casillero_eventos').select('estado,created_at,nota').eq('paquete_id', p.id).order('created_at');
    if (error) throw error;
    return (data ?? []) as EventoPaquete[];
  }, [p.id, p.estado]);
  const fechas: Record<string, string> = {};
  for (const e of ev.datos ?? []) fechas[e.estado] ??= e.created_at;
  const c = transportista(p.guia);

  const eliminar = async () => {
    if (!(await confirmar({ titulo: '¿Eliminar esta prealerta?', texto: <>Se borra la guía <b>{p.guia}</b>. Podrás volver a prealertarla cuando quieras.</>, confirmar: 'Eliminar', peligro: true }))) return;
    const { error } = await (await db()).from('casillero_paquetes').delete().eq('id', p.id);
    if (error) return toast.error(error.message);
    toast.success('Prealerta eliminada');
    await onCambio();
  };

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_1.2fr]">
      <div>
        <p className="mb-3 text-xs font-black uppercase tracking-widest text-muted-foreground">Seguimiento</p>
        {ev.cargando ? <Skeleton className="h-48 w-full" /> : <Stepper estado={p.estado} fechas={fechas} />}
      </div>
      <div>
        <p className="mb-3 text-xs font-black uppercase tracking-widest text-muted-foreground">Detalle</p>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div><dt className="text-xs text-muted-foreground">Guía</dt><dd className="break-all font-mono font-bold text-primary">{p.guia}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Transportista</dt><dd className="font-semibold">{c?.nombre ?? '—'}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Tienda</dt><dd className="font-semibold">{p.proveedor ?? '—'}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Contenido</dt><dd className="font-semibold">{p.descripcion ?? '—'}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Peso</dt><dd className="font-semibold">{p.peso_lb != null ? `${p.peso_lb} lb` : 'Se pesa al recibirlo'}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Valor declarado</dt><dd className="font-semibold">{usd(p.valor_declarado)}</dd></div>
        </dl>
        <div className="mt-5 flex flex-wrap gap-2">
          {p.estado === 'recibido' && p.peso_lb != null && <Link href="/casillero/despacho"><Boton chico variante="primario" icono={<Truck size={13} />}>Despachar</Boton></Link>}
          {p.estado === 'prealertado' && <Boton chico variante="peligro" icono={<Trash2 size={13} />} onClick={() => void eliminar()}>Eliminar prealerta</Boton>}
        </div>
      </div>
    </div>
  );
}

export default function Paquetes() {
  const { paquetes, cargando, recargar } = useDatos();
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const filas = paquetes.filter(FILTROS[filtro]);
  const cuenta = (f: Filtro) => paquetes.filter(FILTROS[f]).length;

  const columnas: Columna<Paquete>[] = [
    { clave: 'guia', titulo: 'Guía', movil: 'titulo', orden: (p) => p.guia, celda: (p) => { const c = transportista(p.guia); return <div><b className="break-all font-mono text-[13px] text-primary">{p.guia}</b>{c && <span className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-black text-white" style={{ background: c.color }}>{c.nombre}</span>}</div>; } },
    { clave: 'proveedor', titulo: 'Tienda', orden: (p) => p.proveedor ?? '', celda: (p) => p.proveedor ?? '—' },
    { clave: 'descripcion', titulo: 'Contenido', celda: (p) => <span className="line-clamp-1 text-muted-foreground">{p.descripcion ?? '—'}</span> },
    { clave: 'peso', titulo: 'Peso', alinear: 'der', orden: (p) => p.peso_lb ?? 0, celda: (p) => (p.peso_lb != null ? `${p.peso_lb} lb` : <span className="text-gray-400">—</span>) },
    { clave: 'estado', titulo: 'Estado', orden: (p) => p.estado, celda: (p) => <Etiqueta estado={p.estado} /> },
    { clave: 'fecha', titulo: 'Registrado', orden: (p) => p.created_at, celda: (p) => <span title={fecha(p.created_at)} className="text-muted-foreground">{hace(p.created_at)}</span> },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="font-heading text-2xl font-black text-primary md:text-3xl">Mis paquetes</h1><p className="mt-1 text-sm text-muted-foreground">Toca un paquete para ver su seguimiento.</p></div>
        <Link href="/casillero/prealerta"><Boton variante="primario" icono={<BellPlus size={16} />}>Prealertar</Boton></Link>
      </div>
      <DataTable
        columnas={columnas} filas={filas} id={(p) => p.id} cargando={cargando}
        buscar={(p) => `${p.guia} ${p.proveedor ?? ''} ${p.descripcion ?? ''}`} textoBuscar="Buscar por guía, tienda o contenido"
        filtros={<Segmentos valor={filtro} onCambio={setFiltro} opciones={[{ valor: 'todos', etiqueta: 'Todos', cuenta: cuenta('todos') }, { valor: 'prealertado', etiqueta: 'Prealertados', cuenta: cuenta('prealertado') }, { valor: 'recibido', etiqueta: 'En bodega', cuenta: cuenta('recibido') }, { valor: 'camino', etiqueta: 'En camino', cuenta: cuenta('camino') }, { valor: 'entregado', etiqueta: 'Entregados', cuenta: cuenta('entregado') }]} />}
        exportar={{ nombre: 'mis-paquetes', fila: (p) => ({ guia: p.guia, tienda: p.proveedor, contenido: p.descripcion, peso_lb: p.peso_lb, valor_usd: p.valor_declarado, estado: p.estado, registrado: p.created_at }) }}
        expandida={(p) => <Detalle p={p} onCambio={recargar} />}
        ordenInicial={{ clave: 'fecha', asc: false }}
        vacio={paquetes.length === 0
          ? <EstadoVacio icono={<Package size={26} />} titulo="Aún no tienes paquetes" texto="Compra en cualquier tienda de EE. UU. con tu dirección de Miami y prealerta la guía aquí." accion={<Link href="/casillero/prealerta"><Boton variante="primario" icono={<BellPlus size={15} />}>Prealertar mi primer envío</Boton></Link>} />
          : undefined}
      />
    </div>
  );
}
