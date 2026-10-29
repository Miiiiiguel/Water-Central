import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Boxes, CheckCircle2, Download, Package, Pencil, ShoppingCart, Trash2, Warehouse } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Entrada, Panel } from '@/components/CasilleroShell';
import { downloadCSV } from '@/lib/csv';
import { api, db, fecha } from '@/lib/casillero';
import { ETIQUETA_TIPO, enRango, totales, type Integracion, type LlaveApi, type MovInv, type ProductoInv } from '@/lib/inventario';

// Inventario del cliente (fulfillment) y sus integraciones con Shopify y
// WordPress/WooCommerce. Lo lee el navegador con RLS; las llaves de las
// tiendas y los webhooks los maneja el servidor (server/inventario).

const L = ({ children }: { children: ReactNode }) => <Label className="mb-1.5 block">{children}</Label>;
const Boton = ({ children, ...p }: React.ComponentProps<typeof Button>) => <Button size="sm" className="rounded-full font-bold" {...p}>{children}</Button>;
const BotonAcento = ({ children, ...p }: React.ComponentProps<typeof Button>) => <Button className="rounded-full bg-accent hover:bg-accent/90 text-white font-bold" {...p}>{children}</Button>;

function Tarjeta({ titulo, valor, icono, tono }: { titulo: string; valor: number; icono: ReactNode; tono: 'rojo' | 'azul' | 'verde' | 'naranja' }) {
  const t = { rojo: 'bg-red-50 text-red-700', azul: 'bg-blue-50 text-blue-700', verde: 'bg-green-50 text-green-700', naranja: 'bg-orange-50 text-orange-700' }[tono];
  return (
    <div className={`flex items-center justify-between rounded-3xl p-6 ${t}`}>
      <div><p className="text-xs font-bold uppercase tracking-widest">{titulo}</p><p className="mt-2 text-4xl font-black">{valor.toLocaleString('en-US')}</p></div>
      <div className="opacity-80">{icono}</div>
    </div>
  );
}

