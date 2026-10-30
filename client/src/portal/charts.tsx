import { ReactNode, useId } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

// Gráficas del portal: una sola paleta, un solo tooltip, y un resumen de
// texto accesible (aria-label) para quien no puede ver el dibujo.

export const PALETA = {
  naranja: '#FF5A36', marino: '#1B1A45', indigo: '#6C63FF', verde: '#16A34A', ambar: '#F59E0B', celeste: '#0EA5E9', gris: '#9CA3AF', rojo: '#EF4444',
  shopify: '#5E8E3E', woocommerce: '#7F54B3', api: '#1B1A45', manual: '#9CA3AF',
} as const;

export const COLOR_ORIGEN: Record<string, string> = { shopify: PALETA.shopify, woocommerce: PALETA.woocommerce, api: PALETA.api, manual: PALETA.manual, bodega: PALETA.manual };
export const NOMBRE_ORIGEN: Record<string, string> = { shopify: 'Shopify', woocommerce: 'WordPress', api: 'API', manual: 'Manual', bodega: 'Bodega' };

export interface Serie { clave: string; etiqueta: string; color: string }

const EJE = { fontSize: 11, fill: '#6B6B85' } as const;

function TooltipTarjeta({ active, payload, label, formato, etiquetaX }: { active?: boolean; payload?: { name?: string; value?: number; color?: string; dataKey?: string }[]; label?: string; formato: (n: number) => string; etiquetaX?: (x: string) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-2xl border border-gray-100 bg-white px-3.5 py-2.5 text-xs shadow-xl">
      {label !== undefined && <p className="mb-1.5 font-bold text-primary">{etiquetaX ? etiquetaX(String(label)) : label}</p>}
      <ul className="space-y-1">
        {payload.map((p) => (
          <li key={p.dataKey} className="flex items-center justify-between gap-5">
            <span className="flex items-center gap-1.5 text-muted-foreground"><span className="h-2 w-2 rounded-full" style={{ background: p.color }} />{p.name}</span>
            <b className="tabular-nums text-primary">{formato(Number(p.value ?? 0))}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SinDatos({ alto, texto = 'Aún no hay datos para mostrar.' }: { alto: number; texto?: string }) {
  return <div style={{ height: alto }} className="flex items-center justify-center rounded-2xl border border-dashed border-gray-200 text-sm text-muted-foreground">{texto}</div>;
}

export function Leyenda({ series }: { series: Serie[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {series.map((s) => <li key={s.clave} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />{s.etiqueta}</li>)}
    </ul>
  );
}

interface BaseProps { datos: Record<string, any>[]; x: string; series: Serie[]; alto?: number; formato?: (n: number) => string; xFormato?: (x: string) => string; resumen: string; leyenda?: boolean }

/** Área con degradado (una o varias series). */
export function AreaTendencia({ datos, x, series, alto = 240, formato = (n) => String(n), xFormato, resumen, leyenda = series.length > 1, apilado = false }: BaseProps & { apilado?: boolean }) {
  const id = useId().replace(/:/g, '');
  if (!datos.length || datos.every((d) => series.every((s) => !Number(d[s.clave])))) return <SinDatos alto={alto} />;
  return (
    <div role="img" aria-label={resumen}>
      <div style={{ height: alto }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={datos} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            <defs>{series.map((s) => (
              <linearGradient key={s.clave} id={`${id}-${s.clave}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.35} /><stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
              </linearGradient>))}
            </defs>
            <CartesianGrid vertical={false} stroke="#EEEEF5" />
            <XAxis dataKey={x} tick={EJE} tickLine={false} axisLine={false} tickFormatter={xFormato} minTickGap={22} />
            <YAxis tick={EJE} tickLine={false} axisLine={false} tickFormatter={formato} width={52} />
            <Tooltip content={<TooltipTarjeta formato={formato} etiquetaX={xFormato} />} cursor={{ stroke: '#d9d9e8' }} />
            {series.map((s) => <Area key={s.clave} type="monotone" dataKey={s.clave} name={s.etiqueta} stroke={s.color} strokeWidth={2.5} fill={`url(#${id}-${s.clave})`} stackId={apilado ? 'a' : undefined} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />)}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {leyenda && <div className="mt-2"><Leyenda series={series} /></div>}
    </div>
  );
}

/** Barras (agrupadas o apiladas). */
export function Barras({ datos, x, series, alto = 240, formato = (n) => String(n), xFormato, resumen, leyenda = series.length > 1, apiladas = false }: BaseProps & { apiladas?: boolean }) {
  if (!datos.length || datos.every((d) => series.every((s) => !Number(d[s.clave])))) return <SinDatos alto={alto} />;
  return (
    <div role="img" aria-label={resumen}>
      <div style={{ height: alto }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datos} margin={{ top: 8, right: 8, left: -12, bottom: 0 }} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke="#EEEEF5" />
            <XAxis dataKey={x} tick={EJE} tickLine={false} axisLine={false} tickFormatter={xFormato} minTickGap={18} />
            <YAxis tick={EJE} tickLine={false} axisLine={false} tickFormatter={formato} width={52} allowDecimals={false} />
            <Tooltip content={<TooltipTarjeta formato={formato} etiquetaX={xFormato} />} cursor={{ fill: 'rgba(27,26,69,.05)' }} />
            {series.map((s, i) => <Bar key={s.clave} dataKey={s.clave} name={s.etiqueta} fill={s.color} stackId={apiladas ? 'a' : undefined} radius={apiladas ? (i === series.length - 1 ? [6, 6, 0, 0] : 0) : [6, 6, 0, 0]} maxBarSize={36} />)}
          </BarChart>
        </ResponsiveContainer>
      </div>
      {leyenda && <div className="mt-2"><Leyenda series={series} /></div>}
    </div>
  );
}

/** Ranking horizontal: producto/cliente y su valor. */
export function BarrasHorizontales({ datos, nombre, valor, color = PALETA.naranja, formato = (n) => String(n), resumen }: { datos: Record<string, any>[]; nombre: string; valor: string; color?: string; formato?: (n: number) => string; resumen: string }) {
  if (!datos.length) return <SinDatos alto={120} />;
  const max = Math.max(...datos.map((d) => Number(d[valor]) || 0), 1);
  return (
    <ul role="img" aria-label={resumen} className="space-y-3">
      {datos.map((d, i) => (
        <li key={`${d[nombre]}-${i}`}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm"><span className="min-w-0 truncate font-semibold text-primary">{d[nombre]}</span><b className="tabular-nums text-primary">{formato(Number(d[valor]))}</b></div>
          <div className="h-2.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${(Number(d[valor]) / max) * 100}%`, background: color }} /></div>
        </li>
      ))}
    </ul>
  );
}

/** Dona con un valor al centro. */
export function Dona({ datos, centro, alto = 190, resumen }: { datos: { nombre: string; valor: number; color: string }[]; centro?: ReactNode; alto?: number; resumen: string }) {
  const total = datos.reduce((a, d) => a + d.valor, 0);
  if (!total) return <SinDatos alto={alto} />;
  return (
    <div role="img" aria-label={resumen} className="flex flex-col items-center gap-4">
      <div className="relative shrink-0" style={{ height: alto, width: alto }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={datos.filter((d) => d.valor > 0)} dataKey="valor" nameKey="nombre" innerRadius="66%" outerRadius="96%" paddingAngle={3} cornerRadius={6} stroke="none">
              {datos.filter((d) => d.valor > 0).map((d) => <Cell key={d.nombre} fill={d.color} />)}
            </Pie>
            <Tooltip content={<TooltipTarjeta formato={(n) => String(n)} />} />
          </PieChart>
        </ResponsiveContainer>
        {centro && <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">{centro}</div>}
      </div>
      <ul className="w-full min-w-0 space-y-1.5 text-sm">
        {datos.map((d) => <li key={d.nombre} className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-muted-foreground"><span className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />{d.nombre}</span><b className="tabular-nums text-primary">{d.valor}</b></li>)}
      </ul>
    </div>
  );
}

/** Línea mínima para tarjetas. */
export function MiniLinea({ datos, clave, color = PALETA.naranja, alto = 44 }: { datos: Record<string, any>[]; clave: string; color?: string; alto?: number }) {
  if (datos.length < 2) return null;
  return (
    <div style={{ height: alto }} aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={datos} margin={{ top: 4, right: 2, left: 2, bottom: 4 }}>
          <Line type="monotone" dataKey={clave} stroke={color} strokeWidth={2.5} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
