import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, CircleAlert, Download, Plug, Plus, Send, ShoppingBag, ShoppingCart, Stethoscope, Store, Unplug, Wrench, XCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Aparece, Boton, Campo, EstadoVacio, Entrada, Etiqueta, Modal, PageHeader, Seccion, Segmentos, Skeleton, Stat, useAsync, useConfirmar, cn } from '@/portal/ui';
import DataTable, { type Columna } from '@/portal/DataTable';
import { Barras, Dona, PALETA } from '@/portal/charts';
import { diaCorto, fechaHora, hace, num } from '@/portal/format';
import { etiquetaCliente, useClientes } from '@/portal/clientes';
import { leerTodo, useAdmin } from '@/portal/admin';
import { api, db } from '@/lib/casillero';
import type { Chequeo, EventoIntegracion, Integracion, SinVincular } from '@/lib/inventario';

// Todas las tiendas conectadas por los clientes. El equipo puede hacer lo
// mismo que el cliente (probar, reparar, importar, enviar stock, desconectar)
// porque el servidor deja operar a un vendedor sobre cualquier tienda; las
// llaves de la tienda nunca llegan al navegador.

type Plataforma = Integracion['plataforma'];
type Tienda = Integracion & { user_id: string };
const META: Record<Plataforma, { nombre: string; color: string; icono: typeof Store }> = {
  shopify: { nombre: 'Shopify', color: PALETA.shopify, icono: ShoppingBag },
  woocommerce: { nombre: 'WordPress', color: PALETA.woocommerce, icono: Store },
};
const corto = (dominio: string) => dominio.replace(/^https?:\/\//, '');
const TIPO: Record<EventoIntegracion['tipo'], { t: string; tono: 'verde' | 'rojo' | 'azul' | 'naranja' | 'gris' }> = {
  webhook: { t: 'Venta', tono: 'verde' }, error: { t: 'Error', tono: 'rojo' }, sync: { t: 'Stock enviado', tono: 'azul' }, importar: { t: 'Catálogo', tono: 'azul' }, conexion: { t: 'Conexión', tono: 'gris' }, sin_producto: { t: 'SKU sin producto', tono: 'naranja' },
};

export default function Integraciones() {
  const { getAccessToken } = useAuth();
  const { recargar: recargarStats } = useAdmin();
  const confirmar = useConfirmar();
  const cli = useClientes();
  const d = useAsync(async () => {
    const s = await db();
    const [t, e, v, sv] = await Promise.all([
      leerTodo<Tienda>((a, b) => s.from('casillero_integraciones').select('id, user_id, plataforma, dominio, estado, ultimo_sync, ultimo_error, sync_stock, created_at').order('created_at').order('id').range(a, b)),
      s.from('casillero_integracion_eventos').select('*').order('id', { ascending: false }).limit(300),
      leerTodo<{ integracion_id: string }>((a, b) => s.from('casillero_productos_externos').select('integracion_id, producto_id').order('producto_id').range(a, b)),
      s.from('casillero_skus_sin_producto').select('*').order('ultima', { ascending: false }).limit(200),
    ]);
    if (e.error) throw e.error;
    const vinculados: Record<string, number> = {};
    for (const x of v) vinculados[x.integracion_id] = (vinculados[x.integracion_id] ?? 0) + 1;
    return { tiendas: t, eventos: (e.data ?? []) as EventoIntegracion[], vinculados, sinVincular: (sv.data ?? []) as SinVincular[] };
  }, []);

  const [ocupado, setOcupado] = useState<string | null>(null);
  const [chequeos, setChequeos] = useState<Record<string, Chequeo[]>>({});
  const [filtro, setFiltro] = useState<'todo' | 'ventas' | 'errores' | 'sync'>('todo');
  const [crear, setCrear] = useState<SinVincular | null>(null);

  const clientes = useMemo(() => new Map((cli.datos?.clientes ?? []).map((c) => [c.id, c])), [cli.datos]);
  const nombreCliente = (id: string) => { const c = clientes.get(id); return c ? etiquetaCliente(c) : '—'; };
  const tiendas = d.datos?.tiendas ?? [];
  const eventos = d.datos?.eventos ?? [];
  const tienda = (id: string | null) => tiendas.find((x) => x.id === id);
  const sinVincular = d.datos?.sinVincular ?? [];
  const cambio = async () => { await Promise.all([d.recargar(), recargarStats()]); };

  const llamar = async <T,>(clave: string, ruta: string, cuerpo?: unknown): Promise<T | null> => {
    setOcupado(clave);
    const r = await api<T>(ruta, getAccessToken(), cuerpo);
    setOcupado(null);
    if (!r.ok) { toast.error(r.message ?? `Error: ${r.error}`); await cambio(); return null; }
    return r.data;
  };
  const probar = async (i: Tienda) => {
    const r = await llamar<{ chequeos: Chequeo[] }>(`dx-${i.id}`, `/inventario/integraciones/${i.id}/diagnostico`);
    if (r) { const lista = r.chequeos ?? []; setChequeos((c) => ({ ...c, [i.id]: lista })); lista.every((c) => c.ok) ? toast.success('Todo en orden') : toast.warning('Encontramos algo por revisar'); }
  };
  const reparar = async (i: Tienda) => {
    const r = await llamar<{ creados: number }>(`fix-${i.id}`, `/inventario/integraciones/${i.id}/reparar`);
    if (r) { toast.success('Conexión reparada', { description: `${r.creados} avisos de la tienda quedaron activos.` }); await cambio(); await probar(i); }
  };
  const importar = async (i: Tienda) => {
    const r = await llamar<{ nuevos: number; existentes: number }>(`imp-${i.id}`, `/inventario/integraciones/${i.id}/importar`);
    if (r) { toast.success('Catálogo importado', { description: `${r.nuevos} productos nuevos · ${r.existentes} ya existían.` }); await cambio(); }
  };
  const enviarStock = async (i: Tienda) => {
    if (!(await confirmar({ titulo: 'Enviar el stock a la tienda', texto: <>Deja el stock de <b>{corto(i.dominio)}</b> igual al de la bodega para todos sus productos importados. Si la bodega aún no tiene registrado su inventario, la tienda mostrará 0.</>, confirmar: 'Enviar stock' }))) return;
    const r = await llamar<{ actualizados: number; errores: string[] }>(`sync-${i.id}`, `/inventario/integraciones/${i.id}/sincronizar`);
    if (r) { r.errores.length ? toast.warning(`${r.actualizados} actualizados, ${r.errores.length} con error`, { description: r.errores[0] }) : toast.success(`${r.actualizados} productos actualizados en la tienda`); await cambio(); }
  };
  const automatico = async (i: Tienda, on: boolean) => {
    const r = await llamar(`opc-${i.id}`, `/inventario/integraciones/${i.id}/opciones`, { syncStock: on });
    if (r) { toast.success(on ? 'La tienda seguirá al stock de la bodega' : 'Envío automático de stock desactivado'); await cambio(); }
  };
  const quitar = async (i: Tienda) => {
    if (!(await confirmar({ titulo: `¿Desconectar ${META[i.plataforma].nombre} de ${nombreCliente(i.user_id)}?`, texto: <>Dejamos de recibir las ventas de <b>{corto(i.dominio)}</b> y quitamos los avisos de su tienda. Sus productos y su historial se conservan.</>, confirmar: 'Desconectar', peligro: true }))) return;
    setOcupado(`del-${i.id}`);
    const res = await fetch(`/api/inventario/integraciones/${i.id}`, { method: 'DELETE', headers: { authorization: `Bearer ${getAccessToken() ?? ''}` } });
    setOcupado(null);
    if (res.ok) { toast.success('Tienda desconectada'); await cambio(); } else toast.error('No se pudo desconectar. Intenta de nuevo.');
  };

  const conError = tiendas.filter((t) => t.estado === 'error').length;
  const hoy = Date.now() - 86_400_000;
  const ventas24 = eventos.filter((e) => e.tipo === 'webhook' && new Date(e.created_at).getTime() > hoy).length;
  const porDia = useMemo(() => {
    const dias = Array.from({ length: 14 }, (_, i) => new Date(Date.now() - (13 - i) * 86_400_000).toISOString().slice(0, 10));
    return dias.map((dia) => ({ dia, ventas: eventos.filter((e) => e.tipo === 'webhook' && e.created_at.slice(0, 10) === dia).length, errores: eventos.filter((e) => e.tipo === 'error' && e.created_at.slice(0, 10) === dia).length }));
  }, [eventos]);
  const filas = eventos.filter((e) => filtro === 'todo' || (filtro === 'ventas' && (e.tipo === 'webhook' || e.tipo === 'sin_producto')) || (filtro === 'errores' && e.tipo === 'error') || (filtro === 'sync' && (e.tipo === 'sync' || e.tipo === 'importar' || e.tipo === 'conexion')));

  const columnasTiendas: Columna<Tienda>[] = [
    { clave: 'tienda', titulo: 'Tienda', movil: 'titulo', orden: (t) => t.dominio, celda: (t) => { const I = META[t.plataforma].icono; return (
      <div className="flex min-w-48 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white" style={{ background: META[t.plataforma].color }}><I size={18} /></span><div className="min-w-0"><p className="truncate font-bold text-primary">{corto(t.dominio)}</p><p className="text-xs text-muted-foreground">{META[t.plataforma].nombre}</p></div></div>); } },
    { clave: 'cliente', titulo: 'Cliente', orden: (t) => clientes.get(t.user_id)?.casillero_codigo ?? '', celda: (t) => <span className="whitespace-nowrap text-muted-foreground">{nombreCliente(t.user_id)}</span> },
    { clave: 'productos', titulo: 'Vinculados', alinear: 'der', orden: (t) => d.datos?.vinculados[t.id] ?? 0, celda: (t) => num(d.datos?.vinculados[t.id] ?? 0) },
    { clave: 'stock', titulo: 'Stock auto.', celda: (t) => (t.sync_stock ? <Etiqueta tono="azul">Activo</Etiqueta> : <span className="text-gray-300">—</span>) },
    { clave: 'sync', titulo: 'Última actividad', orden: (t) => t.ultimo_sync ?? '', celda: (t) => <span className="whitespace-nowrap text-muted-foreground">{t.ultimo_sync ? hace(t.ultimo_sync) : 'ninguna'}</span> },
    { clave: 'estado', titulo: 'Estado', orden: (t) => t.estado, celda: (t) => <Etiqueta estado={t.estado} /> },
  ];

  const columnasEv: Columna<EventoIntegracion>[] = [
    { clave: 'cuando', titulo: 'Cuándo', movil: 'titulo', orden: (e) => e.created_at, celda: (e) => <span title={fechaHora(e.created_at)} className="whitespace-nowrap font-semibold text-primary">{hace(e.created_at)}</span> },
    { clave: 'cliente', titulo: 'Cliente', celda: (e) => <span className="whitespace-nowrap text-muted-foreground">{nombreCliente(e.user_id)}</span> },
    { clave: 'tienda', titulo: 'Tienda', celda: (e) => { const t = tienda(e.integracion_id); return t ? <span className="flex items-center gap-2 whitespace-nowrap text-muted-foreground"><span className="h-2 w-2 rounded-full" style={{ background: META[t.plataforma].color }} />{corto(t.dominio)}</span> : <span className="text-gray-300">—</span>; } },
    { clave: 'tipo', titulo: 'Tipo', celda: (e) => <Etiqueta tono={TIPO[e.tipo].tono}>{TIPO[e.tipo].t}{e.tipo === 'sin_producto' && e.resuelto ? ' · resuelto' : ''}</Etiqueta> },
    { clave: 'resumen', titulo: 'Qué pasó', celda: (e) => <span className="text-foreground">{e.resumen}</span> },
  ];

  const detalle = (t: Tienda) => {
    const cx = chequeos[t.id];
    const malo = cx?.some((c) => !c.ok) || t.estado === 'error';
    return (
      <div className="space-y-4">
        {t.ultimo_error && <p className="flex items-start gap-2 rounded-2xl bg-red-50 p-3 text-sm text-red-700"><CircleAlert size={16} className="mt-0.5 shrink-0" /><span>{t.ultimo_error}</span></p>}
        <div className="flex flex-wrap gap-2">
          <Boton chico variante="oscuro" cargando={ocupado === `dx-${t.id}`} onClick={() => void probar(t)} icono={<Stethoscope size={13} />}>Probar conexión</Boton>
          {malo && <Boton chico variante="primario" cargando={ocupado === `fix-${t.id}`} onClick={() => void reparar(t)} icono={<Wrench size={13} />}>Reparar conexión</Boton>}
          <Boton chico cargando={ocupado === `imp-${t.id}`} onClick={() => void importar(t)} icono={<Download size={13} />}>Importar catálogo</Boton>
          <Boton chico cargando={ocupado === `sync-${t.id}`} onClick={() => void enviarStock(t)} icono={<Send size={13} />}>Enviar stock ahora</Boton>
          <Boton chico variante="peligro" cargando={ocupado === `del-${t.id}`} onClick={() => void quitar(t)} icono={<Unplug size={13} />}>Desconectar</Boton>
        </div>
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-white p-3.5">
          <input type="checkbox" className="mt-1 h-4 w-4 accent-[#FF5A36]" checked={t.sync_stock} disabled={ocupado === `opc-${t.id}`} onChange={(e) => void automatico(t, e.target.checked)} />
          <span className="text-sm"><b className="text-primary">Mantener el stock de la tienda igual al de la bodega</b><span className="mt-0.5 block text-xs text-muted-foreground">Cada ingreso, venta o ajuste se refleja en la tienda del cliente. Apagado, la tienda conserva su propio stock.</span></span>
        </label>
        {cx && (
          <ul className="space-y-2 rounded-2xl border border-gray-100 bg-white p-4" aria-label="Resultado de la prueba">
            {cx.map((c) => <li key={c.id} className="flex items-start gap-2.5 text-sm">{c.ok ? <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-green-600" /> : <XCircle size={17} className="mt-0.5 shrink-0 text-red-600" />}<div><p className="font-bold text-primary">{c.titulo}</p><p className="text-xs text-muted-foreground">{c.detalle}</p></div></li>)}
          </ul>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader titulo="Integraciones" subtitulo="Las tiendas Shopify y WordPress que conectaron los clientes. Pruebe, repare y vea qué pasa con cada venta que llega." />

      <Aparece>
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <Stat etiqueta="Tiendas conectadas" valor={tiendas.length} icono={<Plug size={18} />} tono="oscuro" pista={`${tiendas.filter((t) => t.plataforma === 'shopify').length} Shopify · ${tiendas.filter((t) => t.plataforma === 'woocommerce').length} WordPress`} cargando={d.cargando} />
          <Stat etiqueta="Con error" valor={conError} icono={<AlertTriangle size={18} />} tono={conError ? 'naranja' : 'verde'} pista={conError ? 'necesitan atención' : 'todas funcionando'} cargando={d.cargando} />
          <Stat etiqueta="Ventas recibidas 24 h" valor={ventas24} icono={<ShoppingCart size={18} />} tono="azul" pista="avisos de las tiendas" cargando={d.cargando} />
          <Stat etiqueta="SKU sin producto" valor={new Set(sinVincular.map((s) => `${s.user_id}:${s.sku}`)).size} icono={<Plus size={18} />} tono={sinVincular.length ? 'rojo' : 'neutro'} pista="ventas esperando su producto" cargando={d.cargando} />
        </div>
      </Aparece>

      <div className="grid gap-6 xl:grid-cols-3">
        <Aparece retraso={0.05} className="xl:col-span-2">
          <Seccion titulo="Actividad de las tiendas" ayuda="Ventas recibidas y errores por día (últimos 14 días, según los 300 avisos más recientes).">
            {d.cargando ? <Skeleton className="h-52 w-full" /> : <Barras datos={porDia} x="dia" xFormato={diaCorto} alto={210} series={[{ clave: 'ventas', etiqueta: 'Ventas', color: PALETA.verde }, { clave: 'errores', etiqueta: 'Errores', color: PALETA.rojo }]} resumen="Ventas y errores de las tiendas por día" />}
          </Seccion>
        </Aparece>
        <Aparece retraso={0.07}>
          <Seccion titulo="Por plataforma">
            {d.cargando ? <Skeleton className="h-48 w-full" /> : <Dona resumen="Tiendas por plataforma" centro={<><b className="font-heading text-3xl font-black text-primary">{tiendas.length}</b><span className="text-xs text-muted-foreground">tiendas</span></>} datos={(Object.keys(META) as Plataforma[]).map((p) => ({ nombre: META[p].nombre, valor: tiendas.filter((t) => t.plataforma === p).length, color: META[p].color }))} />}
          </Seccion>
        </Aparece>
      </div>

      {sinVincular.length > 0 && (
        <Aparece retraso={0.08}>
          <Seccion titulo="Ventas esperando un producto" ayuda="La tienda vendió un SKU que el cliente no tiene en su inventario. Créalo y esas ventas se descuentan solas.">
            <ul className="divide-y divide-gray-100">
              {sinVincular.slice(0, 30).map((s) => (
                <li key={`${s.user_id}:${s.sku}`} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1"><p className="font-mono text-sm font-bold text-primary">{s.sku}</p><p className="truncate text-xs text-muted-foreground">{nombreCliente(s.user_id)} · {s.pedidos} {s.pedidos === 1 ? 'pedido' : 'pedidos'} · {s.unidades} u. · {hace(s.ultima)}</p></div>
                  <Boton chico variante="primario" onClick={() => setCrear(s)} icono={<Plus size={13} />}>Crear producto</Boton>
                </li>
              ))}
            </ul>
          </Seccion>
        </Aparece>
      )}

      <Aparece retraso={0.1}>
        <div className="mb-3"><h2 className="font-heading text-xl font-black text-primary">Tiendas</h2><p className="text-sm text-muted-foreground">Toca una tienda para probarla, repararla o ver sus acciones.</p></div>
        <DataTable
          columnas={columnasTiendas} filas={tiendas} id={(t) => t.id} cargando={d.cargando} porPagina={10} expandida={detalle}
          buscar={(t) => `${t.dominio} ${t.plataforma} ${nombreCliente(t.user_id)}`} textoBuscar="Buscar tienda o cliente"
          exportar={{ nombre: 'tiendas', fila: (t) => ({ cliente: nombreCliente(t.user_id), plataforma: META[t.plataforma].nombre, tienda: corto(t.dominio), estado: t.estado, productos_vinculados: d.datos?.vinculados[t.id] ?? 0, stock_automatico: t.sync_stock ? 'sí' : 'no', ultima_actividad: t.ultimo_sync }) }}
          vacio={<EstadoVacio icono={<Plug size={26} />} titulo="Ningún cliente ha conectado su tienda" texto="Cuando alguno lo haga desde su portal, aparece aquí con su estado." />}
        />
      </Aparece>

      <Aparece retraso={0.12}>
        <div className="mb-3"><h2 className="font-heading text-xl font-black text-primary">Actividad</h2><p className="text-sm text-muted-foreground">Cada aviso de las tiendas y cada sincronización, de todos los clientes.</p></div>
        <DataTable columnas={columnasEv} filas={filas} id={(e) => String(e.id)} cargando={d.cargando} porPagina={10}
          buscar={(e) => `${e.resumen} ${nombreCliente(e.user_id)}`} textoBuscar="Buscar pedido, SKU o cliente"
          filtros={<Segmentos valor={filtro} onCambio={setFiltro} opciones={[{ valor: 'todo', etiqueta: 'Todo' }, { valor: 'ventas', etiqueta: 'Ventas' }, { valor: 'errores', etiqueta: 'Errores', cuenta: eventos.filter((e) => e.tipo === 'error').length }, { valor: 'sync', etiqueta: 'Sincronización' }]} />}
          ordenInicial={{ clave: 'cuando', asc: false }}
          vacio={<EstadoVacio icono={<Plug size={26} />} titulo="Todavía no hay actividad" texto="Cuando llegue la primera venta de una tienda, la verás aquí." />} />
      </Aparece>

      <CrearProducto sin={crear} cliente={crear ? nombreCliente(crear.user_id) : ''} onCerrar={() => setCrear(null)} onListo={cambio} />
    </div>
  );
}

function CrearProducto({ sin, cliente, onCerrar, onListo }: { sin: SinVincular | null; cliente: string; onCerrar: () => void; onListo: () => Promise<void> }) {
  const [nombre, setNombre] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const crear = async () => {
    if (!sin) return;
    if (!nombre.trim()) return toast.error('Ponle un nombre al producto');
    setOcupado(true);
    const { error } = await (await db()).from('casillero_productos').insert({ user_id: sin.user_id, sku: sin.sku, nombre: nombre.trim() });
    setOcupado(false);
    if (error) return toast.error(error.code === '23505' ? 'Ese cliente ya tiene un producto con ese SKU' : error.message);
    toast.success('Producto creado', { description: `Las ${sin.unidades} unidades vendidas de ${sin.sku} se descontaron del stock.` });
    setNombre(''); onCerrar(); await onListo();
  };
  return (
    <Modal abierto={!!sin} onCerrar={onCerrar} titulo="Crear el producto" descripcion={sin ? `${sin.sku} · ${cliente}` : undefined} ancho="max-w-md">
      <div className="space-y-4">
        <Campo etiqueta="Nombre del producto" id="cp-nombre"><Entrada id="cp-nombre" autoFocus placeholder="Camiseta básica negra" value={nombre} onChange={(e) => setNombre(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void crear()} /></Campo>
        <p className="rounded-2xl bg-gray-50 p-3 text-xs text-muted-foreground">Al crearlo, las ventas pendientes con este SKU se aplican solas, una sola vez. El stock puede quedar en negativo hasta registrar el ingreso a la bodega.</p>
        <div className="flex justify-end gap-2"><Boton onClick={onCerrar}>Cancelar</Boton><Boton variante="primario" cargando={ocupado} onClick={() => void crear()}>Crear producto</Boton></div>
      </div>
    </Modal>
  );
}
