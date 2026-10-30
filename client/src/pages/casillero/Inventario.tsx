import { useMemo, useRef, useState } from 'react';
import { Link } from 'wouter';
import { toast } from 'sonner';
import { AlertTriangle, Boxes, CheckCircle2, Download, FileSpreadsheet, Package, Pencil, Plug, Plus, ShoppingCart, Trash2, TrendingDown, Upload, Warehouse } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Aparece, Boton, Campo, Card, Entrada, EstadoVacio, Etiqueta, Modal, PanelLateral, Seccion, Segmentos, Skeleton, Stat, useAsync, useConfirmar, cn, AreaTexto } from '@/portal/ui';
import DataTable, { type Columna } from '@/portal/DataTable';
import { AreaTendencia, Barras, COLOR_ORIGEN, Dona, NOMBRE_ORIGEN, PALETA } from '@/portal/charts';
import { csvAObjetos, diaCorto, fechaHora, num } from '@/portal/format';
import { downloadCSV } from '@/lib/csv';
import { db } from '@/lib/casillero';
import { ETIQUETA_TIPO, enRango, estadoStock, revisarImportacion, tonoCobertura, totales, type Analisis, type FilaImportada, type MovInv, type ProductoInv, type SinVincular } from '@/lib/inventario';

// Inventario del cliente: lo que hay en la bodega de Miami por SKU, cómo se
// mueve, cuánto le queda de cobertura y qué ventas de su tienda quedaron
// esperando un producto. Todo se lee con RLS; ver supabase/casillero.sql.

type Filtro = 'todos' | 'bajo' | 'agotado';

async function cargarInventario(): Promise<ProductoInv[]> {
  const { data, error } = await (await db()).from('casillero_inventario').select('*').order('nombre');
  if (error) throw error;
  return (data ?? []) as ProductoInv[];
}
async function cargarAnalisis(dias: number): Promise<Analisis> {
  const { data, error } = await (await db()).rpc('casillero_inv_analisis', { p_dias: dias });
  if (error) throw error;
  return data as Analisis;
}
async function cargarSinVincular(): Promise<SinVincular[]> {
  const { data } = await (await db()).from('casillero_skus_sin_producto').select('*').order('ultima', { ascending: false });
  return (data ?? []) as SinVincular[];
}

function BarraStock({ p }: { p: ProductoInv }) {
  const e = estadoStock(p);
  const pct = p.total_unidades > 0 ? Math.max(0, Math.min(100, (p.disponibles / p.total_unidades) * 100)) : 0;
  return (
    <div className="w-36">
      <div className="flex items-baseline justify-between text-sm"><b className={e === 'agotado' ? 'text-red-600' : e === 'bajo' ? 'text-amber-600' : 'text-green-700'}>{num(p.disponibles)}</b><span className="text-xs text-muted-foreground">de {num(p.total_unidades)}</span></div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100"><div className={cn('h-full rounded-full', e === 'agotado' ? 'bg-red-500' : e === 'bajo' ? 'bg-amber-500' : 'bg-green-500')} style={{ width: `${pct}%` }} /></div>
    </div>
  );
}

function Miniatura({ p }: { p: Pick<ProductoInv, 'imagen_url' | 'nombre'> }) {
  return p.imagen_url
    ? <img src={p.imagen_url} alt="" className="h-11 w-11 shrink-0 rounded-xl border border-gray-100 object-cover" loading="lazy" onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
    : <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-secondary text-accent"><Boxes size={19} /></span>;
}

