import { useMemo } from 'react';
import { Link } from 'wouter';
import { AlertTriangle, ArrowRight, BellPlus, Megaphone, Boxes, CheckCircle2, CircleDollarSign, Link2, MapPin, Package, PackageCheck, Plug, Plus, Truck, Wallet } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Aparece, Boton, BotonCopiar, ErrorCarga, EstadoVacio, Progreso, Seccion, Skeleton, Stat, useAsync, cn } from '@/portal/ui';
import { AreaTendencia, Barras, BarrasHorizontales, COLOR_ORIGEN, Dona, NOMBRE_ORIGEN, PALETA } from '@/portal/charts';
import { diaCorto, hace, mesCorto, usd, usdCorto } from '@/portal/format';
import { useDatos } from '@/portal/datos';
import { DIRECCION_MIAMI, resumenCliente } from '@/lib/casillero';

const PASOS = [
  { clave: 'prealerta', titulo: 'Prealerta tu primera compra', texto: 'Dinos qué viene en camino a tu casillero.', ruta: '/casillero/prealerta', icono: BellPlus },
  { clave: 'wallet', titulo: 'Recarga tu wallet', texto: 'Con saldo despachas en un clic.', ruta: '/casillero/wallet', icono: Wallet },
  { clave: 'productos', titulo: 'Crea o importa tus productos', texto: 'Tu inventario en la bodega, por SKU.', ruta: '/casillero/inventario', icono: Boxes },
  { clave: 'tienda', titulo: 'Conecta tu tienda', texto: 'Shopify o WordPress: las ventas bajan el stock solas.', ruta: '/casillero/integraciones', icono: Plug },
  { clave: 'stock', titulo: 'Envía tu mercancía a la bodega', texto: 'El equipo registra tu ingreso y queda disponible.', ruta: '/casillero/inventario', icono: Package },
] as const;