/* ------------------------------ Inventario ------------------------------ */
export function Inventario() {
  const { user } = useAuth();
  const [productos, setProductos] = useState<ProductoInv[]>([]);
  const [cargando, setCargando] = useState(true);
  const [q, setQ] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [editando, setEditando] = useState<Partial<ProductoInv> | null>(null);
  const [historial, setHistorial] = useState<ProductoInv | null>(null);

  const recargar = useCallback(async () => {
    const { data, error } = await (await db()).from('casillero_inventario').select('*').order('nombre');
    if (error) toast.error(error.message);
    setProductos((data ?? []) as ProductoInv[]);
    setCargando(false);
  }, []);
  useEffect(() => { void recargar(); }, [recargar]);

  const visibles = useMemo(() => productos.filter((p) => `${p.sku} ${p.nombre} ${p.descripcion ?? ''}`.toLowerCase().includes(q.toLowerCase())), [productos, q]);
  const t = totales(productos);

  const descargar = async () => {
    const { data, error } = await (await db()).from('casillero_inv_mov').select('*, casillero_productos(sku, nombre)').order('created_at', { ascending: false }).limit(5000);
    if (error) return toast.error(error.message);
    const movs = enRango((data ?? []) as MovInv[], desde, hasta);
    if (!movs.length) return toast.message('No hay movimientos en ese rango.');
    downloadCSV(`inventario-${desde || 'inicio'}-${hasta || 'hoy'}.csv`, movs.map((m) => ({ fecha: m.created_at, sku: m.casillero_productos?.sku, producto: m.casillero_productos?.nombre, tipo: ETIQUETA_TIPO[m.tipo], cantidad: m.cantidad, origen: m.origen, referencia: m.referencia })));
  };

  const guardar = async () => {
    if (!editando || !user) return;
    const sku = (editando.sku ?? '').trim();
    const nombre = (editando.nombre ?? '').trim();
    if (!sku || !nombre) return toast.error('SKU y nombre son obligatorios');
    const fila = { sku, nombre, descripcion: editando.descripcion?.trim() || null, imagen_url: editando.imagen_url?.trim() || null };
    const s = await db();
    const { error } = editando.id ? await s.from('casillero_productos').update(fila).eq('id', editando.id) : await s.from('casillero_productos').insert({ ...fila, user_id: user.id });
    if (error) return toast.error(error.code === '23505' ? 'Ya tienes un producto con ese SKU' : error.message);
    toast.success('Producto guardado');
    setEditando(null);
    await recargar();
  };
  const borrar = async (p: ProductoInv) => {
    if (!confirm(`¿Eliminar ${p.nombre}?`)) return;
    const { error } = await (await db()).from('casillero_productos').delete().eq('id', p.id);
    if (error) toast.error('No se puede eliminar un producto con movimientos de stock.'); else await recargar();
  };

  return (
    <>
      <p className="mb-4 text-sm text-muted-foreground">Tu stock en la bodega de Miami. Lo que entra lo registra el equipo al recibirlo; las ventas llegan solas desde tu tienda (ver Integraciones).</p>
      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Tarjeta titulo="Productos" valor={t.productos} tono="rojo" icono={<Package size={34} />} />
        <Tarjeta titulo="Total unidades" valor={t.totalUnidades} tono="azul" icono={<Warehouse size={34} />} />
        <Tarjeta titulo="Disponibles" valor={t.disponibles} tono="verde" icono={<CheckCircle2 size={34} />} />
        <Tarjeta titulo="Vendidos" valor={t.vendidos} tono="naranja" icono={<ShoppingCart size={34} />} />
      </div>

      <Panel>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div><L>Desde</L><Entrada type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></div>
          <div><L>Hasta</L><Entrada type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></div>
          <div className="min-w-60 flex-1"><L>Buscar por nombre o SKU</L><Entrada value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <Boton variant="outline" onClick={() => void descargar()}><Download size={14} className="mr-1" />Descargar reporte</Boton>
          <BotonAcento onClick={() => setEditando({})}>Nuevo producto</BotonAcento>
        </div>
        <p className="mb-3 -mt-1 text-xs text-muted-foreground">El rango se aplica al reporte descargable (movimientos del periodo).</p>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-muted-foreground"><th className="p-2">Imagen</th><th>SKU</th><th>Producto</th><th>Descripción</th><th>Total</th><th>Disponibles</th><th>Vendidos</th><th>Rotación</th><th>Acciones</th></tr></thead>
          <tbody>
            {visibles.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-2">{p.imagen_url ? <img src={p.imagen_url} alt="" className="h-10 w-10 rounded-xl object-cover" loading="lazy" /> : <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-accent"><Boxes size={18} /></span>}</td>
                <td className="font-semibold">{p.sku}</td><td>{p.nombre}</td><td className="max-w-56 truncate text-muted-foreground">{p.descripcion}</td>
                <td>{p.total_unidades}</td>
                <td className={p.disponibles <= 0 ? 'font-bold text-red-600' : 'font-bold text-green-700'}>{p.disponibles}</td>
                <td>{p.vendidos}</td><td>{Number(p.rotacion)}%</td>
                <td className="whitespace-nowrap">
                  <Boton variant="outline" onClick={() => setHistorial(p)}>Historial</Boton>{' '}
                  <button className="bg-transparent border-0 cursor-pointer text-muted-foreground hover:text-primary" title="Editar" onClick={() => setEditando(p)}><Pencil size={16} /></button>{' '}
                  <button className="bg-transparent border-0 cursor-pointer text-red-600" title="Eliminar" onClick={() => void borrar(p)}><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
            {!visibles.length && <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">{cargando ? 'Cargando…' : productos.length ? 'Sin resultados.' : 'Aún no tienes productos. Crea el primero o conecta tu tienda en Integraciones para importarlos.'}</td></tr>}
          </tbody>
        </table>
      </Panel>

      {editando && (
        <Modal onCerrar={() => setEditando(null)} titulo={editando.id ? 'Editar producto' : 'Nuevo producto'}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><L>SKU</L><Entrada value={editando.sku ?? ''} onChange={(e) => setEditando({ ...editando, sku: e.target.value })} /></div>
            <div><L>Nombre</L><Entrada value={editando.nombre ?? ''} onChange={(e) => setEditando({ ...editando, nombre: e.target.value })} /></div>
            <div className="sm:col-span-2"><L>Descripción</L><Entrada value={editando.descripcion ?? ''} onChange={(e) => setEditando({ ...editando, descripcion: e.target.value })} /></div>
            <div className="sm:col-span-2"><L>Imagen (enlace)</L><Entrada placeholder="https://…" value={editando.imagen_url ?? ''} onChange={(e) => setEditando({ ...editando, imagen_url: e.target.value })} /></div>
          </div>
          <div className="mt-5 flex gap-2"><BotonAcento onClick={() => void guardar()}>Guardar</BotonAcento><Button variant="outline" className="rounded-full" onClick={() => setEditando(null)}>Cancelar</Button></div>
        </Modal>
      )}
      {historial && <HistorialProducto producto={historial} onCerrar={() => setHistorial(null)} />}
    </>
  );
}

export function Modal({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCerrar}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 app-shadow" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-black text-primary">{titulo}</h2><button className="bg-transparent border-0 text-2xl cursor-pointer" onClick={onCerrar}>×</button></div>
        {children}
      </div>
    </div>
  );
}

