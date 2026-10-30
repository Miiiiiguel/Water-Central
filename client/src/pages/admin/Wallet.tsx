import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Check, CircleDollarSign, Clock, PiggyBank, Plus, ShieldCheck, TrendingUp, X } from 'lucide-react';
import { Aparece, AreaTexto, Boton, Campo, EstadoVacio, Etiqueta, Modal, PageHeader, Seccion, Segmentos, Skeleton, Stat, useAsync, useConfirmar } from '@/portal/ui';
import DataTable, { type Columna } from '@/portal/DataTable';
import { Barras, Dona, PALETA } from '@/portal/charts';
import { hace, iniciales, mesCorto, usd, usdCorto } from '@/portal/format';
import { AjustarSaldo } from '@/portal/clientes';
import { leerTodo, quien, useAdmin, type Dueno } from '@/portal/admin';
import { db, type MovimientoWallet } from '@/lib/casillero';

type Mov = MovimientoWallet & { wompi_ref: string | null; profiles: Dueno | null };
type Filtro = 'todos' | 'recarga' | 'cargo' | 'ajuste';

const COLOR_METODO: Record<string, string> = { wompi: PALETA.naranja, Transferencia: PALETA.marino, Zelle: PALETA.indigo, Efectivo: PALETA.verde, Otro: PALETA.gris };
const TIPO: Record<MovimientoWallet['tipo'], string> = { recarga: 'Recarga', cargo: 'Cobro de despacho', ajuste: 'Ajuste' };

