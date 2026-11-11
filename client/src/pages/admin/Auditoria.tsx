import { useMemo, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { Aparece, ErrorCarga, EstadoVacio, Etiqueta, PageHeader, Seleccion, useAsync } from '@/portal/ui';
import DataTable, { type Columna } from '@/portal/DataTable';
import { fechaHora, hace } from '@/portal/format';
import { db } from '@/lib/casillero';
import { TABLAS, diferencias, resumen, titulo, valorLegible, type FilaAuditoria } from '@/lib/auditoria';

// Quién del equipo cambió qué y cuándo. Solo se anota lo que hace una persona
// del equipo a mano (no lo que hace el sistema ni lo que hace un cliente).

type Fila = FilaAuditoria & { quien: string };
const TONO = { INSERT: 'verde', UPDATE: 'azul', DELETE: 'rojo' } as const;
const NOMBRE_ACCION = { INSERT: 'Creó', UPDATE: 'Modificó', DELETE: 'Eliminó' } as const;

function Detalle({ f }: { f: Fila }) {
  const dif = diferencias(f);
  if (!dif.length) return <p className="text-sm text-muted-foreground">Sin más detalle.</p>;
  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white">
      <table className="w-full text-sm">
        <thead className="text-left text-xs font-bold uppercase tracking-wider text-muted-foreground"><tr><th className="px-4 py-2.5">Campo</th>{f.accion !== 'INSERT' && <th className="px-4 py-2.5">Antes</th>}{f.accion !== 'DELETE' && <th className="px-4 py-2.5">{f.accion === 'UPDATE' ? 'Después' : 'Valor'}</th>}</tr></thead>
        <tbody className="[&_td]:border-t [&_td]:border-gray-100 [&_td]:px-4 [&_td]:py-2 [&_td]:align-top">
          {dif.map((d) => (
            <tr key={d.campo}>
              <td className="whitespace-nowrap font-mono text-xs font-semibold text-primary">{d.campo}</td>
              {f.accion !== 'INSERT' && <td className="break-all text-red-700/80">{valorLegible(d.antes)}</td>}
              {f.accion !== 'DELETE' && <td className="break-all font-semibold text-green-700">{valorLegible(d.despues)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Auditoria() {
  const d = useAsync(async () => {
    const s = await db();
    const { data, error } = await s.from('casillero_auditoria').select('*').order('id', { ascending: false }).limit(1000);
    if (error) throw error;
    const filas = (data ?? []) as FilaAuditoria[];
    const ids = Array.from(new Set(filas.map((f) => f.actor).filter((x): x is string => !!x)));
    const nombres = new Map<string, string>();
    if (ids.length) {
      const { data: ps } = await s.from('profiles').select('id, full_name, email').in('id', ids.slice(0, 200));
      for (const p of (ps ?? []) as { id: string; full_name: string | null; email: string }[]) nombres.set(p.id, p.full_name || p.email);
    }
    return filas.map((f) => ({ ...f, quien: f.actor ? nombres.get(f.actor) ?? 'Alguien del equipo' : 'Sistema' })) as Fila[];
  }, []);
  const [tabla, setTabla] = useState('todas');
  const [accion, setAccion] = useState('todas');
  const [quien, setQuien] = useState('todos');
  const [rango, setRango] = useState('30');

  const filas = d.datos ?? [];
  const personas = useMemo(() => Array.from(new Set(filas.map((f) => f.quien))).sort(), [filas]);
  const visibles = useMemo(() => {
    const desde = rango === 'todo' ? 0 : Date.now() - Number(rango) * 86_400_000;
    return filas.filter((f) => (tabla === 'todas' || f.tabla === tabla) && (accion === 'todas' || f.accion === accion) && (quien === 'todos' || f.quien === quien) && new Date(f.created_at).getTime() >= desde);
  }, [filas, tabla, accion, quien, rango]);

  const columnas: Columna<Fila>[] = [
    { clave: 'cuando', titulo: 'Cuándo', movil: 'titulo', orden: (f) => f.created_at, celda: (f) => <span className="whitespace-nowrap font-semibold text-primary" title={fechaHora(f.created_at)}>{hace(f.created_at)}</span> },
    { clave: 'quien', titulo: 'Quién', orden: (f) => f.quien, celda: (f) => <span className="whitespace-nowrap">{f.quien}</span> },
    { clave: 'accion', titulo: 'Acción', orden: (f) => f.accion, celda: (f) => <Etiqueta tono={TONO[f.accion] ?? 'gris'}>{NOMBRE_ACCION[f.accion] ?? f.accion}</Etiqueta> },
    { clave: 'sobre', titulo: 'Sobre', celda: (f) => <span className="whitespace-nowrap text-muted-foreground">{TABLAS[f.tabla]?.muchos ?? f.tabla}</span> },
    { clave: 'detalle', titulo: 'Detalle', celda: (f) => <span className="line-clamp-2 text-foreground">{resumen(f) || titulo(f)}</span> },
  ];

  if (d.error && !d.datos) return <ErrorCarga mensaje={d.error} onReintentar={() => void d.recargar()} />;

  return (
    <div className="space-y-6">
      <PageHeader titulo="Auditoría" subtitulo="El registro de lo que el equipo cambió. Toca una fila para ver el antes y el después." />
      <Aparece>
        <DataTable
          columnas={columnas} filas={visibles} id={(f) => String(f.id)} cargando={d.cargando} porPagina={25}
          buscar={(f) => `${f.quien} ${resumen(f)} ${f.fila ?? ''} ${TABLAS[f.tabla]?.muchos ?? f.tabla}`} textoBuscar="Buscar persona, guía, cliente o campo"
          filtros={
            <div className="flex flex-wrap gap-2">
              <Seleccion aria-label="Sobre qué" className="!w-auto" value={tabla} onChange={(e) => setTabla(e.target.value)}><option value="todas">Todo</option>{Object.entries(TABLAS).map(([k, t]) => <option key={k} value={k}>{t.muchos}</option>)}</Seleccion>
              <Seleccion aria-label="Acción" className="!w-auto" value={accion} onChange={(e) => setAccion(e.target.value)}><option value="todas">Cualquier acción</option><option value="INSERT">Creó</option><option value="UPDATE">Modificó</option><option value="DELETE">Eliminó</option></Seleccion>
              <Seleccion aria-label="Quién" className="!w-auto" value={quien} onChange={(e) => setQuien(e.target.value)}><option value="todos">Todo el equipo</option>{personas.map((p) => <option key={p}>{p}</option>)}</Seleccion>
              <Seleccion aria-label="Periodo" className="!w-auto" value={rango} onChange={(e) => setRango(e.target.value)}><option value="1">Hoy</option><option value="7">7 días</option><option value="30">30 días</option><option value="90">90 días</option><option value="todo">Todo</option></Seleccion>
            </div>
          }
          exportar={{ nombre: 'auditoria', fila: (f) => ({ fecha: f.created_at, quien: f.quien, accion: f.accion, sobre: TABLAS[f.tabla]?.muchos ?? f.tabla, detalle: resumen(f) }) }}
          expandida={(f) => <Detalle f={f} />}
          vacio={<EstadoVacio icono={<ClipboardList size={26} />} titulo="Sin movimientos con estos filtros" texto="Cada cambio que haga el equipo aparecerá aquí." />}
          ordenInicial={{ clave: 'cuando', asc: false }}
        />
      </Aparece>
    </div>
  );
}