export default function Inicio() {
  const { profile } = useAuth();
  const { paquetes, config, cargando: cargandoDatos } = useDatos();
  const r = useAsync(resumenCliente, []);
  const res = r.datos;

  const nombre = (profile?.full_name ?? '').split(' ')[0] || 'bienvenido';
  const direccion = config.direccion_bodega || DIRECCION_MIAMI;
  const textoDireccion = `${profile?.full_name ?? ''} — ${profile?.casillero_codigo ?? ''}\n${direccion}`;

  const enBodega = paquetes.filter((p) => p.estado === 'recibido').length;
  const listos = paquetes.filter((p) => p.estado === 'recibido' && p.peso_lb != null).length;
  const enCamino = paquetes.filter((p) => p.estado === 'alistamiento' || p.estado === 'despachado').length;
  const vendidos30 = (res?.ventas_30d ?? []).reduce((a, d) => a + d.shopify + d.woocommerce + d.api + d.manual, 0);

  const pasos = res ? PASOS.map((p) => ({ ...p, hecho: res.onboarding[p.clave] })) : [];
  const hechos = pasos.filter((p) => p.hecho).length;
  const proximo = pasos.find((p) => !p.hecho);

  const alertas = useMemo(() => {
    if (!res) return [];
    const a: { clave: string; tono: 'naranja' | 'rojo' | 'azul'; texto: string; ruta: string; accion: string }[] = [];
    if (listos) a.push({ clave: 'listos', tono: 'azul', texto: `Tienes ${listos} ${listos === 1 ? 'paquete listo' : 'paquetes listos'} para despachar`, ruta: '/casillero/despacho', accion: 'Despachar' });
    if (res.stock_bajo.length) a.push({ clave: 'stock', tono: 'rojo', texto: `${res.stock_bajo.length} ${res.stock_bajo.length === 1 ? 'producto con stock bajo o agotado' : 'productos con stock bajo o agotados'}: ${res.stock_bajo.slice(0, 2).map((s) => s.sku).join(', ')}${res.stock_bajo.length > 2 ? '…' : ''}`, ruta: '/casillero/inventario', accion: 'Ver inventario' });
    if (res.sin_vincular) a.push({ clave: 'sku', tono: 'naranja', texto: `${res.sin_vincular} ${res.sin_vincular === 1 ? 'SKU vendido en tu tienda no existe' : 'SKUs vendidos en tu tienda no existen'} en tu inventario`, ruta: '/casillero/inventario', accion: 'Crearlos' });
    if (res.recargas_pendientes > 0) a.push({ clave: 'recarga', tono: 'naranja', texto: `${usd(res.recargas_pendientes)} en recargas esperando verificación`, ruta: '/casillero/wallet', accion: 'Ver wallet' });
    return a;
  }, [res, listos]);

  const origenes = ['shopify', 'woocommerce', 'api', 'manual'] as const;
  const ventasSerie = (res?.ventas_30d ?? []).map((d) => ({ ...d }));
  const tieneVentas = vendidos30 > 0;

  return (
    <div className="space-y-6">
      {config.aviso_clientes?.trim() && (
        <Aparece>
          <div role="status" className="flex items-start gap-3 rounded-3xl border border-accent/30 bg-secondary/60 p-4 text-sm text-primary">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-white"><Megaphone size={17} /></span>
            <p className="min-w-0 flex-1 self-center whitespace-pre-line break-words font-semibold">{config.aviso_clientes.trim()}</p>
          </div>
        </Aparece>
      )}

      {/* Héroe */}
      <Aparece>
        <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary via-[#262470] to-[#1B1A45] p-6 text-white app-shadow md:p-8">
          <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-accent/30 blur-3xl" aria-hidden="true" />
          <div className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-indigo-400/20 blur-3xl" aria-hidden="true" />
          <div className="relative grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold text-white/70">Hola, {nombre}</p>
              <p className="mt-3 text-xs font-bold uppercase tracking-widest text-white/60">Saldo disponible</p>
              <div className="font-heading text-5xl font-black tracking-tight md:text-6xl">{!res ? <Skeleton className="h-14 w-48 bg-white/20" /> : usd(res.saldo)}</div>
              {!!res?.recargas_pendientes && <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white/85"><CircleDollarSign size={13} />{usd(res.recargas_pendientes)} por verificar</p>}
              <div className="mt-6 flex flex-wrap gap-2.5">
                <Link href="/casillero/wallet"><Boton variante="primario" icono={<Plus size={16} />}>Recargar</Boton></Link>
                <Link href="/casillero/prealerta"><Boton className="border-0 bg-white/12 text-white hover:bg-white/20" icono={<BellPlus size={16} />}>Prealertar</Boton></Link>
                <Link href="/casillero/despacho"><Boton className="border-0 bg-white/12 text-white hover:bg-white/20" icono={<Truck size={16} />}>Despachar</Boton></Link>
              </div>
            </div>
            <div className="rounded-3xl bg-white/10 p-5 backdrop-blur-sm ring-1 ring-white/15">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/65"><MapPin size={14} />Tu dirección en Miami</p>
              <p className="mt-2 font-bold">{profile?.full_name} · <span className="rounded-md bg-accent px-1.5 py-0.5 text-sm">{profile?.casillero_codigo}</span></p>
              <p className="mt-1 text-sm leading-relaxed text-white/80">{direccion}</p>
              <p className="mt-2 text-xs text-white/55">Pon tu código <b>{profile?.casillero_codigo}</b> en el nombre o la suite de cada compra.</p>
              <div className="mt-3"><BotonCopiar texto={textoDireccion} etiqueta="Copiar dirección" className="border-0 bg-white/15 text-white hover:bg-white/25" /></div>
            </div>
          </div>
        </div>
      </Aparece>

      {r.error && <ErrorCarga mensaje={r.error} onReintentar={() => void r.recargar()} />}

      {/* Alertas */}
      {alertas.length > 0 && (
        <Aparece retraso={0.05}>
          <div className="grid gap-3 md:grid-cols-2">
            {alertas.map((a) => (
              <Link key={a.clave} href={a.ruta} className={cn('tap-scale group flex items-center gap-3 rounded-2xl border p-4 text-sm font-semibold transition-colors', a.tono === 'rojo' ? 'border-red-100 bg-red-50 text-red-800 hover:bg-red-100/70' : a.tono === 'azul' ? 'border-blue-100 bg-blue-50 text-blue-800 hover:bg-blue-100/70' : 'border-orange-100 bg-orange-50 text-orange-900 hover:bg-orange-100/70')}>
                <AlertTriangle size={18} className="shrink-0" /><span className="min-w-0 flex-1">{a.texto}</span>
                <span className="flex shrink-0 items-center gap-1 text-xs font-black">{a.accion}<ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" /></span>
              </Link>
            ))}
          </div>
        </Aparece>
      )}

      {/* Primeros pasos */}
      {res && hechos < PASOS.length && (
        <Aparece retraso={0.08}>
          <Seccion titulo="Primeros pasos" ayuda={`${hechos} de ${PASOS.length} completados`} acciones={proximo && <Link href={proximo.ruta}><Boton chico variante="oscuro" icono={<ArrowRight size={13} />}>Siguiente paso</Boton></Link>}>
            <Progreso valor={(hechos / PASOS.length) * 100} className="mb-4" />
            <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {pasos.map((p) => {
                const Icono = p.icono;
                return (
                  <li key={p.clave}>
                    <Link href={p.ruta} className={cn('tap-scale flex h-full flex-col gap-2 rounded-2xl border p-4 transition-colors', p.hecho ? 'border-green-100 bg-green-50/60' : 'border-gray-100 bg-white hover:border-accent/40 hover:bg-secondary/40')}>
                      <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl', p.hecho ? 'bg-green-500 text-white' : 'bg-secondary text-accent')}>{p.hecho ? <CheckCircle2 size={18} /> : <Icono size={18} />}</span>
                      <p className={cn('text-sm font-bold', p.hecho ? 'text-green-800' : 'text-primary')}>{p.titulo}</p>
                      <p className="text-xs text-muted-foreground">{p.texto}</p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Seccion>
        </Aparece>
      )}

      {/* Cifras */}
      <Aparece retraso={0.1}>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat etiqueta="En bodega" valor={enBodega} icono={<Package size={18} />} tono="azul" pista="paquetes recibidos en Miami" cargando={cargandoDatos} />
          <Stat etiqueta="Listos para despachar" valor={listos} icono={<PackageCheck size={18} />} tono="verde" pista="ya pesados" cargando={cargandoDatos} />
          <Stat etiqueta="En camino" valor={enCamino} icono={<Truck size={18} />} tono="neutro" pista="alistamiento y despachados" cargando={cargandoDatos} />
          <Stat etiqueta="Vendidos 30 días" valor={vendidos30} icono={<Link2 size={18} />} tono="oscuro" pista="unidades de tu inventario" cargando={!res} />
        </div>
      </Aparece>

      {/* Gráficas */}
      <div className="grid gap-6 xl:grid-cols-3">
        <Aparece retraso={0.12} className="xl:col-span-2">
          <Seccion titulo="Tu saldo, últimos 30 días" ayuda="Cómo ha cambiado el saldo de tu wallet con recargas y cobros de despacho.">
            {!res ? <Skeleton className="h-60 w-full" /> : (
              <AreaTendencia datos={res.saldo_serie} x="dia" xFormato={diaCorto} formato={usdCorto} series={[{ clave: 'saldo', etiqueta: 'Saldo', color: PALETA.naranja }]} resumen={`Saldo de los últimos 30 días; hoy ${usd(res.saldo)}.`} />
            )}
          </Seccion>
        </Aparece>
        <Aparece retraso={0.14}>
          <Seccion titulo="Tus paquetes" ayuda="Por estado, desde que te registraste.">
            {!res ? <Skeleton className="h-48 w-full" /> : (
              <Dona
                resumen={`Paquetes por estado: ${Object.entries(res.paquetes).map(([k, v]) => `${v} ${k}`).join(', ') || 'ninguno'}.`}
                centro={<><b className="font-heading text-3xl font-black text-primary">{Object.values(res.paquetes).reduce((a, b) => a + b, 0)}</b><span className="text-xs text-muted-foreground">paquetes</span></>}
                datos={[
                  { nombre: 'Prealertados', valor: res.paquetes.prealertado ?? 0, color: PALETA.ambar },
                  { nombre: 'En bodega', valor: res.paquetes.recibido ?? 0, color: PALETA.celeste },
                  { nombre: 'Alistamiento', valor: res.paquetes.alistamiento ?? 0, color: PALETA.indigo },
                  { nombre: 'Despachados', valor: res.paquetes.despachado ?? 0, color: PALETA.naranja },
                  { nombre: 'Entregados', valor: res.paquetes.entregado ?? 0, color: PALETA.verde },
                ]}
              />
            )}
          </Seccion>
        </Aparece>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Aparece retraso={0.16} className="xl:col-span-2">
          <Seccion titulo="Ventas de tu inventario, 30 días" ayuda="Unidades vendidas por origen: tus tiendas conectadas, la API o el equipo.">
            {!res ? <Skeleton className="h-60 w-full" /> : tieneVentas ? (
              <Barras apiladas datos={ventasSerie} x="dia" xFormato={diaCorto} series={origenes.map((o) => ({ clave: o, etiqueta: NOMBRE_ORIGEN[o], color: COLOR_ORIGEN[o] }))} resumen={`${vendidos30} unidades vendidas en 30 días.`} />
            ) : (
              <EstadoVacio icono={<Plug size={26} />} titulo="Aún no hay ventas registradas" texto="Conecta tu tienda de Shopify o WordPress y cada venta bajará tu stock automáticamente." accion={<Link href="/casillero/integraciones"><Boton variante="primario" icono={<Plug size={15} />}>Conectar mi tienda</Boton></Link>} />
            )}
          </Seccion>
        </Aparece>
        <Aparece retraso={0.18}>
          <Seccion titulo="Lo que más se vende" ayuda="Top 5 de los últimos 30 días.">
            {!res ? <Skeleton className="h-48 w-full" /> : <BarrasHorizontales datos={res.top_productos.map((t) => ({ ...t, etiqueta: `${t.sku} · ${t.nombre}` }))} nombre="etiqueta" valor="vendidos" formato={(n) => `${n} u.`} resumen="Productos más vendidos" />}
          </Seccion>
        </Aparece>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Aparece retraso={0.2} className="xl:col-span-2">
          <Seccion titulo="Recargas y gasto, 6 meses" ayuda="Lo que has puesto en tu wallet y lo que has gastado en envíos.">
            {!res ? <Skeleton className="h-56 w-full" /> : (
              <Barras datos={res.gasto_6m} x="mes" xFormato={mesCorto} formato={usdCorto} series={[{ clave: 'recargas', etiqueta: 'Recargas', color: PALETA.marino }, { clave: 'gasto', etiqueta: 'Gasto en envíos', color: PALETA.naranja }]} resumen="Recargas y gasto de los últimos seis meses" alto={220} />
            )}
          </Seccion>
        </Aparece>
        <Aparece retraso={0.22}>
          <Seccion titulo="Actividad reciente">
            {!res ? <Skeleton className="h-48 w-full" /> : res.actividad.length ? (
              <ol className="space-y-3">
                {res.actividad.slice(0, 7).map((a, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl', a.tipo === 'paquete' ? 'bg-blue-50 text-blue-600' : a.tipo === 'wallet' ? 'bg-green-50 text-green-600' : 'bg-secondary text-accent')}>
                      {a.tipo === 'paquete' ? <Package size={15} /> : a.tipo === 'wallet' ? <Wallet size={15} /> : <Boxes size={15} />}
                    </span>
                    <div className="min-w-0"><p className="truncate font-semibold text-primary">{a.titulo}</p><p className="truncate text-xs text-muted-foreground">{a.tipo === 'wallet' ? usd(a.detalle) : a.detalle} · {hace(a.fecha)}</p></div>
                  </li>
                ))}
              </ol>
            ) : <EstadoVacio icono={<Package size={24} />} titulo="Todo tranquilo" texto="Aquí verás cada movimiento de tus paquetes, tu wallet y tu inventario." />}
          </Seccion>
        </Aparece>
      </div>
    </div>
  );
}
