import { Fragment, ReactNode, useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, Download, Search } from 'lucide-react';
import { downloadCSV } from '@/lib/csv';
import { Boton, Card, Entrada, Seleccion, Skeleton, cn } from './ui';

// Tabla del portal: búsqueda, orden, paginación, selección, fila expandible,
// exportar a CSV y, en pantallas chicas, cada fila se vuelve una tarjeta.

export interface Columna<T> {
  clave: string;
  titulo: string;
  celda: (f: T) => ReactNode;
  /** Valor por el que se ordena al pulsar el encabezado. Sin esto, la columna no ordena. */
  orden?: (f: T) => string | number;
  alinear?: 'izq' | 'der';
  /** En tarjeta móvil: 'titulo' es el encabezado de la tarjeta; 'oculta' no se muestra. */
  movil?: 'titulo' | 'normal' | 'oculta';
  className?: string;
}

interface Props<T> {
  columnas: Columna<T>[];
  filas: T[];
  id: (f: T) => string;
  cargando?: boolean;
  buscar?: (f: T) => string;
  textoBuscar?: string;
  filtros?: ReactNode;
  acciones?: ReactNode;
  porPagina?: number;
  onFila?: (f: T) => void;
  vacio?: ReactNode;
  exportar?: { nombre: string; fila: (f: T) => Record<string, unknown> };
  seleccion?: { ids: string[]; onCambio: (ids: string[]) => void };
  expandida?: (f: T) => ReactNode;
  ordenInicial?: { clave: string; asc: boolean };
  /** Barra que aparece cuando hay filas seleccionadas. */
  barraSeleccion?: ReactNode;
}