function HistorialProducto({ producto, onCerrar }: { producto: ProductoInv; onCerrar: () => void }) {
  const [movs, setMovs] = useState<MovInv[]>([]);
  useEffect(() => {
    void (async () => {
      const { data } = await (await db()).from('casillero_inv_mov').select('*').eq('producto_id', producto.id).order('created_at', { ascending: false }).limit(200);
      setMovs((data ?? []) as MovInv[]);
    })();
  }, [producto.id]);
  return (
    <Modal titulo={`Historial · ${producto.sku}`} onCerrar={onCerrar}>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-muted-foreground"><th className="p-2">Fecha</th><th>Tipo</th><th>Cantidad</th><th>Origen</th><th>Referencia</th></tr></thead>
        <tbody>
          {movs.map((m) => <tr key={m.id} className="border-t"><td className="p-2">{fecha(m.created_at)}</td><td>{ETIQUETA_TIPO[m.tipo]}</td><td className={m.cantidad < 0 ? 'text-red-600' : 'text-green-700'}>{m.cantidad > 0 ? '+' : ''}{m.cantidad}</td><td>{m.origen}</td><td>{m.referencia}</td></tr>)}
          {!movs.length && <tr><td colSpan={5} className="p-4 text-muted-foreground">Sin movimientos todavía.</td></tr>}
        </tbody>
      </table>
    </Modal>
  );
}

/* ------------------------------ Integraciones ------------------------------ */
const NOMBRE: Record<Integracion['plataforma'], string> = { shopify: 'Shopify', woocommerce: 'WordPress (WooCommerce)' };