export default function Inventario() {
  const { user } = useAuth();
  const [dias, setDias] = useState(30);
  const inv = useAsync(cargarInventario, []);
  const ana = useAsync(() => cargarAnalisis(dias), [dias]);
  const sin = useAsync(cargarSinVincular, []);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [metrica, setMetrica] = useState<'ventas' | 'ingresos' | 'devoluciones'>('ventas');
  const [editando, setEditando] = useState<Partial<ProductoInv> | null>(null);
  const [detalle, setDetalle] = useState<ProductoInv | null>(null);
  const [importando, setImportando] = useState(false);
  const [reporte, setReporte] = useState(false);

  const productos = inv.datos ?? [];
  const cobertura = useMemo(() => Object.fromEntries((ana.datos?.productos ?? []).map((x) => [x.id, x])), [ana.datos]);
  const t = totales(productos);
  const agotados = productos.filter((p) => estadoStock(p) === 'agotado').length;
  const bajos = productos.filter((p) => estadoStock(p) === 'bajo').length;
  const filas = productos.filter((p) => filtro === 'todos' || estadoStock(p) === filtro);
  const vendidosPeriodo = (ana.datos?.serie ?? []).reduce((a, d) => a + d.ventas, 0);
  const porAgotarse = productos.map((p) => ({ p, c: cobertura[p.id]?.cobertura_dias ?? null })).filter((x) => x.c !== null).sort((a, b) => (a.c as number) - (b.c as number)).slice(0, 5);

  const recargar = async () => { await Promise.all([inv.recargar(), ana.recargar(), sin.recargar()]); };

  const columnas: Columna<ProductoInv>[] = [
    { clave: 'producto', titulo: 'Producto', movil: 'titulo', orden: (p) => p.nombre.toLowerCase(), celda: (p) => (
      <div className="flex min-w-48 items-center gap-3"><Miniatura p={p} /><div className="min-w-0"><p className="truncate font-bold text-primary">{p.nombre}</p><p className="font-mono text-xs text-muted-foreground">{p.sku}</p></div></div>) },
    { clave: 'stock', titulo: 'Stock en bodega', orden: (p) => p.disponibles, celda: (p) => <BarraStock p={p} /> },
    { clave: 'vendidos', titulo: 'Vendidos', alinear: 'der', orden: (p) => p.vendidos, celda: (p) => num(p.vendidos) },
    { clave: 'rotacion', titulo: 'Rotación', alinear: 'der', orden: (p) => Number(p.rotacion), celda: (p) => `${Number(p.rotacion)}%` },
    { clave: 'cobertura', titulo: 'Cobertura', alinear: 'der', orden: (p) => cobertura[p.id]?.cobertura_dias ?? 99999, celda: (p) => {
      const c = cobertura[p.id]?.cobertura_dias ?? null;
      if (c === null) return <span className="text-gray-300">—</span>;
      const tono = tonoCobertura(c);
      return <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-bold', tono === 'rojo' ? 'bg-red-50 text-red-700' : tono === 'ambar' ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700')}>~{c} días</span>;
    } },
    { clave: 'estado', titulo: 'Estado', celda: (p) => { const e = estadoStock(p); return e === 'agotado' ? <Etiqueta tono="rojo">Agotado</Etiqueta> : e === 'bajo' ? <Etiqueta tono="naranja">Stock bajo</Etiqueta> : <Etiqueta tono="verde">En stock</Etiqueta>; } },
    { clave: 'acciones', titulo: '', celda: (p) => <Boton chico onClick={(e) => { e.stopPropagation(); setEditando(p); }} icono={<Pencil size={12} />}>Editar</Boton> },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h1 className="font-heading text-2xl font-black text-primary md:text-3xl">Inventario</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">Tu mercancía en la bodega de Miami. Lo que entra lo registra el equipo al recibirlo; las ventas de tu tienda lo descuentan solas.</p></div>
        <div className="flex flex-wrap gap-2">
          <Boton onClick={() => setReporte(true)} icono={<Download size={15} />}>Reporte</Boton>
          <Boton onClick={() => setImportando(true)} icono={<Upload size={15} />}>Importar CSV</Boton>
          <Boton variante="primario" onClick={() => setEditando({})} icono={<Plus size={15} />}>Nuevo producto</Boton>
        </div>
      </div>

      {/* Ventas esperando un producto */}
      {(sin.datos?.length ?? 0) > 0 && (
        <Aparece>
          <div className="rounded-3xl border border-orange-200 bg-orange-50 p-5">
            <p className="flex items-center gap-2 font-bold text-orange-900"><AlertTriangle size={18} />Vendiste productos que no existen en tu inventario</p>
            <p className="mt-1 text-sm text-orange-900/80">Guardamos esas ventas. Apenas crees el producto con el mismo SKU, se descuentan solas del stock.</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {sin.datos!.map((s) => (
                <li key={s.sku}><button type="button" onClick={() => setEditando({ sku: s.sku })} className="tap-scale-sm flex cursor-pointer items-center gap-2 rounded-full border border-orange-200 bg-white px-3.5 py-1.5 text-sm font-bold text-orange-900 hover:bg-orange-100"><Plus size={14} /><span className="font-mono">{s.sku}</span><span className="rounded-full bg-orange-100 px-2 text-xs">{s.unidades} u.</span></button></li>
              ))}
            </ul>
          </div>
        </Aparece>
      )}

      <Aparece retraso={0.04}>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat etiqueta="Productos" valor={t.productos} icono={<Package size={18} />} tono="neutro" pista={agotados || bajos ? [agotados ? `${agotados} ${agotados === 1 ? 'agotado' : 'agotados'}` : '', bajos ? `${bajos} con stock bajo` : ''].filter(Boolean).join(' · ') : 'todos con stock'} cargando={inv.cargando} />
          <Stat etiqueta="Unidades recibidas" valor={t.totalUnidades} formato={(n) => num(Math.round(n))} icono={<Warehouse size={18} />} tono="azul" pista="ingresos y devoluciones" cargando={inv.cargando} />
          <Stat etiqueta="Disponibles hoy" valor={t.disponibles} formato={(n) => num(Math.round(n))} icono={<CheckCircle2 size={18} />} tono="verde" pista="listas para vender" cargando={inv.cargando} />
          <Stat etiqueta={`Vendidas (${dias} días)`} valor={vendidosPeriodo} formato={(n) => num(Math.round(n))} icono={<ShoppingCart size={18} />} tono="oscuro" pista={`${num(t.vendidos)} en total`} cargando={ana.cargando} />
        </div>
      </Aparece>

      {/* Gráficas */}
      <div className="grid gap-6 xl:grid-cols-3">
        <Aparece retraso={0.08} className="xl:col-span-2">
          <Seccion titulo="Movimiento de inventario" ayuda="Unidades por día. Elige qué ver: ventas, ingresos a la bodega o devoluciones."
            acciones={<Segmentos valor={String(dias) as '7' | '30' | '90'} onCambio={(v) => setDias(Number(v))} opciones={[{ valor: '7', etiqueta: '7 d' }, { valor: '30', etiqueta: '30 d' }, { valor: '90', etiqueta: '90 d' }]} />}>
            <Segmentos className="mb-3" valor={metrica} onCambio={setMetrica} opciones={[{ valor: 'ventas', etiqueta: 'Ventas' }, { valor: 'ingresos', etiqueta: 'Ingresos a bodega' }, { valor: 'devoluciones', etiqueta: 'Devoluciones' }]} />
            {!ana.datos ? <Skeleton className="h-60 w-full" /> : (
              <Barras datos={ana.datos.serie} x="dia" xFormato={diaCorto} leyenda={false}
                series={[{ clave: metrica, etiqueta: { ventas: 'Ventas', ingresos: 'Ingresos a bodega', devoluciones: 'Devoluciones' }[metrica], color: { ventas: PALETA.naranja, ingresos: PALETA.marino, devoluciones: PALETA.verde }[metrica] }]}
                resumen={`${metrica} por día en los últimos ${dias} días`} />
            )}
          </Seccion>
        </Aparece>
        <Aparece retraso={0.1}>
          <Seccion titulo="Ventas por origen" ayuda={`Últimos ${dias} días.`}>
            {!ana.datos ? <Skeleton className="h-52 w-full" /> : (
              <Dona resumen="Ventas por origen" centro={<><b className="font-heading text-3xl font-black text-primary">{num(vendidosPeriodo)}</b><span className="text-xs text-muted-foreground">unidades</span></>}
                datos={ana.datos.por_origen.map((o) => ({ nombre: NOMBRE_ORIGEN[o.origen] ?? o.origen, valor: o.unidades, color: COLOR_ORIGEN[o.origen] ?? PALETA.gris }))} />
            )}
          </Seccion>
        </Aparece>
      </div>

      {porAgotarse.length > 0 && (
        <Aparece retraso={0.12}>
          <Seccion titulo="Lo que se agota primero" ayuda={`Cuántos días te dura el stock a tu ritmo de ventas de los últimos ${dias} días.`}>
            <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {porAgotarse.map(({ p, c }) => {
                const tono = tonoCobertura(c);
                return (
                  <li key={p.id}><button type="button" onClick={() => setDetalle(p)} className="tap-scale flex w-full cursor-pointer flex-col gap-1 rounded-2xl border border-gray-100 bg-white p-4 text-left transition-colors hover:bg-gray-50">
                    <span className={cn('flex items-center gap-1.5 text-xs font-black uppercase tracking-wider', tono === 'rojo' ? 'text-red-600' : tono === 'ambar' ? 'text-amber-600' : 'text-green-600')}><TrendingDown size={13} />~{c} días</span>
                    <span className="truncate font-bold text-primary">{p.nombre}</span><span className="font-mono text-xs text-muted-foreground">{p.sku} · {num(p.disponibles)} u.</span>
                  </button></li>
                );
              })}
            </ul>
          </Seccion>
        </Aparece>
      )}

      <Aparece retraso={0.14}>
        <DataTable
          columnas={columnas} filas={filas} id={(p) => p.id} cargando={inv.cargando}
          buscar={(p) => `${p.sku} ${p.nombre} ${p.descripcion ?? ''}`} textoBuscar="Buscar por nombre o SKU" onFila={setDetalle}
          filtros={<Segmentos valor={filtro} onCambio={setFiltro} opciones={[{ valor: 'todos', etiqueta: 'Todos', cuenta: productos.length }, { valor: 'bajo', etiqueta: 'Stock bajo', cuenta: bajos }, { valor: 'agotado', etiqueta: 'Agotados', cuenta: agotados }]} />}
          exportar={{ nombre: 'inventario', fila: (p) => ({ sku: p.sku, producto: p.nombre, descripcion: p.descripcion, total_unidades: p.total_unidades, disponibles: p.disponibles, vendidos: p.vendidos, rotacion_pct: p.rotacion, stock_minimo: p.stock_minimo }) }}
          ordenInicial={{ clave: 'producto', asc: true }}
          vacio={productos.length === 0 ? (
            <EstadoVacio icono={<Boxes size={26} />} titulo="Aún no tienes productos" texto="Crea tu primer producto, importa un CSV o conecta tu tienda para traer tu catálogo con un clic."
              accion={<div className="flex flex-wrap justify-center gap-2"><Boton variante="primario" onClick={() => setEditando({})} icono={<Plus size={15} />}>Crear producto</Boton><Link href="/casillero/integraciones"><Boton icono={<Plug size={15} />}>Conectar mi tienda</Boton></Link></div>} />
          ) : undefined}
        />
      </Aparece>

      <FormularioProducto producto={editando} onCerrar={() => setEditando(null)} userId={user?.id ?? ''} onListo={async () => { setEditando(null); await recargar(); }} />
      <ImportarCSV abierto={importando} onCerrar={() => setImportando(false)} existentes={new Set(productos.map((p) => p.sku.toLowerCase()))} userId={user?.id ?? ''} onListo={async () => { setImportando(false); await recargar(); }} />
      <Reporte abierto={reporte} onCerrar={() => setReporte(false)} />
      {detalle && <DetalleProducto producto={detalle} cobertura={cobertura[detalle.id]?.cobertura_dias ?? null} onCerrar={() => setDetalle(null)} onEditar={() => { setEditando(detalle); setDetalle(null); }} onCambio={async () => { setDetalle(null); await recargar(); }} />}
    </div>
  );
}