export default function Wallet() {
  const { stats: s, recargar: recargarStats } = useAdmin();
  const confirmar = useConfirmar();
  const d = useAsync(async () => {
    const s = await db();
    return leerTodo<Mov>((a, b) => s.from('casillero_wallet').select('*, profiles(full_name, casillero_codigo, email)').order('created_at', { ascending: false }).order('id').range(a, b), 10_000);
  }, []);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [ajuste, setAjuste] = useState(false);
  const [rechazo, setRechazo] = useState<Mov | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const movs = d.datos ?? [];
  const pendientes = useMemo(() => movs.filter((m) => m.tipo === 'recarga' && m.estado === 'pendiente').sort((a, b) => a.created_at.localeCompare(b.created_at)), [movs]);
  const visibles = useMemo(() => movs.filter((m) => filtro === 'todos' || m.tipo === filtro), [movs, filtro]);
  const porMetodo = useMemo(() => {
    const t = new Map<string, number>();
    for (const m of movs) if (m.tipo === 'recarga' && m.estado === 'aprobado') { const k = m.metodo === 'wompi' ? 'wompi' : m.metodo ?? 'Otro'; t.set(k, (t.get(k) ?? 0) + Number(m.monto)); }
    return Array.from(t.entries()).map(([k, v]) => ({ nombre: k === 'wompi' ? 'Wompi' : k, valor: Math.round(v * 100) / 100, color: COLOR_METODO[k] ?? PALETA.gris })).sort((a, b) => b.valor - a.valor);
  }, [movs]);
  const cambio = async () => { await Promise.all([d.recargar(), recargarStats()]); };

  const aprobar = async (m: Mov) => {
    const wompi = !!m.wompi_ref;
    if (!(await confirmar({
      titulo: `Aprobar ${usd(m.monto)} de ${m.profiles?.full_name ?? m.profiles?.casillero_codigo}`,
      texto: wompi ? 'Esta recarga espera el pago en Wompi, que la aprueba sola cuando se confirma. Aprueba a mano solo si ya viste el pago aprobado en el panel de Wompi.' : <>Confirma que el dinero ya está en tu cuenta ({m.metodo}{m.referencia ? ` · ${m.referencia}` : ''}). El cliente verá el saldo de inmediato.</>,
      confirmar: 'Aprobar y acreditar',
    }))) return;
    setOcupado(m.id);
    const { error } = await (await db()).rpc('casillero_resolver_recarga', { p_id: m.id, p_aprobar: true, p_nota: null });
    setOcupado(null);
    if (error) { toast.error(error.message); return cambio(); }
    toast.success(`${usd(m.monto)} acreditados a ${m.profiles?.casillero_codigo}`);
    await cambio();
  };

  const columnas: Columna<Mov>[] = [
    { clave: 'fecha', titulo: 'Fecha', movil: 'titulo', orden: (m) => m.created_at, celda: (m) => <span className="whitespace-nowrap font-semibold text-primary" title={new Date(m.created_at).toLocaleString('es-CO')}>{hace(m.created_at)}</span> },
    { clave: 'cliente', titulo: 'Cliente', orden: (m) => m.profiles?.casillero_codigo ?? '', celda: (m) => <span className="whitespace-nowrap">{quien(m.profiles)}</span> },
    { clave: 'tipo', titulo: 'Tipo', celda: (m) => <span className="whitespace-nowrap">{TIPO[m.tipo]}</span> },
    { clave: 'detalle', titulo: 'Detalle', celda: (m) => <span className="line-clamp-1 text-muted-foreground">{[m.metodo === 'wompi' ? 'Wompi' : m.metodo, m.referencia].filter(Boolean).join(' · ') || '—'}</span> },
    { clave: 'monto', titulo: 'Monto', alinear: 'der', orden: (m) => Number(m.monto), celda: (m) => <b className={`tabular-nums ${Number(m.monto) < 0 ? 'text-red-600' : 'text-green-700'}`}>{Number(m.monto) > 0 ? '+' : ''}{usd(m.monto)}</b> },
    { clave: 'estado', titulo: 'Estado', orden: (m) => m.estado, celda: (m) => <Etiqueta estado={m.estado} /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader titulo="Wallet y recargas" subtitulo="Verifique las recargas por transferencia, ajuste saldos con motivo y siga el dinero que entra y sale." acciones={<Boton variante="primario" onClick={() => setAjuste(true)} icono={<Plus size={16} />}>Ajustar saldo</Boton>} />

      <Aparece>
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <Stat tono="naranja" etiqueta="Por verificar" valor={s?.recargas_pendientes ?? 0} icono={<Clock size={18} />} pista={s ? `${usd(s.recargas_pendientes_usd)} esperando` : undefined} cargando={!s} />
          <Stat tono="oscuro" etiqueta="Saldo de clientes" valor={s?.saldo_total_wallets ?? 0} formato={usd} icono={<PiggyBank size={18} />} pista="dinero por usar en despachos" cargando={!s} />
          <Stat etiqueta="Recargado 30 días" valor={s?.recargado_30d ?? 0} formato={usd} icono={<TrendingUp size={18} />} tono="verde" cargando={!s} />
          <Stat etiqueta="Cobrado 30 días" valor={s?.ingresos_30d ?? 0} formato={usd} icono={<CircleDollarSign size={18} />} tono="azul" pista="en despachos" cargando={!s} />
        </div>
      </Aparece>

      <Aparece retraso={0.05}>
        <Seccion titulo="Recargas por verificar" ayuda={pendientes.length ? 'La más antigua primero. Aprueba solo cuando veas el dinero en tu cuenta.' : undefined}>
          {d.cargando ? <Skeleton className="h-28 w-full" /> : !pendientes.length ? (
            <EstadoVacio icono={<ShieldCheck size={26} />} titulo="Todo verificado" texto="No hay recargas esperando. Cuando un cliente reporte una transferencia, aparecerá aquí." />
          ) : (
            <ul className="grid gap-3 lg:grid-cols-2">
              {pendientes.map((m) => (
                <li key={m.id} className="flex flex-col gap-3 rounded-2xl border border-accent/25 bg-secondary/40 p-4">
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-black text-white">{iniciales(m.profiles?.full_name, m.profiles?.email)}</span>
                    <div className="min-w-0 flex-1"><p className="truncate font-bold text-primary">{quien(m.profiles)}</p><p className="truncate text-xs text-muted-foreground">{m.metodo === 'wompi' ? 'Wompi · esperando el pago' : m.metodo}{m.referencia && m.metodo !== 'wompi' ? ` · ${m.referencia}` : ''} · {hace(m.created_at)}</p></div>
                    <b className="font-heading text-2xl font-black text-primary">{usd(m.monto)}</b>
                  </div>
                  <div className="flex gap-2">
                    <Boton chico variante="primario" className="flex-1" cargando={ocupado === m.id} onClick={() => void aprobar(m)} icono={<Check size={14} />}>Aprobar</Boton>
                    <Boton chico variante="peligro" className="flex-1" disabled={ocupado === m.id} onClick={() => setRechazo(m)} icono={<X size={14} />}>{m.wompi_ref ? 'Descartar' : 'Rechazar'}</Boton>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Seccion>
      </Aparece>

      <div className="grid gap-6 xl:grid-cols-3">
        <Aparece retraso={0.1} className="xl:col-span-2">
          <Seccion titulo="Entra y sale, 6 meses" ayuda="Recargas aprobadas frente a lo cobrado en despachos.">
            {!s ? <Skeleton className="h-56 w-full" /> : <Barras datos={s.ingresos_6m} x="mes" xFormato={mesCorto} formato={usdCorto} alto={230} series={[{ clave: 'recargas', etiqueta: 'Recargas', color: PALETA.marino }, { clave: 'ingresos', etiqueta: 'Cobrado en despachos', color: PALETA.naranja }]} resumen="Recargas y cobros de despacho de seis meses" />}
          </Seccion>
        </Aparece>
        <Aparece retraso={0.12}>
          <Seccion titulo="Cómo recargan" ayuda="Total aprobado por método.">
            {d.cargando ? <Skeleton className="h-48 w-full" /> : <Dona resumen="Recargas por método de pago" centro={<><b className="font-heading text-2xl font-black text-primary">{usdCorto(porMetodo.reduce((a, x) => a + x.valor, 0))}</b><span className="text-xs text-muted-foreground">recargado</span></>} datos={porMetodo.map((x) => ({ ...x, valor: x.valor }))} />}
          </Seccion>
        </Aparece>
      </div>

      <Aparece retraso={0.14}>
        <DataTable
          columnas={columnas} filas={visibles} id={(m) => m.id} cargando={d.cargando} porPagina={25}
          buscar={(m) => `${m.referencia ?? ''} ${m.metodo ?? ''} ${m.profiles?.casillero_codigo ?? ''} ${m.profiles?.full_name ?? ''} ${m.profiles?.email ?? ''}`} textoBuscar="Buscar cliente, método o referencia"
          filtros={<Segmentos valor={filtro} onCambio={setFiltro} opciones={[{ valor: 'todos', etiqueta: 'Todos' }, { valor: 'recarga', etiqueta: 'Recargas' }, { valor: 'cargo', etiqueta: 'Cobros' }, { valor: 'ajuste', etiqueta: 'Ajustes' }]} />}
          exportar={{ nombre: 'wallet', fila: (m) => ({ fecha: m.created_at, cliente: quien(m.profiles), tipo: m.tipo, metodo: m.metodo, referencia: m.referencia, monto_usd: m.monto, estado: m.estado }) }}
          ordenInicial={{ clave: 'fecha', asc: false }}
        />
      </Aparece>

      <AjustarSaldo abierto={ajuste} onCerrar={() => setAjuste(false)} onListo={cambio} />
      <Rechazar mov={rechazo} onCerrar={() => setRechazo(null)} onListo={cambio} />
    </div>
  );
}

function Rechazar({ mov, onCerrar, onListo }: { mov: Mov | null; onCerrar: () => void; onListo: () => Promise<void> }) {
  const [nota, setNota] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const enviar = async () => {
    if (!mov) return;
    setOcupado(true);
    const { error } = await (await db()).rpc('casillero_resolver_recarga', { p_id: mov.id, p_aprobar: false, p_nota: nota.trim() || null });
    setOcupado(false);
    if (error) toast.error(error.message); else toast.success('Recarga rechazada y cliente avisado');
    setNota(''); onCerrar(); await onListo();
  };
  return (
    <Modal abierto={!!mov} onCerrar={onCerrar} titulo={mov?.wompi_ref ? 'Descartar recarga de Wompi' : 'Rechazar recarga'} descripcion={mov ? `${usd(mov.monto)} de ${quien(mov.profiles)}` : undefined} ancho="max-w-lg">
      <div className="space-y-4">
        <Campo etiqueta="Motivo (el cliente lo verá)" id="rz-nota" ayuda="Por ejemplo: «No encontramos la transferencia» o «El comprobante no coincide»."><AreaTexto id="rz-nota" value={nota} onChange={(e) => setNota(e.target.value)} maxLength={200} /></Campo>
        <div className="flex justify-end gap-2"><Boton onClick={onCerrar}>Volver</Boton><Boton variante="peligro" cargando={ocupado} onClick={() => void enviar()}>{mov?.wompi_ref ? 'Descartar' : 'Rechazar'}</Boton></div>
      </div>
    </Modal>
  );
}