export default function DataTable<T>({ columnas, filas, id, cargando, buscar, textoBuscar = 'Buscar…', filtros, acciones, porPagina = 10, onFila, vacio, exportar, seleccion, expandida, ordenInicial, barraSeleccion }: Props<T>) {
  const [q, setQ] = useState('');
  const [pagina, setPagina] = useState(0);
  const [tam, setTam] = useState(porPagina);
  const [orden, setOrden] = useState<{ clave: string; asc: boolean } | null>(ordenInicial ?? null);
  const [abierta, setAbierta] = useState<string | null>(null);

  const visibles = useMemo(() => {
    let r = buscar && q.trim() ? filas.filter((f) => buscar(f).toLowerCase().includes(q.trim().toLowerCase())) : filas;
    const col = orden && columnas.find((c) => c.clave === orden.clave);
    if (col?.orden && orden) {
      const o = col.orden;
      r = [...r].sort((a, b) => { const x = o(a); const y = o(b); return (x < y ? -1 : x > y ? 1 : 0) * (orden.asc ? 1 : -1); });
    }
    return r;
  }, [filas, q, orden, columnas, buscar]);

  const paginas = Math.max(1, Math.ceil(visibles.length / tam));
  useEffect(() => { if (pagina >= paginas) setPagina(paginas - 1); }, [pagina, paginas]);
  useEffect(() => { setPagina(0); }, [q, filas.length]);
  const desde = pagina * tam;
  const pag = visibles.slice(desde, desde + tam);

  const alternar = (clave: string) => setOrden((o) => (o?.clave !== clave ? { clave, asc: true } : o.asc ? { clave, asc: false } : null));
  const todasMarcadas = !!seleccion && pag.length > 0 && pag.every((f) => seleccion.ids.includes(id(f)));
  const marcar = (f: T, on: boolean) => seleccion && seleccion.onCambio(on ? [...seleccion.ids, id(f)] : seleccion.ids.filter((x) => x !== id(f)));
  const marcarPagina = (on: boolean) => seleccion && seleccion.onCambio(on ? Array.from(new Set([...seleccion.ids, ...pag.map(id)])) : seleccion.ids.filter((x) => !pag.some((f) => id(f) === x)));

  const titulo = columnas.find((c) => c.movil === 'titulo') ?? columnas[0];
  const enMovil = columnas.filter((c) => c !== titulo && c.movil !== 'oculta' && c.titulo !== '');
  const accionesMovil = columnas.filter((c) => c !== titulo && c.titulo === '');

  const hayBarra = buscar || filtros || acciones || exportar;

  return (
    <Card className="p-0 md:p-0">
      {hayBarra && (
        <div className="flex flex-wrap items-end gap-3 border-b border-gray-100 p-4">
          {buscar && (
            <div className="relative min-w-52 flex-1">
              <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <Entrada aria-label={textoBuscar} placeholder={textoBuscar} value={q} onChange={(e) => setQ(e.target.value)} className="pl-10" />
            </div>
          )}
          {filtros}
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {exportar && <Boton chico variante="suave" icono={<Download size={14} />} disabled={!visibles.length} onClick={() => downloadCSV(`${exportar.nombre}.csv`, visibles.map(exportar.fila))}>CSV</Boton>}
            {acciones}
          </div>
        </div>
      )}
      {seleccion && seleccion.ids.length > 0 && barraSeleccion && <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 bg-secondary/60 px-4 py-3 text-sm">{barraSeleccion}</div>}

      {/* Escritorio */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {seleccion && <th className="w-10 px-4 py-3"><input type="checkbox" aria-label="Marcar la página" checked={todasMarcadas} onChange={(e) => marcarPagina(e.target.checked)} /></th>}
              {columnas.map((c) => (
                <th key={c.clave} className={cn('whitespace-nowrap px-4 py-3', c.alinear === 'der' && 'text-right', c.className)} aria-sort={orden?.clave === c.clave ? (orden.asc ? 'ascending' : 'descending') : undefined}>
                  {c.orden ? (
                    <button type="button" onClick={() => alternar(c.clave)} className="inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 font-bold uppercase tracking-wider text-muted-foreground hover:text-primary">
                      {c.titulo}{orden?.clave === c.clave ? (orden.asc ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ChevronsUpDown size={12} className="opacity-40" />}
                    </button>
                  ) : c.titulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cargando && Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-gray-50">{Array.from({ length: columnas.length + (seleccion ? 1 : 0) }).map((__, j) => <td key={j} className="px-4 py-4"><Skeleton className="h-4 w-full max-w-32" /></td>)}</tr>
            ))}
            {!cargando && pag.map((f) => {
              const k = id(f);
              return (
                <Fragment key={k}>
                  <tr
                    className={cn('border-b border-gray-50 transition-colors', (onFila || expandida) && 'cursor-pointer hover:bg-gray-50/80', seleccion?.ids.includes(k) && 'bg-secondary/40')}
                    onClick={() => (expandida ? setAbierta(abierta === k ? null : k) : onFila?.(f))}
                  >
                    {seleccion && <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label="Marcar fila" checked={seleccion.ids.includes(k)} onChange={(e) => marcar(f, e.target.checked)} /></td>}
                    {columnas.map((c) => <td key={c.clave} className={cn('px-4 py-3 align-middle', c.alinear === 'der' && 'text-right', c.className)}>{c.celda(f)}</td>)}
                  </tr>
                  {expandida && abierta === k && <tr className="border-b border-gray-50 bg-gray-50/60"><td colSpan={columnas.length + (seleccion ? 1 : 0)} className="px-4 py-4">{expandida(f)}</td></tr>}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Celular: una tarjeta por fila */}
      <ul className="divide-y divide-gray-100 md:hidden">
        {cargando && Array.from({ length: 4 }).map((_, i) => <li key={i} className="space-y-2 p-4"><Skeleton className="h-5 w-1/2" /><Skeleton className="h-4 w-3/4" /></li>)}
        {!cargando && pag.map((f) => {
          const k = id(f);
          return (
            <li key={k} className={cn('p-4', seleccion?.ids.includes(k) && 'bg-secondary/40')}>
              <div className="flex items-start gap-3" onClick={() => (expandida ? setAbierta(abierta === k ? null : k) : onFila?.(f))}>
                {seleccion && <input type="checkbox" aria-label="Marcar fila" className="mt-1" checked={seleccion.ids.includes(k)} onClick={(e) => e.stopPropagation()} onChange={(e) => marcar(f, e.target.checked)} />}
                <div className="min-w-0 flex-1 font-semibold text-primary">{titulo.celda(f)}</div>
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {enMovil.map((c) => <div key={c.clave} className="min-w-0"><dt className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{c.titulo}</dt><dd className="mt-0.5 break-words">{c.celda(f)}</dd></div>)}
              </dl>
              {accionesMovil.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{accionesMovil.map((c) => <Fragment key={c.clave}>{c.celda(f)}</Fragment>)}</div>}
              {expandida && abierta === k && <div className="mt-3 rounded-2xl bg-gray-50 p-3">{expandida(f)}</div>}
            </li>
          );
        })}
      </ul>

      {!cargando && !pag.length && <div>{vacio ?? <p className="p-8 text-center text-sm text-muted-foreground">{q ? `Nada coincide con “${q}”.` : 'Sin resultados.'}</p>}</div>}

      {visibles.length > Math.min(10, tam) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-4 py-3 text-sm text-muted-foreground">
          <span className="tabular-nums">{visibles.length ? `${desde + 1}–${Math.min(desde + tam, visibles.length)} de ${visibles.length}` : '0'}</span>
          <div className="flex items-center gap-2">
            <Seleccion aria-label="Filas por página" value={tam} onChange={(e) => { setTam(Number(e.target.value)); setPagina(0); }} className="!w-auto !py-1.5 text-xs">{[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n} por página</option>)}</Seleccion>
            <Boton chico variante="suave" aria-label="Página anterior" disabled={pagina === 0} onClick={() => setPagina((p) => p - 1)}><ChevronLeft size={14} /></Boton>
            <span className="tabular-nums text-xs">{pagina + 1}/{paginas}</span>
            <Boton chico variante="suave" aria-label="Página siguiente" disabled={pagina >= paginas - 1} onClick={() => setPagina((p) => p + 1)}><ChevronRight size={14} /></Boton>
          </div>
        </div>
      )}
    </Card>
  );
}
