import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Mail, Save, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Boton, Campo, Entrada, Etiqueta, Segmentos, Seleccion, Skeleton, useAsync, useConfirmar } from '@/portal/ui';
import DataTable, { type Columna } from '@/portal/DataTable';
import Stepper from '@/portal/Stepper';
import { hace, transportista, usd } from '@/portal/format';
import { leerTodo, quien, useAdmin, type Dueno } from '@/portal/admin';
import { ESTADOS_PAQUETE, api, db, type EventoPaquete, type Paquete } from '@/lib/casillero';

type Fila = Paquete & { profiles: Dueno | null };
type Filtro = 'todos' | 'prealertado' | 'recibido' | 'alistamiento' | 'despachado' | 'entregado';

function Detalle({ p, avisar, onCambio }: { p: Fila; avisar: (id: string) => Promise<boolean>; onCambio: () => Promise<void> }) {
  const confirmar = useConfirmar();
  const [peso, setPeso] = useState(p.peso_lb != null ? String(p.peso_lb) : '');
  const [estado, setEstado] = useState<string>(p.estado);
  const [ocupado, setOcupado] = useState(false);
  const ev = useAsync<EventoPaquete[]>(async () => {
    const { data, error } = await (await db()).from('casillero_eventos').select('estado,created_at,nota').eq('paquete_id', p.id).order('created_at');
    if (error) throw error;
    return (data ?? []) as EventoPaquete[];
  }, [p.id, p.estado]);
  const fechas: Record<string, string> = {};
  for (const e of ev.datos ?? []) fechas[e.estado] ??= e.created_at;

  const guardar = async () => {
    const lb = peso.trim() === '' ? null : Number(peso);
    if (lb !== null && (!Number.isFinite(lb) || lb <= 0)) return toast.error('El peso debe ser un número mayor a 0');
    setOcupado(true);
    const { error } = await (await db()).from('casillero_paquetes').update({ peso_lb: lb, estado }).eq('id', p.id);
    if (error) { setOcupado(false); return toast.error(error.message); }
    const mail = estado !== p.estado && (await avisar(p.id));
    setOcupado(false);
    toast.success('Guardado', { description: mail ? 'El cliente fue avisado por correo.' : undefined });
    await onCambio();
  };
  const eliminar = async () => {
    if (!(await confirmar({ titulo: `¿Eliminar el paquete ${p.guia}?`, texto: 'Se borra del sistema junto con su historial. No se puede deshacer.', confirmar: 'Eliminar', peligro: true }))) return;
    const { error } = await (await db()).from('casillero_paquetes').delete().eq('id', p.id);
    if (error) return toast.error(error.message);
    toast.success('Paquete eliminado'); await onCambio();
  };

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_1.3fr]">
      <div><p className="mb-3 text-xs font-black uppercase tracking-widest text-muted-foreground">Seguimiento</p>{ev.cargando ? <Skeleton className="h-44 w-full" /> : <Stepper estado={p.estado} fechas={fechas} />}</div>
      <div className="space-y-4">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div><dt className="text-xs text-muted-foreground">Cliente</dt><dd className="font-semibold">{quien(p.profiles)}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Correo</dt><dd className="truncate font-semibold">{p.profiles?.email ?? '—'}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Tienda · contenido</dt><dd className="font-semibold">{p.proveedor ?? '—'} · {p.descripcion ?? '—'}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Valor declarado</dt><dd className="font-semibold">{usd(p.valor_declarado)}</dd></div>
        </dl>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo etiqueta="Peso (lb)" id={`pw-${p.id}`}><Entrada id={`pw-${p.id}`} type="number" step="0.01" min="0" value={peso} onChange={(e) => setPeso(e.target.value)} /></Campo>
          <Campo etiqueta="Estado" id={`pe-${p.id}`}><Seleccion id={`pe-${p.id}`} value={estado} onChange={(e) => setEstado(e.target.value)}>{ESTADOS_PAQUETE.map((s) => <option key={s} value={s}>{s}</option>)}</Seleccion></Campo>
        </div>
        <div className="flex flex-wrap gap-2">
          <Boton variante="primario" chico cargando={ocupado} onClick={() => void guardar()} icono={<Save size={13} />}>Guardar</Boton>
          <Boton chico onClick={() => void avisar(p.id).then((ok) => (ok ? toast.success('Correo enviado') : toast.message('No se envió: el estado actual no tiene aviso o el correo no está configurado')))} icono={<Mail size={13} />}>Avisar al cliente</Boton>
          <Boton chico variante="peligro" onClick={() => void eliminar()} icono={<Trash2 size={13} />}>Eliminar</Boton>
        </div>
      </div>
    </div>
  );
}