export function Integraciones() {
  const { getAccessToken } = useAuth();
  const [lista, setLista] = useState<Integracion[]>([]);
  const [llaves, setLlaves] = useState<LlaveApi[]>([]);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [nueva, setNueva] = useState<'shopify' | 'woocommerce' | null>(null);
  const [f, setF] = useState<Record<string, string>>({});
  const [llaveNueva, setLlaveNueva] = useState<string | null>(null);
  const [nombreLlave, setNombreLlave] = useState('');

  const recargar = useCallback(async () => {
    const s = await db();
    const [i, k] = await Promise.all([
      s.from('casillero_integraciones').select('id, plataforma, dominio, estado, ultimo_sync, ultimo_error, sync_stock, created_at').order('created_at'),
      s.from('casillero_api_keys').select('id, nombre, prefijo, ultimo_uso, created_at').order('created_at'),
    ]);
    setLista((i.data ?? []) as Integracion[]);
    setLlaves((k.data ?? []) as LlaveApi[]);
  }, []);
  useEffect(() => { void recargar(); }, [recargar]);

  const llamar = async <T,>(clave: string, ruta: string, cuerpo?: unknown, ok?: (d: T) => string) => {
    setOcupado(clave);
    const r = await api<T>(ruta, getAccessToken(), cuerpo);
    setOcupado(null);
    if (!r.ok) { toast.error(r.message ?? `Error: ${r.error}`); return null; }
    if (ok) toast.success(ok(r.data));
    await recargar();
    return r.data;
  };

  const conectar = async () => {
    if (!nueva) return;
    const cuerpo = nueva === 'shopify' ? { dominio: f.dominio ?? '', token: f.token ?? '', secretoApi: f.secretoApi ?? '' } : { url: f.url ?? '', clave: f.clave ?? '', secreto: f.secreto ?? '' };
    const r = await llamar<{ id: string; nombre: string }>('conectar', `/inventario/integraciones/${nueva}`, cuerpo, (d) => `Conectada: ${d.nombre}`);
    if (r) { setNueva(null); setF({}); await llamar<{ nuevos: number; existentes: number }>(`imp-${r.id}`, `/inventario/integraciones/${r.id}/importar`, {}, (d) => `Catálogo importado: ${d.nuevos} productos nuevos`); }
  };
  const quitar = async (i: Integracion) => {
    if (!confirm(`¿Desconectar ${NOMBRE[i.plataforma]} (${i.dominio})? Se quitan los avisos de ventas; tus productos y su historial se conservan.`)) return;
    setOcupado(`del-${i.id}`);
    const res = await fetch(`/api/inventario/integraciones/${i.id}`, { method: 'DELETE', headers: { authorization: `Bearer ${getAccessToken() ?? ''}` } });
    setOcupado(null);
    if (res.ok) { toast.success('Desconectada'); await recargar(); } else toast.error('No se pudo desconectar');
  };
  const crearLlave = async () => {
    const r = await llamar<{ llave: string }>('llave', '/inventario/llaves', { nombre: nombreLlave || 'Mi sistema' });
    if (r) { setLlaveNueva(r.llave); setNombreLlave(''); }
  };
  const borrarLlave = async (k: LlaveApi) => {
    if (!confirm(`¿Borrar la llave "${k.nombre}"? Los sistemas que la usan dejarán de funcionar.`)) return;
    await fetch(`/api/inventario/llaves/${k.id}`, { method: 'DELETE', headers: { authorization: `Bearer ${getAccessToken() ?? ''}` } });
    await recargar();
  };

  const campo = (k: string, etiqueta: string, ph = '', tipo = 'text') => <div><L>{etiqueta}</L><Entrada type={tipo} placeholder={ph} autoComplete="off" value={f[k] ?? ''} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></div>;
  const base = typeof window === 'undefined' ? '' : window.location.origin;

  return (
    <>
      <Panel>
        <b>Tus tiendas conectadas</b>
        <p className="mt-1 text-sm text-muted-foreground">Cuando vendes en tu tienda, el stock de la bodega baja solo. Si lo activas, también empujamos el stock de la bodega a tu tienda para que nunca vendas lo que no tienes.</p>
        <div className="mt-4 space-y-3">
          {lista.map((i) => (
            <div key={i.id} className="rounded-2xl border border-gray-100 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><b>{NOMBRE[i.plataforma]}</b> <span className="text-muted-foreground">· {i.dominio}</span> <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${i.estado === 'activa' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>{i.estado === 'activa' ? 'Activa' : 'Con error'}</span></div>
                <div className="flex flex-wrap gap-2">
                  <Boton variant="outline" disabled={ocupado !== null} onClick={() => void llamar<{ nuevos: number; existentes: number }>(`imp-${i.id}`, `/inventario/integraciones/${i.id}/importar`, {}, (d) => `${d.nuevos} productos nuevos, ${d.existentes} ya existían`)}>{ocupado === `imp-${i.id}` ? 'Importando…' : 'Importar catálogo'}</Boton>
                  <Boton variant="outline" disabled={ocupado !== null} onClick={() => confirm('Esto deja el stock de tu tienda igual al de la bodega para todos los productos importados. ¿Continuar?') && void llamar<{ actualizados: number; errores: string[] }>(`sync-${i.id}`, `/inventario/integraciones/${i.id}/sincronizar`, {}, (d) => `${d.actualizados} productos actualizados${d.errores.length ? ` (${d.errores.length} con error)` : ''}`)}>{ocupado === `sync-${i.id}` ? 'Sincronizando…' : 'Enviar stock a mi tienda'}</Boton>
                  <Boton variant="outline" disabled={ocupado !== null} onClick={() => void quitar(i)}>Desconectar</Boton>
                </div>
              </div>
              <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={i.sync_stock} onChange={(e) => void llamar('opc', `/inventario/integraciones/${i.id}/opciones`, { syncStock: e.target.checked }, () => e.target.checked ? 'Ahora el stock de tu tienda sigue al de la bodega' : 'Desactivado')} />Mantener el stock de mi tienda igual al de la bodega (automático)</label>
              <p className="mt-1 text-xs text-muted-foreground">Última sincronización: {i.ultimo_sync ? fecha(i.ultimo_sync) : '—'}{i.ultimo_error && <span className="text-red-600"> · {i.ultimo_error}</span>}</p>
            </div>
          ))}
          {!lista.length && <p className="text-sm text-muted-foreground">Aún no has conectado ninguna tienda.</p>}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <BotonAcento onClick={() => { setNueva('shopify'); setF({}); }}>Conectar Shopify</BotonAcento>
          <BotonAcento onClick={() => { setNueva('woocommerce'); setF({}); }}>Conectar WordPress (WooCommerce)</BotonAcento>
        </div>
      </Panel>

      {nueva === 'shopify' && (
        <Panel>
          <b>Conectar Shopify</b>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>En tu Shopify: <b>Configuración → Apps y canales de venta → Desarrollar apps → Crear una app</b>.</li>
            <li>En <b>Configuración de la API de Admin</b> da permisos: <code>read_products</code>, <code>read_orders</code>, <code>read_inventory</code>, <code>write_inventory</code>.</li>
            <li><b>Instala la app</b> y copia el <b>Token de acceso de la API de Admin</b> (se muestra una sola vez) y la <b>Clave secreta de la API</b>.</li>
          </ol>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">{campo('dominio', 'Dominio de tu tienda', 'mi-tienda.myshopify.com')}{campo('token', 'Token de acceso (shpat_…)', '', 'password')}{campo('secretoApi', 'Clave secreta de la API', '', 'password')}</div>
          <div className="mt-4 flex gap-2"><BotonAcento disabled={ocupado !== null} onClick={() => void conectar()}>{ocupado === 'conectar' ? 'Conectando…' : 'Conectar'}</BotonAcento><Button variant="outline" className="rounded-full" onClick={() => setNueva(null)}>Cancelar</Button></div>
        </Panel>
      )}
      {nueva === 'woocommerce' && (
        <Panel>
          <b>Conectar WordPress (WooCommerce)</b>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>En tu WordPress: <b>WooCommerce → Ajustes → Avanzado → API REST → Añadir clave</b>.</li>
            <li>Permisos: <b>Lectura/Escritura</b>. Tu sitio debe usar <b>https</b>.</li>
            <li>Copia la <b>Consumer key</b> (ck_…) y la <b>Consumer secret</b> (cs_…) — se muestran una sola vez.</li>
          </ol>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">{campo('url', 'Dirección de tu sitio', 'https://mitienda.com')}{campo('clave', 'Consumer key', 'ck_…', 'password')}{campo('secreto', 'Consumer secret', 'cs_…', 'password')}</div>
          <div className="mt-4 flex gap-2"><BotonAcento disabled={ocupado !== null} onClick={() => void conectar()}>{ocupado === 'conectar' ? 'Conectando…' : 'Conectar'}</BotonAcento><Button variant="outline" className="rounded-full" onClick={() => setNueva(null)}>Cancelar</Button></div>
        </Panel>
      )}

      <Panel>
        <b>Llaves de API</b>
        <p className="mt-1 text-sm text-muted-foreground">Para conectar cualquier otro sistema (un plugin propio de WordPress, un ERP, una hoja de cálculo). Consulta tu stock y avisa ventas o devoluciones.</p>
        <div className="mt-4 flex flex-wrap items-end gap-3"><div className="min-w-60"><L>Nombre de la llave</L><Entrada placeholder="Mi ERP" value={nombreLlave} onChange={(e) => setNombreLlave(e.target.value)} /></div><BotonAcento disabled={ocupado !== null} onClick={() => void crearLlave()}>Crear llave</BotonAcento></div>
        {llaveNueva && (
          <div className="mt-4 rounded-2xl border border-orange-100 bg-orange-50 p-4 text-sm">
            <b>Guarda esta llave ahora — no se vuelve a mostrar:</b>
            <code className="mt-2 block break-all rounded-xl bg-white p-3 text-xs">{llaveNueva}</code>
            <Boton className="mt-2" variant="outline" onClick={() => { void navigator.clipboard?.writeText(llaveNueva); toast.success('Copiada'); }}>Copiar</Boton>
          </div>
        )}
        <table className="mt-4 w-full text-sm"><tbody>
          {llaves.map((k) => <tr key={k.id} className="border-t"><td className="py-2 font-semibold">{k.nombre}</td><td className="text-muted-foreground">{k.prefijo}…</td><td>{k.ultimo_uso ? `Usada ${fecha(k.ultimo_uso)}` : 'Sin usar'}</td><td className="text-right"><Boton variant="outline" onClick={() => void borrarLlave(k)}>Borrar</Boton></td></tr>)}
          {!llaves.length && <tr><td className="py-2 text-muted-foreground">Sin llaves.</td></tr>}
        </tbody></table>
        <pre className="mt-4 overflow-x-auto rounded-2xl bg-primary p-4 text-xs text-white">{`# Ver tu stock
curl ${base}/api/v1/inventario -H "Authorization: Bearer TU_LLAVE"

# Avisar una venta (la referencia debe ser única por pedido)
curl -X POST ${base}/api/v1/inventario/ventas \\
  -H "Authorization: Bearer TU_LLAVE" -H "Content-Type: application/json" \\
  -d '{"sku":"CAM-01","cantidad":2,"referencia":"pedido-1001"}'

# Avisar una devolución: POST ${base}/api/v1/inventario/devoluciones (mismo cuerpo)`}</pre>
      </Panel>
    </>
  );
}