/* ------------------------------ Crear / editar ------------------------------ */
function FormularioProducto({ producto, onCerrar, onListo, userId }: { producto: Partial<ProductoInv> | null; onCerrar: () => void; onListo: () => Promise<void>; userId: string }) {
  const [f, setF] = useState({ sku: '', nombre: '', descripcion: '', imagen: '', minimo: '0' });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [ocupado, setOcupado] = useState(false);
  const abierto = producto !== null;
  const editando = !!producto?.id;
  const clave = `${producto?.id ?? ''}|${producto?.sku ?? ''}|${abierto}`;
  const ultima = useRef('');
  if (abierto && ultima.current !== clave) {
    ultima.current = clave;
    setF({ sku: producto?.sku ?? '', nombre: producto?.nombre ?? '', descripcion: producto?.descripcion ?? '', imagen: producto?.imagen_url ?? '', minimo: String(producto?.stock_minimo ?? 0) });
    setErrores({});
  }
  if (!abierto) ultima.current = '';

  const guardar = async () => {
    const e: Record<string, string> = {};
    if (!f.sku.trim()) e.sku = 'El SKU es obligatorio: con él se reconocen las ventas de tu tienda.';
    else if (f.sku.trim().length > 80) e.sku = 'Máximo 80 caracteres.';
    if (!f.nombre.trim()) e.nombre = 'Escribe el nombre del producto.';
    const min = Number(f.minimo || 0);
    if (!Number.isInteger(min) || min < 0) e.minimo = 'Un número entero, 0 o más.';
    if (f.imagen.trim() && !/^https?:\/\//i.test(f.imagen.trim())) e.imagen = 'Pega el enlace completo de la imagen (https://…).';
    setErrores(e);
    if (Object.keys(e).length) return;
    setOcupado(true);
    const fila = { nombre: f.nombre.trim(), descripcion: f.descripcion.trim() || null, imagen_url: f.imagen.trim() || null, stock_minimo: min };
    const s = await db();
    const { error } = editando ? await s.from('casillero_productos').update(fila).eq('id', producto!.id!) : await s.from('casillero_productos').insert({ ...fila, sku: f.sku.trim(), user_id: userId });
    setOcupado(false);
    if (error) return setErrores({ sku: error.code === '23505' ? 'Ya tienes un producto con ese SKU.' : error.message });
    toast.success(editando ? 'Producto actualizado' : 'Producto creado', { description: editando ? undefined : 'Si ya había ventas con este SKU, se descontaron del stock.' });
    await onListo();
  };

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo={editando ? 'Editar producto' : 'Nuevo producto'} ancho="max-w-xl">
      <form className="space-y-4" onSubmit={(ev) => { ev.preventDefault(); void guardar(); }} noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="SKU" id="f-sku" error={errores.sku} ayuda={editando ? 'El SKU no se puede cambiar. Para otro SKU, crea un producto nuevo.' : 'El mismo código que usas en tu tienda.'}><Entrada id="f-sku" value={f.sku} disabled={editando} onChange={(e) => setF({ ...f, sku: e.target.value })} aria-invalid={!!errores.sku} autoFocus={!editando} placeholder="CAM-01" /></Campo>
          <Campo etiqueta="Nombre" id="f-nombre" error={errores.nombre}><Entrada id="f-nombre" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} aria-invalid={!!errores.nombre} autoFocus={editando} placeholder="Camiseta algodón negra" /></Campo>
        </div>
        <Campo etiqueta="Descripción" id="f-desc"><AreaTexto id="f-desc" rows={2} value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} /></Campo>
        <div className="grid gap-4 sm:grid-cols-[1fr_160px]">
          <Campo etiqueta="Imagen (enlace)" id="f-img" error={errores.imagen}><Entrada id="f-img" value={f.imagen} onChange={(e) => setF({ ...f, imagen: e.target.value })} aria-invalid={!!errores.imagen} placeholder="https://…" /></Campo>
          <Campo etiqueta="Avisarme con" id="f-min" error={errores.minimo} ayuda="unidades o menos"><Entrada id="f-min" type="number" min="0" step="1" value={f.minimo} onChange={(e) => setF({ ...f, minimo: e.target.value })} aria-invalid={!!errores.minimo} /></Campo>
        </div>
        {f.imagen.trim() && /^https?:\/\//i.test(f.imagen.trim()) && <img src={f.imagen.trim()} alt="Vista previa" className="h-24 w-24 rounded-2xl border border-gray-100 object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />}
        <div className="flex justify-end gap-2 pt-2"><Boton onClick={onCerrar}>Cancelar</Boton><Boton type="submit" variante="primario" cargando={ocupado}>{editando ? 'Guardar cambios' : 'Crear producto'}</Boton></div>
      </form>
    </Modal>
  );
}

