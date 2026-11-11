import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ArrowDownLeft, ArrowUpRight, CircleDollarSign, CreditCard, Info, Receipt, SlidersHorizontal, Wallet as WalletIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Aparece, Boton, Campo, Card, Entrada, Etiqueta, Modal, Seccion, Segmentos, Seleccion, Skeleton, useAsync } from '@/portal/ui';
import DataTable, { type Columna } from '@/portal/DataTable';
import { AreaTendencia, PALETA } from '@/portal/charts';
import { cop, diaCorto, fechaHora, usd, usdCorto } from '@/portal/format';
import { useDatos } from '@/portal/datos';
import { recargarConWompi } from '@/portal/wompi';
import { api, resumenCliente, type MovimientoWallet } from '@/lib/casillero';

const RAPIDOS = [20, 50, 100, 200];

function Concepto({ m }: { m: MovimientoWallet }) {
  const icono = m.tipo === 'recarga' ? <ArrowDownLeft size={15} /> : m.tipo === 'cargo' ? <ArrowUpRight size={15} /> : <SlidersHorizontal size={15} />;
  const titulo = m.tipo === 'recarga' ? 'Recarga' : m.tipo === 'cargo' ? 'Cobro de despacho' : 'Ajuste de saldo';
  return (
    <div className="flex items-center gap-3">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${m.tipo === 'recarga' ? 'bg-green-50 text-green-600' : m.tipo === 'cargo' ? 'bg-secondary text-accent' : 'bg-blue-50 text-blue-600'}`}>{icono}</span>
      <div className="min-w-0"><p className="font-bold text-primary">{titulo}{m.metodo ? <span className="font-normal text-muted-foreground"> · {m.metodo}</span> : null}</p>{m.referencia && <p className="truncate text-xs text-muted-foreground">{m.referencia}</p>}</div>
    </div>
  );
}

export default function Wallet() {
  const { getAccessToken } = useAuth();
  const { movs, saldo, servidor, recargar, cargando } = useDatos();
  const res = useAsync(resumenCliente, []);
  const [monto, setMonto] = useState('50');
  const [pagando, setPagando] = useState(false);
  const [reportar, setReportar] = useState(false);
  const [filtro, setFiltro] = useState<'todos' | 'recarga' | 'cargo'>('todos');

  const min = servidor?.minUsd ?? 5;
  const max = servidor?.maxUsd ?? 1000;
  const tasa = servidor?.usdCop ?? 0;
  const valor = Number(monto);
  const valido = Number.isFinite(valor) && valor >= min && valor <= max;
  const error = monto !== '' && !valido ? `Entre ${usd(min)} y ${usd(max)}.` : null;
  const pendiente = movs.filter((m) => m.tipo === 'recarga' && m.estado === 'pendiente').reduce((a, m) => a + Number(m.monto), 0);

  // Wompi devuelve al cliente con ?id=<transacción>: se confirma contra Wompi (el servidor la lee de su API).
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id');
    if (!id) return;
    window.history.replaceState(null, '', window.location.pathname);
    void api<{ paid: boolean }>('/casillero/wallet/confirmar', getAccessToken(), { transactionId: id }).then(async (r) => {
      if (r.ok && r.data.paid) toast.success('¡Recarga acreditada!', { description: 'Tu saldo ya está actualizado.' });
      else if (r.ok) toast.message('Tu pago aún se está procesando', { description: 'Se acreditará solo en unos minutos.' });
      else toast.error('No pudimos confirmar el pago', { description: r.message });
      await Promise.all([recargar(), res.recargar()]);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pagar = async () => {
    if (!valido) return;
    setPagando(true);
    const err = await recargarConWompi(getAccessToken(), valor);
    if (err) { setPagando(false); toast.error(err); }
  };

  // Saldo después de cada movimiento aprobado.
  const despues = useMemo(() => {
    let acum = 0;
    const r: Record<string, number> = {};
    for (const m of [...movs].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
      if (m.estado === 'aprobado') { acum += Number(m.monto); r[m.id] = acum; }
    }
    return r;
  }, [movs]);

  const columnas: Columna<MovimientoWallet>[] = [
    { clave: 'concepto', titulo: 'Movimiento', movil: 'titulo', celda: (m) => <Concepto m={m} /> },
    { clave: 'fecha', titulo: 'Fecha', orden: (m) => m.created_at, celda: (m) => <span className="text-muted-foreground">{fechaHora(m.created_at)}</span> },
    { clave: 'monto', titulo: 'Monto', alinear: 'der', orden: (m) => Number(m.monto), celda: (m) => <b className={Number(m.monto) < 0 ? 'text-primary' : 'text-green-600'}>{Number(m.monto) > 0 ? '+' : ''}{usd(m.monto)}</b> },
    { clave: 'estado', titulo: 'Estado', celda: (m) => <Etiqueta estado={m.estado} /> },
    { clave: 'saldo', titulo: 'Saldo después', alinear: 'der', celda: (m) => (despues[m.id] !== undefined ? <span className="tabular-nums text-muted-foreground">{usd(despues[m.id])}</span> : <span className="text-gray-300">—</span>) },
  ];

  return (
    <div className="space-y-6">
      <Aparece>
        <div className="grid gap-6 xl:grid-cols-[1fr_1.15fr]">
          {/* Tarjeta */}
          <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary via-[#2b2978] to-[#1B1A45] p-7 text-white app-shadow">
            <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-accent/35 blur-3xl" aria-hidden="true" />
            <div className="relative flex min-h-56 flex-col justify-between">
              <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/65"><WalletIcon size={15} />Wallet Easycomex</span><CreditCard className="text-white/40" /></div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-white/60">Saldo disponible</p>
                <div className="font-heading text-5xl font-black tracking-tight">{cargando ? <Skeleton className="h-12 w-44 bg-white/20" /> : usd(saldo)}</div>
                {tasa > 0 && !cargando && <p className="mt-1 text-sm text-white/65">≈ {cop(saldo * tasa)}</p>}
              </div>
              {pendiente > 0 && <p className="mt-4 inline-flex w-fit items-center gap-1.5 rounded-full bg-white/12 px-3 py-1 text-xs font-bold"><CircleDollarSign size={13} />{usd(pendiente)} esperando verificación</p>}
            </div>
          </div>

          {/* Recargar */}
          <Card>
            <h2 className="font-heading text-xl font-black text-primary">Recargar saldo</h2>
            <p className="mt-1 text-sm text-muted-foreground">Elige un monto. El saldo se acredita en USD apenas se confirma el pago.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {RAPIDOS.map((r) => <button key={r} type="button" onClick={() => setMonto(String(r))} className={`tap-scale-sm cursor-pointer rounded-full border px-5 py-2 text-sm font-bold transition-colors ${Number(monto) === r ? 'border-primary bg-primary text-white' : 'border-gray-200 bg-white text-primary hover:bg-gray-50'}`}>${r}</button>)}
            </div>
            <Campo etiqueta="Otro monto (USD)" id="monto" className="mt-4" error={error} ayuda={valido && tasa > 0 ? `Pagas ${cop(valor * tasa)} a la tasa de hoy (1 USD = ${cop(tasa)}).` : undefined}>
              <Entrada id="monto" type="number" inputMode="decimal" min={min} max={max} step="1" value={monto} onChange={(e) => setMonto(e.target.value)} aria-invalid={!!error} />
            </Campo>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Boton variante="primario" cargando={pagando} disabled={!valido || servidor?.wompi === false} onClick={() => void pagar()} icono={<CreditCard size={16} />}>Pagar con Wompi</Boton>
              <Boton onClick={() => setReportar(true)} icono={<Receipt size={16} />}>Ya pagué por fuera</Boton>
            </div>
            {servidor?.wompi === false && <p className="mt-3 flex items-start gap-2 rounded-2xl bg-orange-50 p-3 text-xs text-orange-900"><Info size={14} className="mt-0.5 shrink-0" />El pago en línea no está disponible ahora. Paga por transferencia, Zelle o efectivo y repórtalo con “Ya pagué por fuera”.</p>}
          </Card>
        </div>
      </Aparece>

      <Aparece retraso={0.08}>
        <Seccion titulo="Tu saldo, últimos 30 días">
          {!res.datos ? <Skeleton className="h-56 w-full" /> : <AreaTendencia datos={res.datos.saldo_serie} x="dia" xFormato={diaCorto} formato={usdCorto} series={[{ clave: 'saldo', etiqueta: 'Saldo', color: PALETA.naranja }]} alto={210} resumen={`Saldo de los últimos 30 días; hoy ${usd(res.datos.saldo)}.`} />}
        </Seccion>
      </Aparece>

      <Aparece retraso={0.12}>
        <DataTable
          columnas={columnas} filas={filtro === 'todos' ? movs : movs.filter((m) => m.tipo === filtro || (filtro === 'recarga' && m.tipo === 'ajuste' && Number(m.monto) > 0))} id={(m) => m.id} cargando={cargando}
          buscar={(m) => `${m.tipo} ${m.metodo ?? ''} ${m.referencia ?? ''} ${m.estado}`} textoBuscar="Buscar movimientos"
          filtros={<Segmentos valor={filtro} onCambio={setFiltro} opciones={[{ valor: 'todos', etiqueta: 'Todos' }, { valor: 'recarga', etiqueta: 'Recargas' }, { valor: 'cargo', etiqueta: 'Cobros' }]} />}
          exportar={{ nombre: 'wallet', fila: (m) => ({ fecha: m.created_at, tipo: m.tipo, metodo: m.metodo, referencia: m.referencia, monto_usd: m.monto, estado: m.estado }) }}
          ordenInicial={{ clave: 'fecha', asc: false }}
        />
      </Aparece>

      <Reportar abierto={reportar} onCerrar={() => setReportar(false)} min={min} onListo={async () => { setReportar(false); await Promise.all([recargar(), res.recargar()]); }} />
    </div>
  );
}

function Reportar({ abierto, onCerrar, onListo, min }: { abierto: boolean; onCerrar: () => void; onListo: () => Promise<void>; min: number }) {
  const { getAccessToken } = useAuth();
  const [f, setF] = useState({ monto: '', metodo: 'Transferencia', referencia: '' });
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enviar = async () => {
    const m = Number(f.monto);
    if (!Number.isFinite(m) || m < min) return setError(`El monto mínimo es ${usd(min)}.`);
    if (!f.referencia.trim()) return setError('Escribe la referencia o el número del comprobante: así el equipo lo encuentra rápido.');
    setError(null); setOcupado(true);
    const r = await api('/casillero/wallet/reportar', getAccessToken(), { montoUsd: m, metodo: f.metodo, referencia: f.referencia.trim() });
    setOcupado(false);
    if (!r.ok) return setError(r.message ?? 'No pudimos registrar tu pago. Intenta de nuevo.');
    toast.success('Pago reportado', { description: 'El equipo lo verifica y acredita tu saldo.' });
    setF({ monto: '', metodo: 'Transferencia', referencia: '' });
    await onListo();
  };

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="Reportar un pago hecho por fuera" descripcion="Para transferencias, Zelle o efectivo. Se acredita cuando el equipo lo verifique." ancho="max-w-lg">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Monto (USD)" id="r-monto"><Entrada id="r-monto" type="number" inputMode="decimal" min={min} step="0.01" value={f.monto} onChange={(e) => setF({ ...f, monto: e.target.value })} /></Campo>
          <Campo etiqueta="Método" id="r-metodo"><Seleccion id="r-metodo" value={f.metodo} onChange={(e) => setF({ ...f, metodo: e.target.value })}>{['Transferencia', 'Zelle', 'Efectivo', 'Otro'].map((x) => <option key={x}>{x}</option>)}</Seleccion></Campo>
        </div>
        <Campo etiqueta="Referencia o comprobante" id="r-ref"><Entrada id="r-ref" value={f.referencia} onChange={(e) => setF({ ...f, referencia: e.target.value })} placeholder="Número de transacción" /></Campo>
        {error && <p role="alert" className="rounded-2xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2 pt-1"><Boton onClick={onCerrar}>Cancelar</Boton><Boton variante="primario" cargando={ocupado} onClick={() => void enviar()}>Reportar pago</Boton></div>
      </div>
    </Modal>
  );
}
