import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Boxes, CheckCircle2, Download, FileSpreadsheet, PackagePlus, ShoppingCart, Upload, Users, Warehouse, XCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Aparece, AreaTexto, Boton, Campo, Entrada, EstadoVacio, Etiqueta, Modal, PageHeader, PanelLateral, Seccion, Segmentos, Seleccion, Skeleton, Stat, useAsync, cn } from '@/portal/ui';
import DataTable, { type Columna } from '@/portal/DataTable';
import { AreaTendencia, Barras, BarrasHorizontales, COLOR_ORIGEN, Dona, NOMBRE_ORIGEN, PALETA } from '@/portal/charts';
import { csvAObjetos, diaCorto, fechaHora, hace, num } from '@/portal/format';
import { SelectorCliente, useClientes, etiquetaCliente, type ClienteLite } from '@/portal/clientes';
import { leerTodo, useAdmin } from '@/portal/admin';
import { downloadCSV } from '@/lib/csv';
import { api, db } from '@/lib/casillero';
import { ETIQUETA_TIPO, estadoStock, revisarMovimientos, type FilaMovimiento, type MovInv, type ProductoInv } from '@/lib/inventario';

// Inventario de toda la bodega. Aquí el equipo registra lo que entra (uno a
// uno o en lote desde un CSV), ve cómo se mueve el stock de cada cliente y
// atiende lo que falla. Todo pasa por /api/inventario (rol vendedor) y RLS.

interface Global {
  dias: number;
  serie: { dia: string; ventas: number; ingresos: number; devoluciones: number }[];
  por_origen: { origen: string; unidades: number }[];
  top_productos: { sku: string; nombre: string; codigo: string; vendidas: number }[];
  stock_por_cliente: { codigo: string; nombre: string; unidades: number; productos: number }[];
  totales: { productos: number; clientes: number; disponibles: number; vendidos: number; agotados: number; bajos: number };
}
type MovFila = MovInv & { casillero_productos: { sku: string; nombre: string } | null; profiles: { casillero_codigo: string | null; full_name: string | null } | null };
type Filtro = 'todos' | 'bajo' | 'agotado';
type Metrica = 'ventas' | 'ingresos' | 'devoluciones';
const TONO_TIPO = { ingreso: 'azul', venta: 'verde', ajuste: 'gris', devolucion: 'naranja' } as const;