export default function Paquetes() {
  const { getAccessToken } = useAuth();
  const { recargar: recargarStats } = useAdmin();
  const confirmar = useConfirmar();
  const d = useAsync(async () => {
    const s = await db();
    return leerTodo<Fila>((a, b) => s.from('casillero_paquetes').select('*, profiles(full_name, casillero_codigo, email)').order('created_at', { ascending: false }).order('id').range(a, b), 10_000);
  }, []);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [sel, setSel] = useState<string[]>([]);
  const [lote, setLote] = useState('recibido');
  const filas = d.datos ?? [];
  const visibles = useMemo(() => filas.filter((p) => filtro === 'todos' || p.estado === filtro), [filas, filtro]);
  const cuenta = (f: Filtro) => (f === 'todos' ? filas.length : filas.filter((p) => p.estado === f).length);

  const avisar = async (id: string) => { const r = await api<{ enviado: boolean }>(`/casillero/paquetes/${id}/avisar`, getAccessToken()); return r.ok && r.data.enviado; };
  const cambio = async () => { await Promise.all([d.recargar(), recargarStats()]); };
  const aplicarLote = async () => {
    if (!(await confirmar({ titulo: `Pasar ${sel.length} paquetes a “${lote}”`, texto: 'Se avisará por correo a cada cliente cuando el estado tenga aviso.', confirmar: 'Aplicar' }))) return;
    const { error } = await (await db()).from('casillero_paquetes').update({ estado: lote }).in('id', sel);
    if (error) return toast.error(error.message);
    await Promise.all(sel.map((id) => avisar(id)));
    toast.success(`${sel.length} paquetes ahora están en ${lote}`);
    setSel([]); await cambio();
  };

  const columnas: Columna<Fila>[] = [
    { clave: 'guia', titulo: 'Guía', movil: 'titulo', orden: (p) => p.guia, celda: (p) => { const c = transportista(p.guia); return <div><b className="break-all font-mono text-[13px] text-primary">{p.guia}</b>{c && <span className="ml-2 rounded-full px-2 py-0.5 text-[10px] font-black text-white" style={{ background: c.color }}>{c.nombre}</span>}</div>; } },
    { clave: 'cliente', titulo: 'Cliente', orden: (p) => p.profiles?.casillero_codigo ?? '', celda: (p) => <span className="whitespace-nowrap">{quien(p.profiles)}</span> },
    { clave: 'contenido', titulo: 'Contenido', celda: (p) => <span className="line-clamp-1 text-muted-foreground">{p.descripcion ?? p.proveedor ?? '—'}</span> },
    { clave: 'peso', titulo: 'Peso', alinear: 'der', orden: (p) => p.peso_lb ?? 0, celda: (p) => (p.peso_lb != null ? `${p.peso_lb} lb` : <span className="text-gray-300">—</span>) },
    { clave: 'estado', titulo: 'Estado', orden: (p) => p.estado, celda: (p) => <Etiqueta estado={p.estado} /> },
    { clave: 'fecha', titulo: 'Registrado', orden: (p) => p.created_at, celda: (p) => <span className="text-muted-foreground">{hace(p.created_at)}</span> },
  ];

  return (
    <div>
      <div className="mb-6"><h1 className="font-heading text-2xl font-black text-primary md:text-3xl">Paquetes</h1><p className="mt-1 text-sm text-muted-foreground">Todos los paquetes de todos los clientes. Toca uno para editarlo.</p></div>
      <DataTable
        columnas={columnas} filas={visibles} id={(p) => p.id} cargando={d.cargando} porPagina={25}
        buscar={(p) => `${p.guia} ${p.descripcion ?? ''} ${p.proveedor ?? ''} ${p.profiles?.casillero_codigo ?? ''} ${p.profiles?.full_name ?? ''}`} textoBuscar="Buscar guía, cliente o contenido"
        filtros={<Segmentos valor={filtro} onCambio={setFiltro} opciones={[{ valor: 'todos', etiqueta: 'Todos', cuenta: cuenta('todos') }, { valor: 'prealertado', etiqueta: 'Prealertados', cuenta: cuenta('prealertado') }, { valor: 'recibido', etiqueta: 'En bodega', cuenta: cuenta('recibido') }, { valor: 'alistamiento', etiqueta: 'Alistamiento', cuenta: cuenta('alistamiento') }, { valor: 'despachado', etiqueta: 'Despachados', cuenta: cuenta('despachado') }, { valor: 'entregado', etiqueta: 'Entregados', cuenta: cuenta('entregado') }]} />}
        exportar={{ nombre: 'paquetes', fila: (p) => ({ guia: p.guia, cliente: quien(p.profiles), contenido: p.descripcion, peso_lb: p.peso_lb, estado: p.estado, registrado: p.created_at }) }}
        seleccion={{ ids: sel, onCambio: setSel }}
        barraSeleccion={<><b>{sel.length} seleccionados</b><span className="text-muted-foreground">pasar a</span><Seleccion aria-label="Nuevo estado" className="!w-auto !py-1.5" value={lote} onChange={(e) => setLote(e.target.value)}>{ESTADOS_PAQUETE.map((s) => <option key={s}>{s}</option>)}</Seleccion><Boton chico variante="oscuro" onClick={() => void aplicarLote()}>Aplicar</Boton><Boton chico onClick={() => setSel([])}>Limpiar</Boton></>}
        expandida={(p) => <Detalle p={p} avisar={avisar} onCambio={cambio} />}
        ordenInicial={{ clave: 'fecha', asc: false }}
      />
    </div>
  );
}
