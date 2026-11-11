import { Link } from 'wouter';
import { AlertTriangle, ArrowRight, Boxes, CircleDollarSign, ScanLine, Truck, Users, Wallet, Plug } from 'lucide-react';
import { Aparece, ErrorCarga, Seccion, Skeleton, Stat, cn } from '@/portal/ui';
import { AreaTendencia, Barras, BarrasHorizontales, COLOR_ORIGEN, Dona, NOMBRE_ORIGEN, PALETA } from '@/portal/charts';
import { diaCorto, mesCorto, num, usd, usdCorto } from '@/portal/format';
import { useAdmin } from '@/portal/admin';

export default function Resumen() {
  const { stats: s, error, recargar } = useAdmin();
  if (error && !s) return <ErrorCarga mensaje={error} onReintentar={() => void recargar()} />;

  const p = (e: string) => s?.paquetes[e] ?? 0;
  const cola = [
    { clave: 'recibir', n: s?.cola.por_recibir ?? 0, t: 'Por recibir en bodega', d: 'Prealertados que aún no llegan', ruta: '/admin/casillero/recepcion', icono: ScanLine, accion: 'Ir a recepción' },
    { clave: 'alistar', n: s?.cola.por_alistar ?? 0, t: 'Despachos por alistar', d: 'Solicitados y pagados por el cliente', ruta: '/admin/casillero/despachos', icono: Truck, accion: 'Ver despachos' },
    { clave: 'recargas', n: s?.cola.recargas ?? 0, t: 'Recargas por verificar', d: s ? `${usd(s.recargas_pendientes_usd)} esperando` : '', ruta: '/admin/casillero/wallet', icono: CircleDollarSign, accion: 'Verificar' },
    { clave: 'sin', n: (s?.cola.sin_vincular ?? 0) + (s?.integraciones.con_error ?? 0), t: 'Integraciones por atender', d: s ? `${s.integraciones.con_error} con error · ${s.cola.sin_vincular} SKU sin vincular` : '', ruta: '/admin/casillero/integraciones', icono: Plug, accion: 'Revisar' },
  ];

  return (
    <div className="space-y-6">
      <div><h1 className="font-heading text-2xl font-black text-primary md:text-3xl">Resumen</h1><p className="mt-1 text-sm text-muted-foreground">Lo que necesita tu atención hoy y cómo va el negocio.</p></div>

      <Aparece>
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {cola.map((c) => {
            const I = c.icono; const hay = c.n > 0;
            return (
              <Link key={c.clave} href={c.ruta} className={cn('tap-scale group flex flex-col gap-3 rounded-3xl border p-5 transition-all hover:-translate-y-0.5', hay ? 'border-accent/30 bg-secondary/50' : 'border-gray-100 bg-white')}>
                <div className="flex items-start justify-between"><span className={cn('flex h-10 w-10 items-center justify-center rounded-2xl', hay ? 'bg-accent text-white' : 'bg-gray-100 text-gray-400')}><I size={19} /></span>{hay && <AlertTriangle size={15} className="text-accent" />}</div>
                <div>{!s ? <Skeleton className="h-9 w-12" /> : <p className="font-heading text-4xl font-black text-primary">{c.n}</p>}<p className="mt-1 text-sm font-bold text-primary">{c.t}</p><p className="text-xs text-muted-foreground">{c.d}</p></div>
                <span className={cn('mt-auto flex items-center gap-1 text-xs font-black', hay ? 'text-accent' : 'text-gray-400')}>{hay ? c.accion : 'Todo al día'}{hay && <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />}</span>
              </Link>
            );
          })}
        </div>
      </Aparece>

      <Aparece retraso={0.06}>
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <Stat tono="naranja" etiqueta="Ingresos 30 días" valor={s?.ingresos_30d ?? 0} formato={usd} icono={<CircleDollarSign size={18} />} pista="cobrado en despachos" cargando={!s} />
          <Stat tono="oscuro" etiqueta="Recargado 30 días" valor={s?.recargado_30d ?? 0} formato={usd} icono={<Wallet size={18} />} pista="entró a los wallets" cargando={!s} />
          <Stat etiqueta="Saldo en wallets" valor={s?.saldo_total_wallets ?? 0} formato={usd} icono={<Wallet size={18} />} tono="verde" pista="dinero de clientes por usar" cargando={!s} />
          <Stat etiqueta="Clientes" valor={s?.clientes ?? 0} icono={<Users size={18} />} tono="azul" pista={s ? `+${s.clientes_nuevos_30d} en 30 días${s.bloqueados ? ` · ${s.bloqueados} bloqueados` : ''}` : undefined} cargando={!s} />
        </div>
      </Aparece>

      <div className="grid gap-6 xl:grid-cols-3">
        <Aparece retraso={0.1} className="xl:col-span-2">
          <Seccion titulo="Ingresos por día" ayuda="Cobros de despacho de los últimos 30 días.">
            {!s ? <Skeleton className="h-60 w-full" /> : <AreaTendencia datos={s.serie_30d} x="dia" xFormato={diaCorto} formato={usdCorto} series={[{ clave: 'ingresos', etiqueta: 'Ingresos', color: PALETA.naranja }]} resumen={`Ingresos de 30 días: ${usd(s.ingresos_30d)}`} />}
          </Seccion>
        </Aparece>
        <Aparece retraso={0.12}>
          <Seccion titulo="Paquetes por estado" ayuda="Todos los clientes.">
            {!s ? <Skeleton className="h-52 w-full" /> : (
              <Dona resumen="Paquetes por estado" centro={<><b className="font-heading text-3xl font-black text-primary">{num(Object.values(s.paquetes).reduce((a, b) => a + b, 0))}</b><span className="text-xs text-muted-foreground">paquetes</span></>}
                datos={[{ nombre: 'Prealertados', valor: p('prealertado'), color: PALETA.ambar }, { nombre: 'En bodega', valor: p('recibido'), color: PALETA.celeste }, { nombre: 'Alistamiento', valor: p('alistamiento'), color: PALETA.indigo }, { nombre: 'Despachados', valor: p('despachado'), color: PALETA.naranja }, { nombre: 'Entregados', valor: p('entregado'), color: PALETA.verde }]} />
            )}
          </Seccion>
        </Aparece>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Aparece retraso={0.14} className="xl:col-span-2">
          <Seccion titulo="Operación de la bodega" ayuda="Paquetes recibidos y despachados por día.">
            {!s ? <Skeleton className="h-56 w-full" /> : <Barras datos={s.flujo_30d} x="dia" xFormato={diaCorto} series={[{ clave: 'recibidos', etiqueta: 'Recibidos', color: PALETA.marino }, { clave: 'despachados', etiqueta: 'Despachados', color: PALETA.naranja }]} alto={220} resumen="Paquetes recibidos y despachados por día" />}
          </Seccion>
        </Aparece>
        <Aparece retraso={0.16}>
          <Seccion titulo="Mejores clientes" ayuda="Por gasto en los últimos 30 días.">
            {!s ? <Skeleton className="h-48 w-full" /> : <BarrasHorizontales datos={s.top_clientes_30d.map((c) => ({ ...c, etiqueta: `${c.codigo} · ${c.nombre}` }))} nombre="etiqueta" valor="gasto" formato={usd} resumen="Clientes con más gasto" />}
          </Seccion>
        </Aparece>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Aparece retraso={0.18} className="xl:col-span-2">
          <Seccion titulo="Ingresos y recargas, 6 meses">
            {!s ? <Skeleton className="h-56 w-full" /> : <Barras datos={s.ingresos_6m} x="mes" xFormato={mesCorto} formato={usdCorto} series={[{ clave: 'recargas', etiqueta: 'Recargas', color: PALETA.marino }, { clave: 'ingresos', etiqueta: 'Ingresos (despachos)', color: PALETA.naranja }]} alto={220} resumen="Ingresos y recargas de seis meses" />}
          </Seccion>
        </Aparece>
        <Aparece retraso={0.2}>
          <Seccion titulo="Ventas de los clientes" ayuda="Unidades por origen, 30 días.">
            {!s ? <Skeleton className="h-48 w-full" /> : (
              <Dona resumen="Ventas por origen" centro={<><b className="font-heading text-3xl font-black text-primary">{num(s.ventas_por_origen_30d.reduce((a, o) => a + o.unidades, 0))}</b><span className="text-xs text-muted-foreground">unidades</span></>}
                datos={s.ventas_por_origen_30d.map((o) => ({ nombre: NOMBRE_ORIGEN[o.origen] ?? o.origen, valor: o.unidades, color: COLOR_ORIGEN[o.origen] ?? PALETA.gris }))} />
            )}
            {s && <div className="mt-4 grid grid-cols-2 gap-3 border-t border-gray-100 pt-4 text-sm"><div><p className="text-xs text-muted-foreground">Productos</p><p className="flex items-center gap-1.5 font-bold text-primary"><Boxes size={14} />{num(s.inventario.productos)}</p></div><div><p className="text-xs text-muted-foreground">Con stock bajo</p><p className="font-bold text-primary">{num(s.inventario.stock_bajo)}</p></div></div>}
          </Seccion>
        </Aparece>
      </div>
    </div>
  );
}