export default function Inventario() {
  const { recargar: recargarStats } = useAdmin();
  const [dias, setDias] = useState(30);
  const cli = useClientes();
  const prods = useAsync(async () => {
    const s = await db();
    return leerTodo<ProductoInv>((a, b) => s.from('casillero_inventario').select('*').order('nombre').order('id').range(a, b), 20_000);
  }, []);
  const glo = useAsync(async () => { const { data, error } = await (await db()).rpc('casillero_inv_global', { p_dias: dias }); if (error) throw error; return data as Global; }, [dias]);
  const movs = useAsync(async () => {
    const { data, error } = await (await db()).from('casillero_inv_mov').select('*, casillero_productos(sku, nombre), profiles(casillero_codigo, full_name)').order('created_at', { ascending: false }).limit(300);
    if (error) throw error;
    return (data ?? []) as MovFila[];
  }, []);

  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [metrica, setMetrica] = useState<Metrica>('ventas');
  const [tipoMov, setTipoMov] = useState<'todos' | MovInv['tipo']>('todos');
  const [detalle, setDetalle] = useState<ProductoInv | null>(null);
  const [form, setForm] = useState<{ userId?: string | null; sku?: string } | null>(null);
  const [lote, setLote] = useState(false);

  const clientes = cli.datos?.clientes ?? [];
  const porId = useMemo(() => new Map(clientes.map((c) => [c.id, c])), [clientes]);
  const productos = prods.datos ?? [];
  const t = glo.datos?.totales;
  const vendidosPeriodo = (glo.datos?.serie ?? []).reduce((a, d) => a + d.ventas, 0);
  const filas = productos.filter((p) => filtro === 'todos' || estadoStock(p) === filtro);
  const porReponer = (t?.agotados ?? 0) + (t?.bajos ?? 0);
  const recargar = async () => { await Promise.all([prods.recargar(), glo.recargar(), movs.recargar(), recargarStats()]); };

  const columnas: Columna<ProductoInv>[] = [
    { clave: 'producto', titulo: 'Producto', movil: 'titulo', orden: (p) => p.nombre.toLowerCase(), celda: (p) => (
      <div className="flex min-w-48 items-center gap-3">
        {p.imagen_url ? <img src={p.imagen_url} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-xl border border-gray-100 object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-accent"><Boxes size={18} /></span>}
        <div className="min-w-0"><p className="truncate font-bold text-primary">{p.nombre}</p><p className="font-mono text-xs text-muted-foreground">{p.sku}</p></div>
      </div>) },
    { clave: 'cliente', titulo: 'Cliente', orden: (p) => porId.get(p.user_id)?.casillero_codigo ?? '', celda: (p) => { const c = porId.get(p.user_id); return <span className="whitespace-nowrap text-muted-foreground">{c ? etiquetaCliente(c) : '—'}</span>; } },
    { clave: 'stock', titulo: 'Disponibles', alinear: 'der', orden: (p) => p.disponibles, celda: (p) => { const e = estadoStock(p); return <b className={cn('tabular-nums', e === 'agotado' ? 'text-red-600' : e === 'bajo' ? 'text-amber-600' : 'text-green-700')}>{num(p.disponibles)}</b>; } },
    { clave: 'total', titulo: 'Recibidas', alinear: 'der', orden: (p) => p.total_unidades, celda: (p) => <span className="tabular-nums text-muted-foreground">{num(p.total_unidades)}</span> },
    { clave: 'vendidos', titulo: 'Vendidas', alinear: 'der', orden: (p) => p.vendidos, celda: (p) => <span className="tabular-nums">{num(p.vendidos)}</span> },
    { clave: 'estado', titulo: 'Estado', orden: (p) => p.disponibles, celda: (p) => { const e = estadoStock(p); return e === 'agotado' ? <Etiqueta tono="rojo">Agotado</Etiqueta> : e === 'bajo' ? <Etiqueta tono="naranja">Stock bajo</Etiqueta> : <Etiqueta tono="verde">En stock</Etiqueta>; } },
  ];

  const columnasMov: Columna<MovFila>[] = [
    { clave: 'cuando', titulo: 'Cuándo', movil: 'titulo', orden: (m) => m.created_at, celda: (m) => <span className="whitespace-nowrap font-semibold text-primary" title={fechaHora(m.created_at)}>{hace(m.created_at)}</span> },
    { clave: 'cliente', titulo: 'Cliente', celda: (m) => <span className="whitespace-nowrap text-muted-foreground">{m.profiles ? etiquetaCliente({ casillero_codigo: m.profiles.casillero_codigo, full_name: m.profiles.full_name, email: null }) : '—'}</span> },
    { clave: 'sku', titulo: 'Producto', celda: (m) => <span className="font-mono text-xs">{m.casillero_productos?.sku ?? '—'}</span> },
    { clave: 'tipo', titulo: 'Tipo', celda: (m) => <Etiqueta tono={TONO_TIPO[m.tipo]}>{ETIQUETA_TIPO[m.tipo]}</Etiqueta> },
    { clave: 'cantidad', titulo: 'Unidades', alinear: 'der', orden: (m) => m.cantidad, celda: (m) => <b className={cn('tabular-nums', m.cantidad < 0 ? 'text-red-600' : 'text-green-700')}>{m.cantidad > 0 ? '+' : ''}{m.cantidad}</b> },
    { clave: 'origen', titulo: 'Origen', celda: (m) => <span className="whitespace-nowrap text-muted-foreground">{NOMBRE_ORIGEN[m.origen] ?? m.origen}</span> },
    { clave: 'ref', titulo: 'Referencia', celda: (m) => <span className="line-clamp-1 text-muted-foreground">{m.referencia ?? '—'}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader titulo="Inventario" subtitulo="La mercancía de todos los clientes en la bodega de Miami. Registre lo que entra, siga cómo se mueve y atienda lo que se agota."
        acciones={<>
          <Boton onClick={() => setLote(true)} icono={<Upload size={15} />}>Ingreso masivo</Boton>
          <Boton variante="primario" onClick={() => setForm({})} icono={<PackagePlus size={16} />}>Registrar movimiento</Boton>
        </>} />

      <Aparece>
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
          <Stat etiqueta="Productos" valor={t?.productos ?? 0} icono={<Boxes size={18} />} pista={`de ${t?.clientes ?? 0} clientes`} cargando={!t} />
          <Stat etiqueta="Disponibles hoy" valor={t?.disponibles ?? 0} formato={(n) => num(Math.round(n))} icono={<Warehouse size={18} />} tono="verde" pista="unidades en la bodega" cargando={!t} />
          <Stat etiqueta={`Vendidas (${dias} d)`} valor={vendidosPeriodo} formato={(n) => num(Math.round(n))} icono={<ShoppingCart size={18} />} tono="oscuro" pista={t ? `${num(t.vendidos)} en total` : undefined} cargando={!glo.datos} />
          <Stat etiqueta="Por reponer" valor={porReponer} icono={<AlertTriangle size={18} />} tono={porReponer ? 'naranja' : 'neutro'} pista={t ? `${t.agotados} agotados · ${t.bajos} con stock bajo` : undefined} cargando={!t} onClick={porReponer ? () => setFiltro(t!.agotados ? 'agotado' : 'bajo') : undefined} />
          <Stat etiqueta="Clientes con stock" valor={glo.datos?.stock_por_cliente.length ?? 0} icono={<Users size={18} />} tono="azul" cargando={!glo.datos} />
        </div>
      </Aparece>

      <div className="grid gap-6 xl:grid-cols-3">
        <Aparece retraso={0.05} className="xl:col-span-2">
          <Seccion titulo="Movimiento de la bodega" ayuda="Unidades por día de todos los clientes."
            acciones={<Segmentos valor={String(dias) as '7' | '30' | '90'} onCambio={(v) => setDias(Number(v))} opciones={[{ valor: '7', etiqueta: '7 d' }, { valor: '30', etiqueta: '30 d' }, { valor: '90', etiqueta: '90 d' }]} />}>
            <Segmentos className="mb-3" valor={metrica} onCambio={setMetrica} opciones={[{ valor: 'ventas', etiqueta: 'Ventas' }, { valor: 'ingresos', etiqueta: 'Ingresos a bodega' }, { valor: 'devoluciones', etiqueta: 'Devoluciones' }]} />
            {!glo.datos ? <Skeleton className="h-60 w-full" /> : (
              <AreaTendencia datos={glo.datos.serie} x="dia" xFormato={diaCorto} leyenda={false} alto={230}
                series={[{ clave: metrica, etiqueta: { ventas: 'Ventas', ingresos: 'Ingresos a bodega', devoluciones: 'Devoluciones' }[metrica], color: { ventas: PALETA.naranja, ingresos: PALETA.marino, devoluciones: PALETA.verde }[metrica] }]}
                resumen={`${metrica} por día en los últimos ${dias} días`} />
            )}
          </Seccion>
        </Aparece>
        <Aparece retraso={0.07}>
          <Seccion titulo="Ventas por origen" ayuda={`Últimos ${dias} días.`}>
            {!glo.datos ? <Skeleton className="h-52 w-full" /> : (
              <Dona resumen="Ventas por origen" centro={<><b className="font-heading text-3xl font-black text-primary">{num(vendidosPeriodo)}</b><span className="text-xs text-muted-foreground">unidades</span></>}
                datos={glo.datos.por_origen.map((o) => ({ nombre: NOMBRE_ORIGEN[o.origen] ?? o.origen, valor: o.unidades, color: COLOR_ORIGEN[o.origen] ?? PALETA.gris }))} />
            )}
          </Seccion>
        </Aparece>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Aparece retraso={0.09}>
          <Seccion titulo="Lo más vendido" ayuda={`Productos con más salidas en ${dias} días.`}>
            {!glo.datos ? <Skeleton className="h-44 w-full" /> : <BarrasHorizontales datos={glo.datos.top_productos.map((p) => ({ ...p, etiqueta: `${p.sku} · ${p.codigo}` }))} nombre="etiqueta" valor="vendidas" formato={(n) => `${num(n)} u.`} resumen="Productos más vendidos" />}
          </Seccion>
        </Aparece>
        <Aparece retraso={0.11}>
          <Seccion titulo="Dónde está el stock" ayuda="Unidades disponibles por cliente.">
            {!glo.datos ? <Skeleton className="h-44 w-full" /> : <BarrasHorizontales datos={glo.datos.stock_por_cliente.map((c) => ({ ...c, etiqueta: `${c.codigo} · ${c.nombre ?? ''}` }))} nombre="etiqueta" valor="unidades" color={PALETA.marino} formato={(n) => `${num(n)} u.`} resumen="Stock disponible por cliente" />}
          </Seccion>
        </Aparece>
      </div>

      <Aparece retraso={0.13}>
        <div className="mb-3"><h2 className="font-heading text-xl font-black text-primary">Productos de todos los clientes</h2></div>
        <DataTable
          columnas={columnas} filas={filas} id={(p) => p.id} cargando={prods.cargando} porPagina={25} onFila={setDetalle}
          buscar={(p) => `${p.nombre} ${p.sku} ${porId.get(p.user_id)?.casillero_codigo ?? ''} ${porId.get(p.user_id)?.full_name ?? ''}`} textoBuscar="Buscar por nombre, SKU o cliente"
          filtros={<Segmentos valor={filtro} onCambio={setFiltro} opciones={[{ valor: 'todos', etiqueta: 'Todos', cuenta: productos.length }, { valor: 'bajo', etiqueta: 'Stock bajo', cuenta: productos.filter((p) => estadoStock(p) === 'bajo').length }, { valor: 'agotado', etiqueta: 'Agotados', cuenta: productos.filter((p) => estadoStock(p) === 'agotado').length }]} />}
          exportar={{ nombre: 'inventario', fila: (p) => ({ cliente: porId.get(p.user_id)?.casillero_codigo, nombre_cliente: porId.get(p.user_id)?.full_name, sku: p.sku, producto: p.nombre, recibidas: p.total_unidades, disponibles: p.disponibles, vendidas: p.vendidos, rotacion_pct: p.rotacion, stock_minimo: p.stock_minimo }) }}
          vacio={<EstadoVacio icono={<Boxes size={26} />} titulo={filtro === 'todos' ? 'Todavía no hay productos' : 'Nada por aquí'} texto={filtro === 'todos' ? 'Cuando un cliente cree productos o conecte su tienda, aparecen aquí.' : 'Ningún producto está en este estado.'} />}
          ordenInicial={{ clave: 'stock', asc: true }}
        />
      </Aparece>

      <Aparece retraso={0.15}>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3"><div><h2 className="font-heading text-xl font-black text-primary">Últimos movimientos</h2><p className="text-sm text-muted-foreground">Los 300 más recientes, de todos los clientes.</p></div></div>
        <DataTable
          columnas={columnasMov} filas={(movs.datos ?? []).filter((m) => tipoMov === 'todos' || m.tipo === tipoMov)} id={(m) => m.id} cargando={movs.cargando} porPagina={10}
          buscar={(m) => `${m.casillero_productos?.sku ?? ''} ${m.casillero_productos?.nombre ?? ''} ${m.profiles?.casillero_codigo ?? ''} ${m.referencia ?? ''}`} textoBuscar="Buscar SKU, cliente o referencia"
          filtros={<Segmentos valor={tipoMov} onCambio={setTipoMov} opciones={[{ valor: 'todos', etiqueta: 'Todos' }, { valor: 'ingreso', etiqueta: 'Ingresos' }, { valor: 'venta', etiqueta: 'Ventas' }, { valor: 'devolucion', etiqueta: 'Devoluciones' }, { valor: 'ajuste', etiqueta: 'Ajustes' }]} />}
          exportar={{ nombre: 'movimientos', fila: (m) => ({ fecha: m.created_at, cliente: m.profiles?.casillero_codigo, sku: m.casillero_productos?.sku, tipo: m.tipo, unidades: m.cantidad, origen: m.origen, referencia: m.referencia }) }}
          ordenInicial={{ clave: 'cuando', asc: false }}
        />
      </Aparece>

      <Detalle producto={detalle} cliente={detalle ? porId.get(detalle.user_id)?.casillero_codigo ?? null : null} onCerrar={() => setDetalle(null)} onMover={(p) => { setDetalle(null); setForm({ userId: p.user_id, sku: p.sku }); }} />
      <Movimiento abierto={form !== null} inicial={form ?? {}} clientes={clientes} productos={productos} onCerrar={() => setForm(null)} onListo={recargar} />
      <Lote abierto={lote} onCerrar={() => setLote(false)} onListo={recargar} />
    </div>
  );
}

/* ------------------------------ Detalle de un producto ------------------------------ */
function Detalle({ producto: p, cliente, onCerrar, onMover }: { producto: ProductoInv | null; cliente: string | null; onCerrar: () => void; onMover: (p: ProductoInv) => void }) {
  const m = useAsync(async () => {
    if (!p) return [];
    const { data, error } = await (await db()).from('casillero_inv_mov').select('id, tipo, cantidad, origen, referencia, created_at').eq('producto_id', p.id).order('created_at', { ascending: false }).limit(40);
    if (error) throw error;
    return (data ?? []) as Pick<MovInv, 'id' | 'tipo' | 'cantidad' | 'origen' | 'referencia' | 'created_at'>[];
  }, [p?.id]);
  const e = p ? estadoStock(p) : 'ok';
  return (
    <PanelLateral abierto={!!p} onCerrar={onCerrar} titulo={p?.nombre ?? 'Producto'} descripcion={p ? `${p.sku}${cliente ? ` · cliente ${cliente}` : ''}` : undefined}>
      {p && (
        <>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-2xl bg-white p-3"><p className="text-xs text-muted-foreground">Disponibles</p><p className={cn('font-heading text-2xl font-black', e === 'agotado' ? 'text-red-600' : e === 'bajo' ? 'text-amber-600' : 'text-green-700')}>{num(p.disponibles)}</p></div>
            <div className="rounded-2xl bg-white p-3"><p className="text-xs text-muted-foreground">Recibidas</p><p className="font-heading text-2xl font-black text-primary">{num(p.total_unidades)}</p></div>
            <div className="rounded-2xl bg-white p-3"><p className="text-xs text-muted-foreground">Vendidas</p><p className="font-heading text-2xl font-black text-primary">{num(p.vendidos)}</p></div>
          </div>
          {p.stock_minimo > 0 && <p className="text-sm text-muted-foreground">Avisa al cliente cuando baje de <b className="text-primary">{p.stock_minimo}</b> unidades.</p>}
          <Boton variante="primario" onClick={() => onMover(p)} icono={<PackagePlus size={15} />}>Registrar movimiento</Boton>
          <Seccion titulo="Historial">
            {m.cargando ? <Skeleton className="h-24 w-full" /> : !m.datos?.length ? <p className="text-sm text-muted-foreground">Sin movimientos todavía.</p> : (
              <ul className="divide-y divide-gray-100">
                {m.datos.map((x) => (
                  <li key={x.id} className="flex items-center gap-3 py-2.5 text-sm">
                    <Etiqueta tono={TONO_TIPO[x.tipo]}>{ETIQUETA_TIPO[x.tipo]}</Etiqueta>
                    <div className="min-w-0 flex-1"><p className="truncate text-muted-foreground">{NOMBRE_ORIGEN[x.origen] ?? x.origen}{x.referencia ? ` · ${x.referencia}` : ''}</p><p className="text-xs text-gray-400" title={fechaHora(x.created_at)}>{hace(x.created_at)}</p></div>
                    <b className={cn('tabular-nums', x.cantidad < 0 ? 'text-red-600' : 'text-green-700')}>{x.cantidad > 0 ? '+' : ''}{x.cantidad}</b>
                  </li>
                ))}
              </ul>
            )}
          </Seccion>
        </>
      )}
    </PanelLateral>
  );
}

/* ------------------------------ Registrar un movimiento ------------------------------ */
function Movimiento({ abierto, inicial, clientes, productos, onCerrar, onListo }: {
  abierto: boolean; inicial: { userId?: string | null; sku?: string }; clientes: ClienteLite[]; productos: ProductoInv[]; onCerrar: () => void; onListo: () => Promise<void>;
}) {
  const { getAccessToken } = useAuth();
  const [userId, setUserId] = useState<string | null>(null);
  const [sku, setSku] = useState('');
  const [tipo, setTipo] = useState<MovInv['tipo']>('ingreso');
  const [cantidad, setCantidad] = useState('');
  const [referencia, setReferencia] = useState('');
  const [crear, setCrear] = useState(false);
  const [nombre, setNombre] = useState('');
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => { if (abierto) { setUserId(inicial.userId ?? null); setSku(inicial.sku ?? ''); setTipo('ingreso'); setCantidad(''); setReferencia(''); setCrear(false); setNombre(''); } }, [abierto, inicial.userId, inicial.sku]);

  const cliente = clientes.find((c) => c.id === userId) ?? null;
  const delCliente = useMemo(() => productos.filter((p) => p.user_id === userId), [productos, userId]);
  const existente = delCliente.find((p) => p.sku.toLowerCase() === sku.trim().toLowerCase()) ?? null;
  const n = Number(cantidad);
  const firmada = tipo === 'venta' ? -Math.abs(n) : n;
  const valido = Number.isInteger(n) && n !== 0 && (tipo === 'ajuste' || n > 0 || tipo === 'venta');
  const resultante = existente && valido ? existente.disponibles + firmada : null;

  const enviar = async () => {
    if (!cliente) return toast.error('Elige el cliente');
    if (!sku.trim()) return toast.error('Escribe el SKU');
    if (!valido) return toast.error(tipo === 'ajuste' ? 'La cantidad debe ser un entero distinto de cero' : 'La cantidad debe ser un entero mayor a cero');
    if (!existente && crear && !nombre.trim()) return toast.error('Ponle un nombre al producto nuevo');
    setOcupado(true);
    if (!existente && crear) {
      const { error } = await (await db()).from('casillero_productos').insert({ user_id: cliente.id, sku: sku.trim(), nombre: nombre.trim() });
      if (error) { setOcupado(false); return toast.error(error.code === '23505' ? 'Ese cliente ya tiene un producto con ese SKU' : error.message); }
    }
    const r = await api('/inventario/movimiento', getAccessToken(), { codigo: cliente.casillero_codigo, sku: sku.trim(), tipo, cantidad: firmada, referencia: referencia.trim() || undefined });
    setOcupado(false);
    if (!r.ok) return toast.error(r.message ?? 'No se pudo registrar el movimiento');
    toast.success('Movimiento registrado', { description: `${ETIQUETA_TIPO[tipo]} de ${Math.abs(firmada)} u. · ${sku.trim()} · ${cliente.casillero_codigo}${resultante !== null ? ` · quedan ${resultante}` : ''}` });
    onCerrar();
    await onListo();
  };

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="Registrar movimiento" descripcion="Lo que entra a la bodega, una devolución o un ajuste por conteo. Si la tienda del cliente está conectada con envío de stock, se refleja allá." ancho="max-w-xl">
      <div className="space-y-4">
        <SelectorCliente clientes={clientes} valor={userId} onCambio={setUserId} autoFocus={!inicial.userId} />
        <Campo etiqueta="SKU del producto" id="mv-sku" ayuda={existente ? <span className="font-semibold text-green-700">{existente.nombre} · hay {num(existente.disponibles)} disponibles</span> : cliente && sku.trim() ? 'Este cliente no tiene ese SKU todavía.' : delCliente.length ? `${delCliente.length} productos de este cliente en la lista.` : undefined}>
          <Entrada id="mv-sku" list="mv-skus" autoComplete="off" spellCheck={false} placeholder="CAM-01" value={sku} onChange={(e) => setSku(e.target.value)} />
          <datalist id="mv-skus">{delCliente.map((p) => <option key={p.id} value={p.sku}>{p.nombre}</option>)}</datalist>
        </Campo>
        {cliente && sku.trim() && !existente && (
          <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-orange-900"><input type="checkbox" className="h-4 w-4 accent-[#FF5A36]" checked={crear} onChange={(e) => setCrear(e.target.checked)} />Crear el producto para este cliente</label>
            {crear && <div className="mt-3"><Campo etiqueta="Nombre del producto" id="mv-nombre"><Entrada id="mv-nombre" placeholder="Camiseta básica negra" value={nombre} onChange={(e) => setNombre(e.target.value)} /></Campo></div>}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Tipo" id="mv-tipo"><Seleccion id="mv-tipo" value={tipo} onChange={(e) => setTipo(e.target.value as MovInv['tipo'])}><option value="ingreso">Ingreso a la bodega (+)</option><option value="devolucion">Devolución (+)</option><option value="venta">Venta manual (−)</option><option value="ajuste">Ajuste por conteo (+ o −)</option></Seleccion></Campo>
          <Campo etiqueta="Unidades" id="mv-cant" ayuda={tipo === 'ajuste' ? 'Negativo para restar (−3).' : undefined}><Entrada id="mv-cant" type="number" step="1" inputMode="numeric" placeholder={tipo === 'ajuste' ? '+5 o −3' : '50'} value={cantidad} onChange={(e) => setCantidad(e.target.value)} /></Campo>
        </div>
        <Campo etiqueta="Referencia (opcional)" id="mv-ref" ayuda="Caja, factura, número de guía de entrada…"><Entrada id="mv-ref" maxLength={200} value={referencia} onChange={(e) => setReferencia(e.target.value)} /></Campo>
        {resultante !== null && <p className={cn('flex items-center gap-2 rounded-2xl p-3 text-sm', resultante < 0 ? 'bg-amber-50 text-amber-800' : 'bg-gray-50 text-muted-foreground')}><Warehouse size={16} className="shrink-0" /><span>Stock: {num(existente!.disponibles)} → <b className="text-primary">{num(resultante)}</b>{resultante < 0 && ' · quedaría en negativo'}</span></p>}
        <div className="flex justify-end gap-2"><Boton onClick={onCerrar}>Cancelar</Boton><Boton variante="primario" cargando={ocupado} onClick={() => void enviar()} icono={<CheckCircle2 size={15} />}>Registrar</Boton></div>
      </div>
    </Modal>
  );
}

/* ------------------------------ Ingreso masivo desde un CSV ------------------------------ */
interface ResultadoLote { aplicados: number; fallos: { fila: number; codigo: string; sku: string; error: string }[] }

function Lote({ abierto, onCerrar, onListo }: { abierto: boolean; onCerrar: () => void; onListo: () => Promise<void> }) {
  const { getAccessToken } = useAuth();
  const [texto, setTexto] = useState('');
  const [archivo, setArchivo] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [avance, setAvance] = useState(0);
  const [res, setRes] = useState<ResultadoLote | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (abierto) { setTexto(''); setArchivo(''); setRes(null); setAvance(0); } }, [abierto]);

  const filas = useMemo<FilaMovimiento[]>(() => (texto.trim() ? revisarMovimientos(csvAObjetos(texto)) : []), [texto]);
  const validas = filas.filter((f) => !f.error);
  const malas = filas.filter((f) => f.error);
  const demasiadas = filas.length > 5000;

  const leer = async (f: File | undefined) => {
    if (!f) return;
    if (f.size > 2_000_000) return toast.error('El archivo es demasiado grande (máximo 2 MB)');
    setArchivo(f.name); setTexto(await f.text()); setRes(null);
  };
  const plantilla = () => downloadCSV('plantilla-ingreso.csv', [
    { codigo: 'DM1001', sku: 'CAM-01', tipo: 'ingreso', cantidad: 50, referencia: 'Caja 1 · guía 1Z999' },
    { codigo: 'DM1001', sku: 'PAN-09', tipo: 'ingreso', cantidad: 120, referencia: 'Caja 2' },
    { codigo: 'DM1002', sku: 'GOR-02', tipo: 'devolucion', cantidad: 3, referencia: 'RMA-4' },
  ]);

  const aplicar = async () => {
    setEnviando(true); setAvance(0);
    const fallos: ResultadoLote['fallos'] = [];
    let aplicados = 0;
    for (let i = 0; i < validas.length; i += 500) {
      const trozo = validas.slice(i, i + 500);
      const r = await api<{ aplicados: number; resultados: { fila: number; ok: boolean; error?: string }[] }>('/inventario/movimientos', getAccessToken(), {
        items: trozo.map((f) => ({ codigo: f.codigo, sku: f.sku, tipo: f.tipo, cantidad: f.cantidad, referencia: f.referencia || undefined })),
      });
      if (!r.ok) { for (const f of trozo) fallos.push({ fila: f.fila, codigo: f.codigo, sku: f.sku, error: r.message ?? 'El servidor no respondió' }); }
      else {
        aplicados += r.data.aplicados;
        for (const x of r.data.resultados) if (!x.ok) { const f = trozo[x.fila - 1]; fallos.push({ fila: f.fila, codigo: f.codigo, sku: f.sku, error: x.error ?? 'No se pudo guardar' }); }
      }
      setAvance(Math.min(100, ((i + trozo.length) / validas.length) * 100));
    }
    setEnviando(false);
    setRes({ aplicados, fallos });
    if (aplicados) toast.success(`${num(aplicados)} movimientos aplicados`);
    await onListo();
  };

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="Ingreso masivo" descripcion="Sube un CSV con lo que llegó a la bodega y se registra todo de una vez, cada fila en el cliente que le corresponda." ancho="max-w-3xl">
      {res ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-2xl bg-green-50 p-4 text-green-800"><CheckCircle2 size={22} /><div><p className="font-heading text-lg font-black">{num(res.aplicados)} movimientos aplicados</p>{res.fallos.length > 0 && <p className="text-sm">{res.fallos.length} no se pudieron aplicar.</p>}</div></div>
          {res.fallos.length > 0 && (
            <>
              <ul className="max-h-60 divide-y divide-gray-100 overflow-y-auto rounded-2xl border border-gray-100">
                {res.fallos.slice(0, 100).map((f, i) => <li key={i} className="flex gap-3 px-4 py-2 text-sm"><XCircle size={16} className="mt-0.5 shrink-0 text-red-500" /><span className="min-w-0"><b className="text-primary">Fila {f.fila}</b> · {f.codigo} · <span className="font-mono">{f.sku}</span><br /><span className="text-muted-foreground">{f.error}</span></span></li>)}
              </ul>
              <Boton chico onClick={() => downloadCSV('filas-con-error.csv', res.fallos.map((f) => ({ fila: f.fila, codigo: f.codigo, sku: f.sku, error: f.error })))} icono={<Download size={13} />}>Descargar las filas con error</Boton>
            </>
          )}
          <div className="flex justify-end gap-2"><Boton onClick={() => { setRes(null); setTexto(''); setArchivo(''); }}>Subir otro archivo</Boton><Boton variante="primario" onClick={onCerrar}>Listo</Boton></div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border-2 border-dashed border-gray-200 p-5 text-center">
            <FileSpreadsheet className="mx-auto text-accent" size={28} />
            <p className="mt-2 text-sm font-bold text-primary">{archivo || 'Elige tu archivo CSV'}</p>
            <p className="text-xs text-muted-foreground">Columnas: <code>codigo, sku, tipo, cantidad, referencia</code>. El tipo puede ser ingreso (por defecto), venta, ajuste o devolución.</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <input ref={input} type="file" accept=".csv,.txt,text/csv" className="sr-only" aria-label="Archivo CSV" onChange={(e) => { void leer(e.target.files?.[0]); e.target.value = ''; }} />
              <Boton chico variante="oscuro" onClick={() => input.current?.click()} icono={<Upload size={13} />}>Elegir archivo</Boton>
              <Boton chico onClick={plantilla} icono={<Download size={13} />}>Descargar plantilla</Boton>
            </div>
          </div>
          <Campo etiqueta="O pega las filas aquí" id="lt-texto"><AreaTexto id="lt-texto" rows={4} spellCheck={false} className="font-mono text-xs" placeholder={'codigo,sku,tipo,cantidad,referencia\nDM1001,CAM-01,ingreso,50,Caja 1'} value={texto} onChange={(e) => { setTexto(e.target.value); setArchivo(''); }} /></Campo>

          {filas.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 text-sm"><Etiqueta tono="gris">{num(filas.length)} filas</Etiqueta><Etiqueta tono="verde">{num(validas.length)} listas</Etiqueta>{malas.length > 0 && <Etiqueta tono="rojo">{num(malas.length)} con error</Etiqueta>}</div>
              {demasiadas && <p role="alert" className="rounded-2xl bg-red-50 p-3 text-sm text-red-700">El archivo tiene más de 5,000 filas. Divídelo en partes.</p>}
              <div className="max-h-64 overflow-auto rounded-2xl border border-gray-100">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-50 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground"><tr><th className="px-3 py-2">Fila</th><th className="px-3 py-2">Cliente</th><th className="px-3 py-2">SKU</th><th className="px-3 py-2">Tipo</th><th className="px-3 py-2 text-right">Un.</th><th className="px-3 py-2">Estado</th></tr></thead>
                  <tbody className="[&_td]:border-t [&_td]:border-gray-100 [&_td]:px-3 [&_td]:py-1.5">
                    {[...malas, ...validas].slice(0, 60).map((f) => (
                      <tr key={f.fila} className={f.error ? 'bg-red-50/50' : ''}>
                        <td className="tabular-nums text-muted-foreground">{f.fila}</td><td>{f.codigo || '—'}</td><td className="font-mono text-xs">{f.sku || '—'}</td><td>{f.tipo ? ETIQUETA_TIPO[f.tipo] : '—'}</td>
                        <td className="text-right tabular-nums font-semibold">{f.cantidad > 0 ? '+' : ''}{f.cantidad}</td>
                        <td>{f.error ? <span className="text-xs font-semibold text-red-700">{f.error}</span> : <CheckCircle2 size={15} className="text-green-600" aria-label="Lista" />}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {filas.length > 60 && <p className="text-xs text-muted-foreground">Se muestran las primeras 60 (los errores primero).</p>}
            </div>
          )}

          {enviando && <div role="progressbar" aria-valuenow={Math.round(avance)} aria-valuemin={0} aria-valuemax={100} className="h-2 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${avance}%` }} /></div>}
          <div className="flex flex-wrap items-center justify-end gap-2">
            {malas.length > 0 && validas.length > 0 && <p className="mr-auto text-xs text-muted-foreground">Las filas con error se omiten; el resto se aplica.</p>}
            <Boton onClick={onCerrar}>Cancelar</Boton>
            <Boton variante="primario" cargando={enviando} disabled={!validas.length || demasiadas} onClick={() => void aplicar()} icono={<Upload size={15} />}>Aplicar {validas.length ? num(validas.length) : ''} {validas.length === 1 ? 'movimiento' : 'movimientos'}</Boton>
          </div>
        </div>
      )}
    </Modal>
  );
}