/* ------------------------------ Importar CSV ------------------------------ */
function ImportarCSV({ abierto, onCerrar, existentes, userId, onListo }: { abierto: boolean; onCerrar: () => void; existentes: Set<string>; userId: string; onListo: () => Promise<void> }) {
  const [texto, setTexto] = useState('');
  const [actualizar, setActualizar] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const filas = useMemo<FilaImportada[]>(() => (texto.trim() ? revisarImportacion(csvAObjetos(texto), existentes) : []), [texto, existentes]);
  const nuevos = filas.filter((f) => f.estado === 'nuevo');
  const ya = filas.filter((f) => f.estado === 'existente');
  const malos = filas.filter((f) => f.estado === 'error');
  const aplicar = [...nuevos, ...(actualizar ? ya : [])];

  const leerArchivo = async (file: File | undefined) => { if (file) setTexto(await file.text()); };
  const plantilla = () => downloadCSV('plantilla-productos.csv', [{ sku: 'CAM-01', nombre: 'Camiseta algodón negra', descripcion: 'Talla M', imagen: 'https://…/camiseta.jpg', stock_minimo: 10 }]);

  const importar = async () => {
    if (!aplicar.length) return;
    setOcupado(true);
    const s = await db();
    let fallos = 0;
    const crear = nuevos.map((f) => ({ user_id: userId, sku: f.sku, nombre: f.nombre, descripcion: f.descripcion, imagen_url: f.imagen_url, stock_minimo: f.stock_minimo }));
    for (let i = 0; i < crear.length; i += 100) {
      const { error } = await s.from('casillero_productos').insert(crear.slice(i, i + 100));
      if (error) { fallos += Math.min(100, crear.length - i); toast.error('Un lote no se pudo guardar', { description: error.message }); }
    }
    if (actualizar) for (const f of ya) {
      const { error } = await s.from('casillero_productos').update({ nombre: f.nombre, descripcion: f.descripcion, imagen_url: f.imagen_url, stock_minimo: f.stock_minimo }).eq('user_id', userId).eq('sku', f.sku);
      if (error) fallos++;
    }
    setOcupado(false);
    const ok = aplicar.length - fallos;
    if (ok > 0) toast.success(`${ok} ${ok === 1 ? 'producto importado' : 'productos importados'}`, { description: fallos ? `${fallos} no se pudieron guardar.` : undefined });
    setTexto('');
    await onListo();
  };

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="Importar productos desde CSV" descripcion="Columnas: sku, nombre, descripcion, imagen, stock_minimo. La primera fila son los encabezados." ancho="max-w-3xl">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <label className="tap-scale-sm inline-flex cursor-pointer items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary/90"><FileSpreadsheet size={16} />Elegir archivo<input type="file" accept=".csv,text/csv,text/plain" className="sr-only" onChange={(e) => void leerArchivo(e.target.files?.[0])} /></label>
          <Boton onClick={plantilla} icono={<Download size={15} />}>Descargar plantilla</Boton>
          <span className="text-xs text-muted-foreground">o pega el contenido aquí abajo</span>
        </div>
        <AreaTexto aria-label="Contenido del CSV" rows={5} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={'sku,nombre,descripcion,imagen,stock_minimo\nCAM-01,Camiseta negra,Talla M,,10'} className="font-mono text-xs" />

        {filas.length > 0 && (
          <>
            <div className="flex flex-wrap gap-2 text-sm">
              <Etiqueta tono="verde">{nuevos.length} nuevos</Etiqueta><Etiqueta tono="azul">{ya.length} ya existen</Etiqueta>{malos.length > 0 && <Etiqueta tono="rojo">{malos.length} con error</Etiqueta>}
            </div>
            {ya.length > 0 && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={actualizar} onChange={(e) => setActualizar(e.target.checked)} />Actualizar nombre, descripción, imagen y mínimo de los {ya.length} que ya existen</label>}
            <div className="max-h-64 overflow-auto rounded-2xl border border-gray-100">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground"><tr><th className="px-3 py-2">Fila</th><th className="px-3 py-2">SKU</th><th className="px-3 py-2">Nombre</th><th className="px-3 py-2">Resultado</th></tr></thead>
                <tbody>
                  {filas.slice(0, 200).map((f) => (
                    <tr key={f.fila} className="border-t border-gray-50"><td className="px-3 py-2 text-muted-foreground">{f.fila}</td><td className="px-3 py-2 font-mono">{f.sku || '—'}</td><td className="px-3 py-2">{f.nombre || '—'}</td>
                      <td className="px-3 py-2">{f.estado === 'error' ? <span className="font-semibold text-red-600">{f.error}</span> : f.estado === 'existente' ? <span className="text-blue-700">{actualizar ? 'Se actualizará' : 'Ya existe: se omite'}</span> : <span className="font-semibold text-green-700">Se creará</span>}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <div className="flex justify-end gap-2 pt-1"><Boton onClick={onCerrar}>Cancelar</Boton><Boton variante="primario" cargando={ocupado} disabled={!aplicar.length} onClick={() => void importar()}>Importar {aplicar.length || ''} {aplicar.length === 1 ? 'producto' : 'productos'}</Boton></div>
      </div>
    </Modal>
  );
}

/* ------------------------------ Reporte ------------------------------ */
function Reporte({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const descargar = async () => {
    setOcupado(true);
    const { data, error } = await (await db()).from('casillero_inv_mov').select('*, casillero_productos(sku, nombre)').order('created_at', { ascending: false }).limit(10000);
    setOcupado(false);
    if (error) return toast.error(error.message);
    const movs = enRango((data ?? []) as MovInv[], desde, hasta);
    if (!movs.length) return toast.message('No hay movimientos en ese rango.');
    downloadCSV(`movimientos-inventario-${desde || 'inicio'}-${hasta || 'hoy'}.csv`, movs.map((m) => ({ fecha: m.created_at, sku: m.casillero_productos?.sku, producto: m.casillero_productos?.nombre, tipo: ETIQUETA_TIPO[m.tipo], cantidad: m.cantidad, origen: m.origen, referencia: m.referencia })));
    toast.success(`${movs.length} movimientos descargados`);
  };
  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="Reporte de movimientos" descripcion="Cada ingreso, venta, devolución y ajuste en el periodo, en un CSV." ancho="max-w-md">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2"><Campo etiqueta="Desde" id="rep-d"><Entrada id="rep-d" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></Campo><Campo etiqueta="Hasta" id="rep-h"><Entrada id="rep-h" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></Campo></div>
        <p className="text-xs text-muted-foreground">Sin fechas, se descarga todo el historial.</p>
        <div className="flex justify-end gap-2"><Boton onClick={onCerrar}>Cerrar</Boton><Boton variante="primario" cargando={ocupado} icono={<Download size={15} />} onClick={() => void descargar()}>Descargar CSV</Boton></div>
      </div>
    </Modal>
  );
}

/* ------------------------------ Detalle de un producto ------------------------------ */
function DetalleProducto({ producto: p, cobertura, onCerrar, onEditar, onCambio }: { producto: ProductoInv; cobertura: number | null; onCerrar: () => void; onEditar: () => void; onCambio: () => Promise<void> }) {
  const confirmar = useConfirmar();
  const movs = useAsync(async () => {
    const { data, error } = await (await db()).from('casillero_inv_mov').select('*').eq('producto_id', p.id).order('created_at', { ascending: false }).limit(200);
    if (error) throw error;
    return (data ?? []) as MovInv[];
  }, [p.id]);
  const e = estadoStock(p);

  // Evolución del stock día a día, de los movimientos más viejos a los más nuevos.
  const evolucion = useMemo(() => {
    const asc = [...(movs.datos ?? [])].reverse();
    const porDia = new Map<string, number>();
    let acum = 0;
    for (const m of asc) { acum += m.cantidad; porDia.set(m.created_at.slice(0, 10), acum); }
    return Array.from(porDia.entries()).map(([dia, stock]) => ({ dia, stock }));
  }, [movs.datos]);

  const eliminar = async () => {
    if (!(await confirmar({ titulo: `¿Eliminar ${p.nombre}?`, texto: 'Solo se puede eliminar un producto que nunca tuvo movimientos de stock.', confirmar: 'Eliminar', peligro: true }))) return;
    const { error } = await (await db()).from('casillero_productos').delete().eq('id', p.id);
    if (error) return toast.error('No se puede eliminar un producto con movimientos de stock.');
    toast.success('Producto eliminado');
    await onCambio();
  };

  return (
    <PanelLateral abierto onCerrar={onCerrar} titulo={p.nombre} descripcion={`SKU ${p.sku}`}>
      <div className="flex items-center gap-4"><Miniatura p={p} />{p.descripcion && <p className="text-sm text-muted-foreground">{p.descripcion}</p>}</div>
      <div className="grid grid-cols-2 gap-3">
        <Stat etiqueta="Disponibles" valor={p.disponibles} tono={e === 'ok' ? 'verde' : 'rojo'} pista={e === 'agotado' ? 'Agotado' : e === 'bajo' ? `Bajo (mínimo ${p.stock_minimo})` : p.stock_minimo ? `Aviso en ${p.stock_minimo}` : undefined} />
        <Stat etiqueta="Vendidos" valor={p.vendidos} tono="oscuro" pista={`Rotación ${Number(p.rotacion)}%`} />
        <Stat etiqueta="Recibidos" valor={p.total_unidades} tono="azul" />
        <Stat etiqueta="Cobertura" valor={cobertura ?? 0} formato={(n) => (cobertura === null ? '—' : `~${Math.round(n)} d`)} tono="neutro" pista="a tu ritmo de ventas" />
      </div>
      <Seccion titulo="Evolución del stock">{movs.cargando ? <Skeleton className="h-40 w-full" /> : <AreaTendencia datos={evolucion} x="dia" xFormato={diaCorto} formato={(n) => String(n)} series={[{ clave: 'stock', etiqueta: 'Stock', color: PALETA.marino }]} alto={170} resumen={`Evolución del stock de ${p.sku}`} />}</Seccion>
      <Seccion titulo="Historial">
        {movs.cargando ? <Skeleton className="h-32 w-full" /> : (
          <ul className="divide-y divide-gray-100 text-sm">
            {(movs.datos ?? []).slice(0, 40).map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0"><p className="font-semibold text-primary">{ETIQUETA_TIPO[m.tipo]} <span className="font-normal text-muted-foreground">· {NOMBRE_ORIGEN[m.origen] ?? m.origen}</span></p><p className="truncate text-xs text-muted-foreground">{m.referencia ?? '—'} · {fechaHora(m.created_at)}</p></div>
                <b className={m.cantidad < 0 ? 'text-red-600' : 'text-green-700'}>{m.cantidad > 0 ? '+' : ''}{m.cantidad}</b>
              </li>
            ))}
            {!movs.datos?.length && <li className="py-4 text-center text-muted-foreground">Sin movimientos todavía.</li>}
          </ul>
        )}
      </Seccion>
      <div className="flex flex-wrap gap-2"><Boton variante="oscuro" onClick={onEditar} icono={<Pencil size={14} />}>Editar</Boton><Boton variante="peligro" onClick={() => void eliminar()} icono={<Trash2 size={14} />}>Eliminar</Boton></div>
    </PanelLateral>
  );
}
