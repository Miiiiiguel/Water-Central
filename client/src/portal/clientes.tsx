import { useEffect, useId, useState } from 'react';
import { toast } from 'sonner';
import { Wallet } from 'lucide-react';
import { AreaTexto, Boton, Campo, Entrada, Modal, useAsync } from './ui';
import { usd } from './format';
import { db } from '@/lib/casillero';
import { leerTodo } from './admin';

// Clientes del casillero para los formularios del administrador: se cargan
// una vez por pantalla y se eligen escribiendo el código (DM1001) o el nombre.

export interface ClienteLite { id: string; full_name: string | null; casillero_codigo: string | null; email: string | null; role: string }
export const etiquetaCliente = (c: Pick<ClienteLite, 'casillero_codigo' | 'full_name' | 'email'>) => `${c.casillero_codigo ?? '—'} · ${c.full_name || c.email || 'Sin nombre'}`;

export function useClientes() {
  return useAsync(async () => {
    const s = await db();
    const [clientes, v] = await Promise.all([
      leerTodo<ClienteLite>((a, b) => s.from('profiles').select('id, full_name, casillero_codigo, email, role').not('casillero_codigo', 'is', null).order('casillero_codigo').range(a, b)),
      leerTodo<{ user_id: string; saldo: number }>((a, b) => s.from('casillero_saldos').select('user_id, saldo').order('user_id').range(a, b)),
    ]);
    const saldos: Record<string, number> = {};
    for (const x of v) saldos[x.user_id] = Number(x.saldo);
    return { clientes, saldos };
  }, []);
}

/** Busca por la etiqueta exacta, el código o el correo. */
export function buscarCliente(clientes: ClienteLite[], texto: string): ClienteLite | null {
  const t = texto.trim().toLowerCase();
  if (!t) return null;
  return clientes.find((c) => etiquetaCliente(c).toLowerCase() === t || c.casillero_codigo?.toLowerCase() === t || c.email?.toLowerCase() === t) ?? null;
}

export function SelectorCliente({ clientes, valor, onCambio, etiqueta = 'Cliente', saldos, autoFocus }: {
  clientes: ClienteLite[]; valor: string | null; onCambio: (id: string | null) => void; etiqueta?: string; saldos?: Record<string, number>; autoFocus?: boolean;
}) {
  const id = useId();
  const [texto, setTexto] = useState('');
  const elegido = clientes.find((c) => c.id === valor) ?? null;
  useEffect(() => {
    if (!valor) setTexto('');
    else if (elegido && buscarCliente(clientes, texto)?.id !== elegido.id) setTexto(etiquetaCliente(elegido));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor, clientes]);
  const noHalla = texto.trim().length > 1 && !elegido;
  return (
    <Campo etiqueta={etiqueta} id={id} error={noHalla ? 'No encontramos ese cliente. Escribe su código (DM1001) o elige de la lista.' : null}
      ayuda={elegido ? <span className="font-semibold text-green-700">{etiquetaCliente(elegido)}{saldos ? ` · saldo ${usd(saldos[elegido.id] ?? 0)}` : ''}</span> : 'Escribe el código, el nombre o el correo.'}>
      <Entrada id={id} list={`${id}-l`} autoComplete="off" autoFocus={autoFocus} placeholder="DM1001" value={texto}
        onChange={(e) => { setTexto(e.target.value); onCambio(buscarCliente(clientes, e.target.value)?.id ?? null); }} aria-invalid={noHalla} />
      <datalist id={`${id}-l`}>{clientes.slice(0, 1500).map((c) => <option key={c.id} value={etiquetaCliente(c)} />)}</datalist>
    </Campo>
  );
}

export function AjustarSaldo({ abierto, onCerrar, onListo, clienteInicial = null }: { abierto: boolean; onCerrar: () => void; onListo: () => Promise<void>; clienteInicial?: string | null }) {
  const c = useClientes();
  const [cliente, setCliente] = useState<string | null>(clienteInicial);
  useEffect(() => { if (abierto) setCliente(clienteInicial); }, [abierto, clienteInicial]);
  const [monto, setMonto] = useState('');
  const [motivo, setMotivo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const saldo = cliente ? c.datos?.saldos[cliente] ?? 0 : null;
  const n = Number(monto);
  const valido = Number.isFinite(n) && n !== 0;
  const resultante = saldo !== null && valido ? saldo + n : null;

  const enviar = async () => {
    if (!cliente) return toast.error('Elige el cliente');
    if (!valido) return toast.error('Escribe un monto distinto de cero (negativo para descontar)');
    if (!motivo.trim()) return toast.error('El motivo es obligatorio: queda en la auditoría y lo ve el cliente');
    setOcupado(true);
    const { data, error } = await (await db()).rpc('casillero_ajustar_saldo', { p_user: cliente, p_monto: n, p_motivo: motivo.trim() });
    setOcupado(false);
    if (error) return toast.error(error.message);
    toast.success('Saldo ajustado', { description: `Nuevo saldo: ${usd(Number(data))}` });
    setMonto(''); setMotivo(''); onCerrar();
    await Promise.all([onListo(), c.recargar()]);
  };

  return (
    <Modal abierto={abierto} onCerrar={onCerrar} titulo="Ajustar saldo" descripcion="Suma o descuenta saldo a un cliente. Siempre con motivo; queda en la auditoría y el cliente recibe un aviso." ancho="max-w-lg">
      <div className="space-y-4">
        <SelectorCliente clientes={c.datos?.clientes ?? []} saldos={c.datos?.saldos} valor={cliente} onCambio={setCliente} autoFocus />
        <Campo etiqueta="Monto en USD" id="aj-monto" ayuda="Positivo suma (bono, corrección a favor). Negativo descuenta."><Entrada id="aj-monto" type="number" step="0.01" inputMode="decimal" placeholder="10.00 o -5.00" value={monto} onChange={(e) => setMonto(e.target.value)} /></Campo>
        <Campo etiqueta="Motivo" id="aj-motivo"><AreaTexto id="aj-motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={200} placeholder="Ej. Bono de bienvenida · Corrección de cobro duplicado" /></Campo>
        {resultante !== null && (
          <p className={`flex items-center gap-2 rounded-2xl p-3 text-sm ${resultante < 0 ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-muted-foreground'}`}><Wallet size={16} className="shrink-0" /><span>Saldo: {usd(saldo)} → <b className="text-primary">{usd(resultante)}</b>{resultante < 0 && ' · no puede quedar negativo'}</span></p>
        )}
        <div className="flex justify-end gap-2"><Boton onClick={onCerrar}>Cancelar</Boton><Boton variante="primario" cargando={ocupado} disabled={resultante !== null && resultante < 0} onClick={() => void enviar()}>Aplicar ajuste</Boton></div>
      </div>
    </Modal>
  );
}
