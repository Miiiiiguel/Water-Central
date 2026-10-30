import { ReactNode, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { toast } from 'sonner';
import { AlertTriangle, ArrowRight, CheckCircle2, CircleAlert, Download, KeyRound, Plug, RefreshCw, Send, ShoppingBag, Stethoscope, Store, Trash2, Unplug, Wrench, XCircle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Aparece, Boton, BotonCopiar, Campo, Card, Entrada, EstadoVacio, Etiqueta, Modal, Seccion, Segmentos, Skeleton, useAsync, useConfirmar, cn } from '@/portal/ui';
import DataTable, { type Columna } from '@/portal/DataTable';
import { fechaHora, hace } from '@/portal/format';
import { api, db } from '@/lib/casillero';
import type { Chequeo, EventoIntegracion, Integracion, LlaveApi } from '@/lib/inventario';

// Conexión con Shopify y WordPress (WooCommerce) y llaves de API. La tienda
// avisa cada pedido con un webhook firmado (server/inventario), y desde aquí
// se conecta, se prueba, se repara y se sigue lo que pasa con cada una.

type Plataforma = Integracion['plataforma'];
const META: Record<Plataforma, { nombre: string; color: string; icono: typeof Store }> = {
  shopify: { nombre: 'Shopify', color: '#5E8E3E', icono: ShoppingBag },
  woocommerce: { nombre: 'WordPress (WooCommerce)', color: '#7F54B3', icono: Store },
};
const corto = (dominio: string) => dominio.replace(/^https?:\/\//, '');

function Logo({ p, g = false }: { p: Plataforma; g?: boolean }) {
  const { icono: I, color } = META[p];
  return <span className={cn('flex shrink-0 items-center justify-center rounded-2xl text-white', g ? 'h-14 w-14' : 'h-11 w-11')} style={{ background: color }}><I size={g ? 26 : 20} /></span>;
}

async function cargarTodo() {
  const s = await db();
  const [i, k, e, v, m] = await Promise.all([
    s.from('casillero_integraciones').select('id, plataforma, dominio, estado, ultimo_sync, ultimo_error, sync_stock, created_at').order('created_at'),
    s.from('casillero_api_keys').select('id, nombre, prefijo, ultimo_uso, created_at').order('created_at'),
    s.from('casillero_integracion_eventos').select('*').order('id', { ascending: false }).limit(150),
    s.from('casillero_skus_sin_producto').select('sku'),
    s.from('casillero_productos_externos').select('integracion_id'),
  ]);
  const vinculados: Record<string, number> = {};
  for (const x of (m.data ?? []) as { integracion_id: string }[]) vinculados[x.integracion_id] = (vinculados[x.integracion_id] ?? 0) + 1;
  return {
    integraciones: (i.data ?? []) as Integracion[], llaves: (k.data ?? []) as LlaveApi[], eventos: (e.data ?? []) as EventoIntegracion[],
    sinVincular: (v.data ?? []).length, vinculados,
  };
}

export default function Integraciones() {
  const { getAccessToken } = useAuth();
  const confirmar = useConfirmar();
  const d = useAsync(cargarTodo, []);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [conectar, setConectar] = useState<Plataforma | null>(null);
  const [chequeos, setChequeos] = useState<Record<string, Chequeo[]>>({});
  const [filtro, setFiltro] = useState<'todo' | 'ventas' | 'errores' | 'sync'>('todo');

  const integraciones = d.datos?.integraciones ?? [];
  const eventos = d.datos?.eventos ?? [];
  const tienda = (id: string | null) => integraciones.find((x) => x.id === id);

  const llamar = async <T,>(clave: string, ruta: string, cuerpo?: unknown): Promise<T | null> => {
    setOcupado(clave);
    const r = await api<T>(ruta, getAccessToken(), cuerpo);
    setOcupado(null);
    if (!r.ok) { toast.error(r.message ?? `Error: ${r.error}`); await d.recargar(); return null; }
    return r.data;
  };

  const probar = async (i: Integracion) => {
    const r = await llamar<{ chequeos: Chequeo[] }>(`dx-${i.id}`, `/inventario/integraciones/${i.id}/diagnostico`);
    if (r) { const lista = r.chequeos ?? []; setChequeos((c) => ({ ...c, [i.id]: lista })); lista.every((c) => c.ok) ? toast.success('Todo en orden') : toast.warning('Encontramos algo por revisar'); }
  };
  const reparar = async (i: Integracion) => {
    const r = await llamar<{ creados: number }>(`fix-${i.id}`, `/inventario/integraciones/${i.id}/reparar`);
    if (r) { toast.success('Conexión reparada', { description: `${r.creados} avisos de tu tienda quedaron activos.` }); await d.recargar(); await probar(i); }
  };
  const importar = async (i: Integracion) => {
    const r = await llamar<{ nuevos: number; existentes: number }>(`imp-${i.id}`, `/inventario/integraciones/${i.id}/importar`);
    if (r) { toast.success('Catálogo importado', { description: `${r.nuevos} productos nuevos · ${r.existentes} ya los tenías.` }); await d.recargar(); }
  };
  const enviarStock = async (i: Integracion) => {
    if (!(await confirmar({ titulo: 'Enviar el stock a tu tienda', texto: <>Esto deja el stock de <b>{corto(i.dominio)}</b> igual al de la bodega para todos los productos importados. Si aún no registraron tus ingresos, tu tienda mostrará 0.</>, confirmar: 'Enviar stock' }))) return;
    const r = await llamar<{ actualizados: number; errores: string[] }>(`sync-${i.id}`, `/inventario/integraciones/${i.id}/sincronizar`);
    if (r) { r.errores.length ? toast.warning(`${r.actualizados} actualizados, ${r.errores.length} con error`, { description: r.errores[0] }) : toast.success(`${r.actualizados} productos actualizados en tu tienda`); await d.recargar(); }
  };
  const automatico = async (i: Integracion, on: boolean) => {
    if (on && !(await confirmar({ titulo: 'Mantener el stock de tu tienda al día', texto: 'Cada vez que cambie el stock de la bodega (ingresos, ventas, ajustes), lo reflejaremos en tu tienda. Asegúrate de que la bodega ya tenga registrado tu inventario.', confirmar: 'Activar' }))) return;
    const r = await llamar(`opc-${i.id}`, `/inventario/integraciones/${i.id}/opciones`, { syncStock: on });
    if (r) { toast.success(on ? 'Activado: tu tienda seguirá al stock de la bodega' : 'Desactivado'); await d.recargar(); }
  };
  const quitar = async (i: Integracion) => {
    if (!(await confirmar({ titulo: `¿Desconectar ${META[i.plataforma].nombre}?`, texto: <>Dejamos de recibir las ventas de <b>{corto(i.dominio)}</b> y quitamos los avisos de tu tienda. Tus productos y su historial se conservan.</>, confirmar: 'Desconectar', peligro: true }))) return;
    setOcupado(`del-${i.id}`);
    const res = await fetch(`/api/inventario/integraciones/${i.id}`, { method: 'DELETE', headers: { authorization: `Bearer ${getAccessToken() ?? ''}` } });
    setOcupado(null);
    if (res.ok) { toast.success('Tienda desconectada'); await d.recargar(); } else toast.error('No se pudo desconectar. Intenta de nuevo.');
  };

  const filas = eventos.filter((e) => filtro === 'todo' || (filtro === 'ventas' && (e.tipo === 'webhook' || e.tipo === 'sin_producto')) || (filtro === 'errores' && e.tipo === 'error') || (filtro === 'sync' && (e.tipo === 'sync' || e.tipo === 'importar' || e.tipo === 'conexion')));
  const TIPO: Record<EventoIntegracion['tipo'], { t: string; tono: 'verde' | 'rojo' | 'azul' | 'naranja' | 'gris' }> = {
    webhook: { t: 'Venta', tono: 'verde' }, error: { t: 'Error', tono: 'rojo' }, sync: { t: 'Stock enviado', tono: 'azul' }, importar: { t: 'Catálogo', tono: 'azul' }, conexion: { t: 'Conexión', tono: 'gris' }, sin_producto: { t: 'SKU sin producto', tono: 'naranja' },
  };
  const columnas: Columna<EventoIntegracion>[] = [
    { clave: 'cuando', titulo: 'Cuándo', movil: 'titulo', orden: (e) => e.created_at, celda: (e) => <span title={fechaHora(e.created_at)} className="whitespace-nowrap font-semibold text-primary">{hace(e.created_at)}</span> },
    { clave: 'tienda', titulo: 'Tienda', celda: (e) => { const t = tienda(e.integracion_id); return t ? <span className="flex items-center gap-2 whitespace-nowrap text-muted-foreground"><span className="h-2 w-2 rounded-full" style={{ background: META[t.plataforma].color }} />{corto(t.dominio)}</span> : <span className="text-gray-300">—</span>; } },
    { clave: 'tipo', titulo: 'Tipo', celda: (e) => <Etiqueta tono={TIPO[e.tipo].tono}>{TIPO[e.tipo].t}{e.tipo === 'sin_producto' && e.resuelto ? ' · resuelto' : ''}</Etiqueta> },
    { clave: 'resumen', titulo: 'Qué pasó', celda: (e) => <span className="text-foreground">{e.resumen}</span> },
  ];

  const base = typeof window === 'undefined' ? '' : window.location.origin;

  return (
    <div className="space-y-6">
      <div><h1 className="font-heading text-2xl font-black text-primary md:text-3xl">Integraciones</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Conecta tu tienda y tu inventario de la bodega se mueve solo con cada venta. Sin hojas de cálculo.</p></div>

      {d.error && <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{d.error} <button onClick={() => void d.recargar()} className="ml-2 cursor-pointer border-0 bg-transparent font-bold underline">Reintentar</button></div>}

      <Aparece>
        <ol className="grid gap-3 md:grid-cols-4">
          {[
            { n: 'Vendes en tu tienda', t: 'Shopify o WordPress registran el pedido.' },
            { n: 'Nos avisa al instante', t: 'Con un aviso firmado, seguro y automático.' },
            { n: 'Se descuenta tu stock', t: 'Por SKU, sin duplicar aunque el aviso se repita.' },
            { n: 'Tu tienda se actualiza', t: 'Opcional: reflejamos el stock real de la bodega.' },
          ].map((p, i) => (
            <li key={p.n} className="relative flex gap-3 rounded-2xl border border-gray-100 bg-white p-4"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-black text-accent">{i + 1}</span><div><p className="text-sm font-bold text-primary">{p.n}</p><p className="text-xs text-muted-foreground">{p.t}</p></div>{i < 3 && <ArrowRight size={16} className="absolute -right-3 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-white text-gray-300 md:block" />}</li>
          ))}
        </ol>
      </Aparece>

      {/* Tiendas */}
      <Aparece retraso={0.05}>
        <Seccion titulo="Tus tiendas" ayuda={integraciones.length ? 'Prueba la conexión cuando quieras; si algo falla, la reparamos con un clic.' : 'Aún no has conectado ninguna.'}
          acciones={integraciones.length > 0 && <div className="flex flex-wrap gap-2"><Boton chico onClick={() => setConectar('shopify')} icono={<Plug size={13} />}>Conectar Shopify</Boton><Boton chico onClick={() => setConectar('woocommerce')} icono={<Plug size={13} />}>Conectar WordPress</Boton></div>}>
          {d.cargando ? <Skeleton className="h-40 w-full" /> : integraciones.length === 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {(['shopify', 'woocommerce'] as Plataforma[]).map((p) => (
                <button key={p} type="button" onClick={() => setConectar(p)} className="tap-scale group flex cursor-pointer items-center gap-4 rounded-3xl border-2 border-dashed border-gray-200 bg-white p-5 text-left transition-colors hover:border-accent hover:bg-secondary/40">
                  <Logo p={p} g /><div className="min-w-0 flex-1"><p className="font-heading text-lg font-black text-primary">{META[p].nombre}</p><p className="text-sm text-muted-foreground">{p === 'shopify' ? 'Conecta con una app personalizada de tu admin.' : 'Conecta con una clave de la API REST de WooCommerce.'}</p></div><ArrowRight className="shrink-0 text-gray-300 transition-transform group-hover:translate-x-1 group-hover:text-accent" />
                </button>
              ))}
            </div>
          ) : (
            <ul className="space-y-4">
              {integraciones.map((i) => {
                const cx = chequeos[i.id];
                const malo = cx?.some((c) => !c.ok) || i.estado === 'error';
                return (
                  <li key={i.id} className={cn('rounded-3xl border p-5', i.estado === 'error' ? 'border-red-200 bg-red-50/40' : 'border-gray-100')}>
                    <div className="flex flex-wrap items-center gap-4">
                      <Logo p={i.plataforma} />
                      <div className="min-w-0 flex-1"><p className="truncate font-heading text-lg font-black text-primary">{corto(i.dominio)}</p><p className="text-xs text-muted-foreground">{META[i.plataforma].nombre} · {d.datos?.vinculados[i.id] ?? 0} productos vinculados · última actividad {i.ultimo_sync ? hace(i.ultimo_sync) : 'ninguna todavía'}</p></div>
                      <Etiqueta estado={i.estado} />
                    </div>
                    {i.ultimo_error && <p className="mt-3 flex items-start gap-2 rounded-2xl bg-red-50 p-3 text-sm text-red-700"><CircleAlert size={16} className="mt-0.5 shrink-0" /><span>{i.ultimo_error}</span></p>}

                    <div className="mt-4 flex flex-wrap gap-2">
                      <Boton chico variante="oscuro" cargando={ocupado === `dx-${i.id}`} onClick={() => void probar(i)} icono={<Stethoscope size={13} />}>Probar conexión</Boton>
                      {malo && <Boton chico variante="primario" cargando={ocupado === `fix-${i.id}`} onClick={() => void reparar(i)} icono={<Wrench size={13} />}>Reparar conexión</Boton>}
                      <Boton chico cargando={ocupado === `imp-${i.id}`} onClick={() => void importar(i)} icono={<Download size={13} />}>Importar catálogo</Boton>
                      <Boton chico cargando={ocupado === `sync-${i.id}`} onClick={() => void enviarStock(i)} icono={<Send size={13} />}>Enviar stock ahora</Boton>
                      <Boton chico variante="peligro" cargando={ocupado === `del-${i.id}`} onClick={() => void quitar(i)} icono={<Unplug size={13} />}>Desconectar</Boton>
                    </div>

                    <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl bg-gray-50 p-3.5">
                      <input type="checkbox" className="mt-1 h-4 w-4 accent-[#FF5A36]" checked={i.sync_stock} disabled={ocupado === `opc-${i.id}`} onChange={(e) => void automatico(i, e.target.checked)} />
                      <span className="text-sm"><b className="text-primary">Mantener el stock de mi tienda igual al de la bodega</b><span className="mt-0.5 block text-xs text-muted-foreground">Automático: cada ingreso, venta o ajuste se refleja en tu tienda. Apagado, tu tienda conserva su propio stock.</span></span>
                    </label>

                    {cx && (
                      <ul className="mt-4 space-y-2 rounded-2xl border border-gray-100 p-4" aria-label="Resultado de la prueba">
                        {cx.map((c) => (
                          <li key={c.id} className="flex items-start gap-2.5 text-sm">
                            {c.ok ? <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-green-600" /> : <XCircle size={17} className="mt-0.5 shrink-0 text-red-600" />}
                            <div><p className="font-bold text-primary">{c.titulo}</p><p className="text-xs text-muted-foreground">{c.detalle}</p></div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Seccion>
      </Aparece>

      {(d.datos?.sinVincular ?? 0) > 0 && (
        <Link href="/casillero/inventario" className="tap-scale flex items-center gap-3 rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm font-semibold text-orange-900 hover:bg-orange-100/70">
          <AlertTriangle size={18} className="shrink-0" /><span className="flex-1">{d.datos!.sinVincular} {d.datos!.sinVincular === 1 ? 'SKU vendido en tu tienda aún no existe' : 'SKUs vendidos en tu tienda aún no existen'} en tu inventario. Créalos y sus ventas se descuentan solas.</span><span className="flex shrink-0 items-center gap-1 text-xs font-black">Crearlos<ArrowRight size={14} /></span>
        </Link>
      )}

      {/* Actividad */}
      <Aparece retraso={0.1}>
        <div className="mb-3"><h2 className="font-heading text-xl font-black text-primary">Actividad</h2><p className="text-sm text-muted-foreground">Cada aviso de tu tienda y cada sincronización, para saber siempre qué pasó.</p></div>
        <DataTable columnas={columnas} filas={filas} id={(e) => String(e.id)} cargando={d.cargando} porPagina={10}
          buscar={(e) => e.resumen} textoBuscar="Buscar un pedido o un SKU"
          filtros={<Segmentos valor={filtro} onCambio={setFiltro} opciones={[{ valor: 'todo', etiqueta: 'Todo' }, { valor: 'ventas', etiqueta: 'Ventas' }, { valor: 'errores', etiqueta: 'Errores', cuenta: eventos.filter((e) => e.tipo === 'error').length }, { valor: 'sync', etiqueta: 'Sincronización' }]} />}
          ordenInicial={{ clave: 'cuando', asc: false }}
          vacio={<EstadoVacio icono={<Plug size={26} />} titulo="Todavía no hay actividad" texto="Cuando llegue la primera venta de tu tienda, la verás aquí." />} />
      </Aparece>

      <LlavesApi llaves={d.datos?.llaves ?? []} cargando={d.cargando} base={base} onCambio={d.recargar} />

      <Conectar plataforma={conectar} onCerrar={() => setConectar(null)} onListo={async (id) => {
        setConectar(null);
        await d.recargar();
        const imp = await llamar<{ nuevos: number; existentes: number }>(`imp-${id}`, `/inventario/integraciones/${id}/importar`);
        if (imp) toast.success('¡Tienda conectada!', { description: `Importamos ${imp.nuevos} productos. Ahora cada venta bajará tu stock sola.` });
        await d.recargar();
      }} />
    </div>
  );
}

/* ------------------------------ Conectar una tienda ------------------------------ */
function Conectar({ plataforma, onCerrar, onListo }: { plataforma: Plataforma | null; onCerrar: () => void; onListo: (id: string) => Promise<void> }) {
  const { getAccessToken } = useAuth();
  const [f, setF] = useState<Record<string, string>>({});
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const campo = (k: string, etiqueta: string, ph: string, tipo = 'text', ayuda?: string) => (
    <Campo etiqueta={etiqueta} id={`c-${k}`} error={errores[k]} ayuda={ayuda}><Entrada id={`c-${k}`} type={tipo} autoComplete="off" spellCheck={false} placeholder={ph} value={f[k] ?? ''} onChange={(e) => { setF({ ...f, [k]: e.target.value }); setErrores({ ...errores, [k]: '' }); setError(null); }} aria-invalid={!!errores[k]} /></Campo>
  );

  const enviar = async () => {
    if (!plataforma) return;
    const e: Record<string, string> = {};
    if (plataforma === 'shopify') {
      if (!/^(https?:\/\/)?[a-z0-9][a-z0-9-]*\.myshopify\.com\/?$/i.test((f.dominio ?? '').trim())) e.dominio = 'Debe ser tu-tienda.myshopify.com (el dominio interno de Shopify, no el de tu marca).';
      if (!/^shpat_/i.test((f.token ?? '').trim())) e.token = 'El token de Admin API empieza con shpat_.';
      if ((f.secretoApi ?? '').trim().length < 8) e.secretoApi = 'Pega la clave secreta de la API de tu app.';
    } else {
      if (!/^https:\/\/[^\s/]+\.[^\s/]+/i.test((f.url ?? '').trim())) e.url = 'Escribe la dirección completa con https://, por ejemplo https://mitienda.com.';
      if (!/^ck_/.test((f.clave ?? '').trim())) e.clave = 'La Consumer key empieza con ck_.';
      if (!/^cs_/.test((f.secreto ?? '').trim())) e.secreto = 'La Consumer secret empieza con cs_.';
    }
    setErrores(e);
    if (Object.values(e).some(Boolean)) return;
    setOcupado(true); setError(null);
    const r = await api<{ id: string; nombre: string }>(`/inventario/integraciones/${plataforma}`, getAccessToken(), plataforma === 'shopify' ? { dominio: f.dominio.trim(), token: f.token.trim(), secretoApi: f.secretoApi.trim() } : { url: f.url.trim(), clave: f.clave.trim(), secreto: f.secreto.trim() });
    setOcupado(false);
    if (!r.ok) return setError(r.message ?? 'No pudimos conectar la tienda. Revisa los datos e intenta de nuevo.');
    setF({});
    await onListo(r.data.id);
  };

  const pasos: ReactNode[] = plataforma === 'shopify' ? [
    <>En tu Shopify ve a <b>Configuración → Apps y canales de venta → Desarrollar apps</b> y crea una app (nombre: Easycomex).</>,
    <>En <b>Configuración de la API de Admin</b> activa: <code>read_products</code>, <code>read_orders</code>, <code>read_inventory</code>, <code>write_inventory</code>.</>,
    <><b>Instala la app</b>. Copia el <b>Token de acceso de la API de Admin</b> (se muestra una sola vez) y, en la pestaña de credenciales, la <b>Clave secreta de la API</b>.</>,
  ] : [
    <>En tu WordPress ve a <b>WooCommerce → Ajustes → Avanzado → API REST → Añadir clave</b>.</>,
    <>Descripción: Easycomex. Permisos: <b>Lectura/Escritura</b>. Tu sitio debe usar <b>https</b>.</>,
    <>Copia la <b>Consumer key</b> (<code>ck_…</code>) y la <b>Consumer secret</b> (<code>cs_…</code>); se muestran una sola vez.</>,
  ];

  return (
    <Modal abierto={plataforma !== null} onCerrar={onCerrar} titulo={plataforma ? `Conectar ${META[plataforma].nombre}` : ''} descripcion="Tus llaves se guardan cifradas y solo las usa el servidor." ancho="max-w-2xl">
      {plataforma && (
        <div className="space-y-5">
          <ol className="space-y-2.5">{pasos.map((p, i) => <li key={i} className="flex gap-3 text-sm text-muted-foreground"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-black text-accent">{i + 1}</span><span className="[&_code]:rounded [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:text-[12px] [&_b]:text-primary">{p}</span></li>)}</ol>
          <div className="grid gap-4 sm:grid-cols-2">
            {plataforma === 'shopify' ? (<>
              <div className="sm:col-span-2">{campo('dominio', 'Dominio de tu tienda', 'mi-tienda.myshopify.com')}</div>
              {campo('token', 'Token de acceso (Admin API)', 'shpat_…', 'password')}
              {campo('secretoApi', 'Clave secreta de la API', '••••••••', 'password', 'Con ella verificamos que cada aviso viene de tu tienda.')}
            </>) : (<>
              <div className="sm:col-span-2">{campo('url', 'Dirección de tu sitio', 'https://mitienda.com')}</div>
              {campo('clave', 'Consumer key', 'ck_…', 'password')}
              {campo('secreto', 'Consumer secret', 'cs_…', 'password')}
            </>)}
          </div>
          {error && <p role="alert" className="flex items-start gap-2 rounded-2xl border border-red-100 bg-red-50 p-3.5 text-sm text-red-700"><XCircle size={17} className="mt-0.5 shrink-0" />{error}</p>}
          <p className="rounded-2xl bg-gray-50 p-3.5 text-xs text-muted-foreground">Al conectar, creamos los avisos de pedidos en tu tienda e importamos tu catálogo. <b>No cambiamos el stock de tu tienda</b> a menos que tú lo actives después.</p>
          <div className="flex justify-end gap-2"><Boton onClick={onCerrar}>Cancelar</Boton><Boton variante="primario" cargando={ocupado} onClick={() => void enviar()} icono={<Plug size={15} />}>Conectar y verificar</Boton></div>
        </div>
      )}
    </Modal>
  );
}

/* ------------------------------ Llaves de API ------------------------------ */
function LlavesApi({ llaves, cargando, base, onCambio }: { llaves: LlaveApi[]; cargando: boolean; base: string; onCambio: () => Promise<void> }) {
  const { getAccessToken } = useAuth();
  const confirmar = useConfirmar();
  const [nombre, setNombre] = useState('');
  const [nueva, setNueva] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [lenguaje, setLenguaje] = useState<'curl' | 'js' | 'php'>('curl');

  const crear = async () => {
    setOcupado(true);
    const r = await api<{ llave: string }>('/inventario/llaves', getAccessToken(), { nombre: nombre.trim() || 'Mi sistema' });
    setOcupado(false);
    if (!r.ok) return toast.error(r.message ?? 'No pudimos crear la llave');
    setNueva(r.data.llave); setNombre(''); await onCambio();
  };
  const borrar = async (k: LlaveApi) => {
    if (!(await confirmar({ titulo: `¿Borrar la llave “${k.nombre}”?`, texto: 'Los sistemas que la usan dejarán de funcionar de inmediato.', confirmar: 'Borrar llave', peligro: true }))) return;
    await fetch(`/api/inventario/llaves/${k.id}`, { method: 'DELETE', headers: { authorization: `Bearer ${getAccessToken() ?? ''}` } });
    toast.success('Llave borrada'); await onCambio();
  };

  const K = nueva ?? 'TU_LLAVE';
  const codigo = useMemo(() => ({
    curl: `# Ver tu stock
curl ${base}/api/v1/inventario \\
  -H "Authorization: Bearer ${K}"

# Avisar una venta (la referencia debe ser única por pedido)
curl -X POST ${base}/api/v1/inventario/ventas \\
  -H "Authorization: Bearer ${K}" -H "Content-Type: application/json" \\
  -d '{"sku":"CAM-01","cantidad":2,"referencia":"pedido-1001"}'`,
    js: `const API = '${base}/api/v1/inventario';
const headers = { Authorization: 'Bearer ${K}', 'Content-Type': 'application/json' };

// Ver tu stock
const { productos } = await (await fetch(API, { headers })).json();

// Avisar una venta (repetir la misma referencia no descuenta dos veces)
await fetch(API + '/ventas', {
  method: 'POST', headers,
  body: JSON.stringify({ sku: 'CAM-01', cantidad: 2, referencia: 'pedido-1001' }),
});`,
    php: `<?php
// WordPress: pega esto en un plugin propio o en functions.php
define('EASYCOMEX_API', '${base}/api/v1/inventario');
define('EASYCOMEX_KEY', '${K}');

function easycomex_venta($sku, $cantidad, $referencia) {
  $r = wp_remote_post(EASYCOMEX_API . '/ventas', array(
    'headers' => array('Authorization' => 'Bearer ' . EASYCOMEX_KEY, 'Content-Type' => 'application/json'),
    'body'    => wp_json_encode(array('sku' => $sku, 'cantidad' => (int) $cantidad, 'referencia' => (string) $referencia)),
    'timeout' => 15,
  ));
  return !is_wp_error($r) && wp_remote_retrieve_response_code($r) === 200;
}

function easycomex_stock() {
  $r = wp_remote_get(EASYCOMEX_API, array('headers' => array('Authorization' => 'Bearer ' . EASYCOMEX_KEY)));
  return is_wp_error($r) ? array() : json_decode(wp_remote_retrieve_body($r), true)['productos'];
}`,
  }), [base, K]);

  return (
    <Aparece retraso={0.14}>
      <Seccion titulo="API para tus propios sistemas" ayuda="Si no usas Shopify ni WooCommerce (un ERP, un plugin propio, una hoja de cálculo), conéctalo con una llave: consulta tu stock y avisa ventas y devoluciones.">
        <div className="flex flex-wrap items-end gap-3">
          <Campo etiqueta="Nombre de la llave" id="k-nombre" className="min-w-60 flex-1 sm:max-w-xs"><Entrada id="k-nombre" placeholder="Mi ERP" value={nombre} onChange={(e) => setNombre(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void crear()} /></Campo>
          <Boton variante="primario" cargando={ocupado} onClick={() => void crear()} icono={<KeyRound size={15} />}>Crear llave</Boton>
        </div>

        {nueva && (
          <div className="mt-4 rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm">
            <p className="flex items-center gap-2 font-bold text-orange-900"><AlertTriangle size={16} />Guarda esta llave ahora: no se vuelve a mostrar.</p>
            <code className="mt-2 block break-all rounded-xl bg-white p-3 text-xs">{nueva}</code>
            <div className="mt-2 flex gap-2"><BotonCopiar texto={nueva} etiqueta="Copiar llave" /><Boton chico onClick={() => setNueva(null)}>Ya la guardé</Boton></div>
          </div>
        )}

        <div className="mt-4 overflow-x-auto">
          {cargando ? <Skeleton className="h-12 w-full" /> : (
            <table className="w-full text-sm"><tbody>
              {llaves.map((k) => <tr key={k.id} className="border-t border-gray-100"><td className="py-3 font-bold text-primary">{k.nombre}</td><td className="font-mono text-xs text-muted-foreground">{k.prefijo}…</td><td className="text-muted-foreground">{k.ultimo_uso ? `Usada ${hace(k.ultimo_uso)}` : 'Sin usar'}</td><td className="text-right"><Boton chico variante="peligro" onClick={() => void borrar(k)} icono={<Trash2 size={12} />}>Borrar</Boton></td></tr>)}
              {!llaves.length && <tr><td className="py-3 text-muted-foreground">Aún no tienes llaves.</td></tr>}
            </tbody></table>
          )}
        </div>

        <div className="mt-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-bold text-primary">Ejemplos</p><Segmentos valor={lenguaje} onCambio={setLenguaje} opciones={[{ valor: 'curl', etiqueta: 'curl' }, { valor: 'js', etiqueta: 'JavaScript' }, { valor: 'php', etiqueta: 'WordPress (PHP)' }]} /></div>
          <div className="relative"><pre className="overflow-x-auto rounded-2xl bg-primary p-4 text-xs leading-relaxed text-white">{codigo[lenguaje]}</pre><div className="absolute right-3 top-3"><BotonCopiar texto={codigo[lenguaje]} /></div></div>
          <div className="mt-4 overflow-x-auto rounded-2xl border border-gray-100">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground"><tr><th className="px-4 py-2.5">Método</th><th className="px-4 py-2.5">Ruta</th><th className="px-4 py-2.5">Qué hace</th></tr></thead>
              <tbody className="[&_td]:px-4 [&_td]:py-2.5 [&_tr]:border-t [&_tr]:border-gray-100">
                <tr><td><code>GET</code></td><td><code>/api/v1/inventario</code></td><td>Todo tu stock: SKU, nombre, total, disponibles y vendidos.</td></tr>
                <tr><td><code>GET</code></td><td><code>/api/v1/inventario/:sku</code></td><td>El stock de un SKU.</td></tr>
                <tr><td><code>POST</code></td><td><code>/api/v1/inventario/ventas</code></td><td>Descuenta una venta. Cuerpo: <code>sku</code>, <code>cantidad</code>, <code>referencia</code> única.</td></tr>
                <tr><td><code>POST</code></td><td><code>/api/v1/inventario/devoluciones</code></td><td>Devuelve unidades al stock. Mismo cuerpo.</td></tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Respuestas: <code>200</code> ok (con <code>duplicado: true</code> si ya habías enviado esa referencia), <code>401</code> llave inválida, <code>404</code> SKU inexistente, <code>400</code> datos inválidos.</p>
        </div>
      </Seccion>
    </Aparece>
  );
}
