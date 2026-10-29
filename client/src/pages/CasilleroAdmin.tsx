import { Fragment, ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { useRoute } from 'wouter';
import { toast } from 'sonner';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download, Lock, ShieldOff, Trash2, Unlock } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import AdminShell, { SECCIONES_ADMIN, type SeccionAdmin } from '@/components/AdminShell';
import { CLASE_CAMPO, Cifra, Entrada, Etiqueta, Panel } from '@/components/CasilleroShell';
import { downloadCSV } from '@/lib/csv';
import {
  ESTADOS_PAQUETE, MODALIDADES, api, db, fecha, usd,
  type Despacho, type MovimientoWallet, type Paquete, type Tarifa,
} from '@/lib/casillero';
import type { Profile } from '@/lib/supabase';

// Portal del administrador del casillero: control total. Todo lo que se
// hace aquí pasa por RLS y por funciones que verifican que quien llama es
// del equipo (supabase/casillero.sql), y queda en la auditoría.

const selectChico = 'rounded-xl border border-gray-200 bg-white px-2 py-1.5 text-sm';
const quien = (p?: { full_name: string | null; casillero_codigo: string | null } | null) => `${p?.casillero_codigo ?? ''} · ${p?.full_name ?? ''}`;
const L = ({ children }: { children: ReactNode }) => <Label className="mb-1.5 block">{children}</Label>;
const Th = ({ children }: { children?: ReactNode }) => <th className="p-2 font-semibold">{children}</th>;
const Vacio = ({ cols, texto = 'Sin resultados.' }: { cols: number; texto?: string }) => <tr><td colSpan={cols} className="p-4 text-muted-foreground">{texto}</td></tr>;
const Boton = ({ children, ...p }: React.ComponentProps<typeof Button>) => <Button size="sm" className="rounded-full font-bold" {...p}>{children}</Button>;
const BotonAcento = ({ children, ...p }: React.ComponentProps<typeof Button>) => <Button className="rounded-full bg-accent hover:bg-accent/90 text-white font-bold" {...p}>{children}</Button>;

function usarTabla<T>(tabla: string, select: string, orden = 'created_at', asc = false, limite = 500) {
  const [filas, setFilas] = useState<T[]>([]);
  const recargar = useCallback(async () => {
    const { data, error } = await (await db()).from(tabla).select(select).order(orden, { ascending: asc }).limit(limite);
    if (error) toast.error(error.message);
    setFilas((data ?? []) as T[]);
  }, [tabla, select, orden, asc, limite]);
  useEffect(() => { void recargar(); }, [recargar]);
  return { filas, recargar };
}

export default function CasilleroAdmin() {
  const [, params] = useRoute('/admin/casillero/:seccion');
  const id = (SECCIONES_ADMIN.find((s) => s.id === params?.seccion)?.id ?? 'resumen') as SeccionAdmin;
  const titulo = SECCIONES_ADMIN.find((s) => s.id === id)!.etiqueta;
  return (
    <AdminShell actual={id} titulo={titulo}>
      {id === 'resumen' && <Resumen />}
      {id === 'paquetes' && <PaquetesAdmin />}
      {id === 'despachos' && <DespachosAdmin />}
      {id === 'wallet' && <WalletAdmin />}
      {id === 'clientes' && <ClientesAdmin />}
      {id === 'tarifas' && <TarifasAdmin />}
      {id === 'anuncios' && <Anuncios />}
      {id === 'config' && <Configuracion />}
      {id === 'equipo' && <Equipo />}
      {id === 'auditoria' && <Auditoria />}
    </AdminShell>
  );
}

/* ------------------------------ Resumen ------------------------------ */
interface Stats {
  clientes: number; clientes_nuevos_30d: number; bloqueados: number;
  paquetes: Record<string, number>; despachos: Record<string, number>;
  recargas_pendientes: number; recargas_pendientes_usd: number; saldo_total_wallets: number;
  ingresos_30d: number; recargado_30d: number; serie_30d: { dia: string; ingresos: number; paquetes: number }[];
}

function Resumen() {
  const [s, setS] = useState<Stats | null>(null);
  useEffect(() => {
    void (async () => {
      const { data, error } = await (await db()).rpc('casillero_stats');
      if (error) toast.error(error.message); else setS(data as Stats);
    })();
  }, []);
  if (!s) return <p className="text-muted-foreground">Cargando…</p>;
  const p = (e: string) => s.paquetes[e] ?? 0;
  const d = (e: string) => s.despachos[e] ?? 0;
  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Cifra acento etiqueta="Ingresos 30 días" valor={usd(s.ingresos_30d)} />
        <Cifra etiqueta="Recargado 30 días" valor={usd(s.recargado_30d)} />
        <Cifra etiqueta="Saldo en wallets" valor={usd(s.saldo_total_wallets)} />
        <Cifra etiqueta={`Recargas por verificar (${usd(s.recargas_pendientes_usd)})`} valor={String(s.recargas_pendientes)} />
        <Cifra etiqueta="Clientes" valor={String(s.clientes)} />
        <Cifra etiqueta="Clientes nuevos 30 días" valor={String(s.clientes_nuevos_30d)} />
        <Cifra etiqueta="Paquetes en bodega" valor={String(p('recibido'))} />
        <Cifra etiqueta="Por alistar / despachar" valor={String(p('alistamiento') + d('solicitado'))} />
      </div>
      <Panel className="mt-5">
        <b>Ingresos por día (últimos 30)</b>
        <div className="mt-3 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={s.serie_30d.map((x) => ({ ...x, dia: x.dia.slice(5) }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="dia" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => usd(v)} />
              <Area type="monotone" dataKey="ingresos" name="Ingresos" stroke="#FF5A36" fill="#FFF1EA" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>
      <div className="grid gap-5 md:grid-cols-2">
        <Panel>
          <b>Paquetes por estado</b>
          <ul className="mt-3 space-y-2 text-sm">{ESTADOS_PAQUETE.map((e) => <li key={e} className="flex justify-between"><Etiqueta valor={e} /><b>{p(e)}</b></li>)}</ul>
        </Panel>
        <Panel>
          <b>Despachos por estado</b>
          <ul className="mt-3 space-y-2 text-sm">{['solicitado', 'despachado', 'entregado', 'cancelado'].map((e) => <li key={e} className="flex justify-between"><Etiqueta valor={e} /><b>{d(e)}</b></li>)}</ul>
          {s.bloqueados > 0 && <p className="mt-4 text-sm text-muted-foreground">Clientes bloqueados: <b>{s.bloqueados}</b></p>}
        </Panel>
      </div>
    </>
  );
}

/* ------------------------------ Paquetes ------------------------------ */
function PaquetesAdmin() {
  const { getAccessToken } = useAuth();
  const { filas, recargar } = usarTabla<Paquete>('casillero_paquetes', '*, profiles(full_name, casillero_codigo)');
  const [q, setQ] = useState('');
  const [estado, setEstado] = useState('');
  const [sel, setSel] = useState<string[]>([]);
  const [lote, setLote] = useState('recibido');
  const [edit, setEdit] = useState<Record<string, { peso: string; estado: string }>>({});

  const visibles = filas.filter((p) => (!estado || p.estado === estado) && `${p.guia} ${p.descripcion ?? ''} ${quien(p.profiles)}`.toLowerCase().includes(q.toLowerCase()));

  const avisar = async (id: string) => {
    const r = await api<{ enviado: boolean }>(`/casillero/paquetes/${id}/avisar`, getAccessToken());
    return r.ok && r.data.enviado;
  };
  const guardar = async (p: Paquete) => {
    const e = edit[p.id] ?? { peso: String(p.peso_lb ?? ''), estado: p.estado };
    const { error } = await (await db()).from('casillero_paquetes').update({ peso_lb: e.peso === '' ? null : Number(e.peso), estado: e.estado }).eq('id', p.id);
    if (error) return toast.error(error.message);
    const mail = e.estado !== p.estado && (await avisar(p.id));
    toast.success(mail ? 'Guardado y cliente avisado por correo' : 'Guardado');
    await recargar();
  };
  const aplicarLote = async () => {
    if (!sel.length) return toast.error('Selecciona paquetes');
    const { error } = await (await db()).from('casillero_paquetes').update({ estado: lote }).in('id', sel);
    if (error) return toast.error(error.message);
    await Promise.all(sel.map((id) => avisar(id)));
    toast.success(`${sel.length} paquetes pasaron a ${lote}`);
    setSel([]);
    await recargar();
  };
  const borrar = async (p: Paquete) => {
    if (!confirm(`¿Eliminar el paquete ${p.guia}? No se puede deshacer.`)) return;
    const { error } = await (await db()).from('casillero_paquetes').delete().eq('id', p.id);
    if (error) toast.error(error.message); else await recargar();
  };

  return (
    <>
      <RecibirPaquete onListo={recargar} avisar={avisar} />
      <Panel>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1"><L>Buscar guía, contenido o cliente</L><Entrada value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div><L>Estado</L><select className={CLASE_CAMPO} value={estado} onChange={(e) => setEstado(e.target.value)}><option value="">Todos</option>{ESTADOS_PAQUETE.map((s) => <option key={s}>{s}</option>)}</select></div>
          <Boton variant="outline" onClick={() => downloadCSV('paquetes.csv', visibles.map((p) => ({ guia: p.guia, cliente: quien(p.profiles), contenido: p.descripcion, peso_lb: p.peso_lb, estado: p.estado, creado: p.created_at })))}><Download size={14} className="mr-1" />CSV</Boton>
        </div>
        {sel.length > 0 && (
          <div className="mb-3 flex items-center gap-3 rounded-2xl bg-secondary p-3 text-sm">
            <b>{sel.length} seleccionados</b> pasar a
            <select className={selectChico} value={lote} onChange={(e) => setLote(e.target.value)}>{ESTADOS_PAQUETE.map((s) => <option key={s}>{s}</option>)}</select>
            <Boton onClick={() => void aplicarLote()}>Aplicar</Boton>
          </div>
        )}
        <table className="w-full text-sm">
          <thead><tr className="text-left text-muted-foreground"><Th><input type="checkbox" checked={visibles.length > 0 && sel.length === visibles.length} onChange={(e) => setSel(e.target.checked ? visibles.map((p) => p.id) : [])} /></Th><Th>Guía</Th><Th>Cliente</Th><Th>Contenido</Th><Th>Peso lb</Th><Th>Estado</Th><Th /></tr></thead>
          <tbody>
            {visibles.map((p) => {
              const e = edit[p.id] ?? { peso: String(p.peso_lb ?? ''), estado: p.estado };
              return (
                <tr key={p.id} className="border-t">
                  <td className="p-2"><input type="checkbox" checked={sel.includes(p.id)} onChange={(ev) => setSel(ev.target.checked ? [...sel, p.id] : sel.filter((x) => x !== p.id))} /></td>
                  <td className="p-2">{p.guia}</td><td>{quien(p.profiles)}</td><td>{p.descripcion}</td>
                  <td><Entrada className="!w-24 !py-1.5" type="number" step="0.01" min="0" value={e.peso} onChange={(ev) => setEdit({ ...edit, [p.id]: { ...e, peso: ev.target.value } })} /></td>
                  <td><select className={selectChico} value={e.estado} onChange={(ev) => setEdit({ ...edit, [p.id]: { ...e, estado: ev.target.value } })}>{ESTADOS_PAQUETE.map((s) => <option key={s}>{s}</option>)}</select></td>
                  <td className="whitespace-nowrap"><Boton onClick={() => void guardar(p)}>Guardar</Boton> <button className="ml-1 bg-transparent border-0 cursor-pointer text-red-600" title="Eliminar" onClick={() => void borrar(p)}><Trash2 size={16} /></button></td>
                </tr>
              );
            })}
            {!visibles.length && <Vacio cols={7} />}
          </tbody>
        </table>
      </Panel>
    </>
  );
}

// Llega un paquete a la bodega: se registra por el código de casillero del
// cliente y queda directamente como recibido (con o sin prealerta previa).
function RecibirPaquete({ onListo, avisar }: { onListo: () => Promise<void>; avisar: (id: string) => Promise<boolean> }) {
  const [f, setF] = useState({ codigo: '', guia: '', peso: '', descripcion: '' });
  const registrar = async () => {
    if (!f.codigo.trim() || !f.guia.trim()) return toast.error('Código de cliente y guía son obligatorios');
    const s = await db();
    const { data: u } = await s.from('profiles').select('id').eq('casillero_codigo', f.codigo.trim().toUpperCase()).maybeSingle();
    if (!u) return toast.error('No existe un cliente con ese código');
    const { data, error } = await s.from('casillero_paquetes')
      .insert({ user_id: u.id, guia: f.guia.trim(), peso_lb: f.peso === '' ? null : Number(f.peso), descripcion: f.descripcion.trim(), estado: 'recibido' })
      .select('id').single();
    if (error) return toast.error(error.message);
    toast.success((await avisar(data.id)) ? 'Paquete registrado y cliente avisado por correo' : 'Paquete registrado');
    setF({ codigo: '', guia: '', peso: '', descripcion: '' });
    await onListo();
  };
  return (
    <Panel>
      <b>Recibir un paquete en la bodega</b>
      <div className="mt-3 grid gap-3 sm:grid-cols-5">
        <div><L>Código cliente</L><Entrada placeholder="DM1001" value={f.codigo} onChange={(e) => setF({ ...f, codigo: e.target.value })} /></div>
        <div><L>Guía</L><Entrada value={f.guia} onChange={(e) => setF({ ...f, guia: e.target.value })} /></div>
        <div><L>Peso (lb)</L><Entrada type="number" step="0.01" min="0" value={f.peso} onChange={(e) => setF({ ...f, peso: e.target.value })} /></div>
        <div><L>Contenido</L><Entrada value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} /></div>
        <div className="flex items-end"><BotonAcento onClick={() => void registrar()}>Registrar</BotonAcento></div>
      </div>
    </Panel>
  );
}

/* ------------------------------ Despachos ------------------------------ */
function DespachosAdmin() {
  const { filas, recargar } = usarTabla<Despacho>('casillero_despachos', '*, profiles(full_name, casillero_codigo)');
  const [estado, setEstado] = useState('');
  const [edit, setEdit] = useState<Record<string, { guia: string; estado: string }>>({});
  const visibles = filas.filter((d) => !estado || d.estado === estado);

  const guardar = async (d: Despacho) => {
    const e = edit[d.id] ?? { guia: d.guia_despacho ?? '', estado: d.estado };
    const s = await db();
    const { error } = await s.from('casillero_despachos').update({ guia_despacho: e.guia.trim(), estado: e.estado }).eq('id', d.id);
    if (error) return toast.error(error.message);
    // Al despachar o entregar, los paquetes del despacho siguen el mismo estado.
    if (e.estado === 'despachado' || e.estado === 'entregado') await s.from('casillero_paquetes').update({ estado: e.estado }).eq('despacho_id', d.id);
    // Cancelar devuelve el dinero al wallet y los paquetes a la bodega.
    if (e.estado === 'cancelado' && d.estado !== 'cancelado') {
      await s.from('casillero_paquetes').update({ estado: 'recibido', despacho_id: null }).eq('despacho_id', d.id);
      await s.from('casillero_wallet').insert({ user_id: d.user_id, tipo: 'ajuste', monto: d.costo, estado: 'aprobado', referencia: `Reembolso despacho ${d.id.slice(0, 8)}` });
      toast.message(`Despacho cancelado: se devolvieron ${usd(d.costo)} al wallet`);
    } else toast.success('Guardado');
    await recargar();
  };

  return (
    <Panel>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div><L>Estado</L><select className={CLASE_CAMPO} value={estado} onChange={(e) => setEstado(e.target.value)}><option value="">Todos</option>{['solicitado', 'despachado', 'entregado', 'cancelado'].map((s) => <option key={s}>{s}</option>)}</select></div>
        <Boton variant="outline" onClick={() => downloadCSV('despachos.csv', visibles.map((d) => ({ fecha: d.created_at, cliente: quien(d.profiles), modalidad: MODALIDADES[d.modalidad], destino: d.destino, peso_lb: d.peso_total, costo_usd: d.costo, guia_despacho: d.guia_despacho, estado: d.estado })))}><Download size={14} className="mr-1" />CSV</Boton>
      </div>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-muted-foreground"><Th>Fecha</Th><Th>Cliente</Th><Th>Modalidad</Th><Th>Destino</Th><Th>Peso</Th><Th>Costo</Th><Th>Guía despacho</Th><Th>Estado</Th><Th /></tr></thead>
        <tbody>
          {visibles.map((d) => {
            const e = edit[d.id] ?? { guia: d.guia_despacho ?? '', estado: d.estado };
            return (
              <tr key={d.id} className="border-t">
                <td className="p-2">{fecha(d.created_at)}</td><td>{quien(d.profiles)}</td><td>{MODALIDADES[d.modalidad]}</td><td>{d.destino}</td><td>{d.peso_total}</td><td>{usd(d.costo)}</td>
                <td><Entrada className="!w-40 !py-1.5" value={e.guia} onChange={(ev) => setEdit({ ...edit, [d.id]: { ...e, guia: ev.target.value } })} /></td>
                <td><select className={selectChico} value={e.estado} onChange={(ev) => setEdit({ ...edit, [d.id]: { ...e, estado: ev.target.value } })}>{['solicitado', 'despachado', 'entregado', 'cancelado'].map((s) => <option key={s}>{s}</option>)}</select></td>
                <td><Boton onClick={() => void guardar(d)}>Guardar</Boton></td>
              </tr>
            );
          })}
          {!visibles.length && <Vacio cols={9} />}
        </tbody>
      </table>
    </Panel>
  );
}

/* ------------------------------ Wallet ------------------------------ */
async function ajustarSaldo(codigo: string, monto: number, motivo: string): Promise<boolean> {
  const s = await db();
  const { data: u } = await s.from('profiles').select('id').eq('casillero_codigo', codigo.trim().toUpperCase()).maybeSingle();
  if (!u) { toast.error('Cliente no encontrado'); return false; }
  const { error } = await s.from('casillero_wallet').insert({ user_id: u.id, tipo: 'ajuste', monto, estado: 'aprobado', referencia: motivo.trim() || 'Ajuste del equipo' });
  if (error) { toast.error(error.message); return false; }
  return true;
}

function WalletAdmin() {
  const { filas, recargar } = usarTabla<MovimientoWallet>('casillero_wallet', '*, profiles(full_name, casillero_codigo)');
  const [aj, setAj] = useState({ codigo: '', monto: '', motivo: '' });
  const [estado, setEstado] = useState('');
  const [tipo, setTipo] = useState('');
  const visibles = filas.filter((m) => (!estado || m.estado === estado) && (!tipo || m.tipo === tipo));

  const resolver = async (id: string, nuevo: 'aprobado' | 'rechazado') => {
    // Solo pasa de pendiente: una recarga de Wompi ya aprobada no se toca.
    const { error } = await (await db()).from('casillero_wallet').update({ estado: nuevo }).eq('id', id).eq('estado', 'pendiente');
    if (error) toast.error(error.message); else await recargar();
  };
  return (
    <>
      <Panel>
        <b>Ajuste manual de saldo</b>
        <div className="mt-3 grid gap-3 sm:grid-cols-4">
          <div><L>Código cliente</L><Entrada placeholder="DM1001" value={aj.codigo} onChange={(e) => setAj({ ...aj, codigo: e.target.value })} /></div>
          <div><L>Monto USD (+/−)</L><Entrada type="number" step="0.01" value={aj.monto} onChange={(e) => setAj({ ...aj, monto: e.target.value })} /></div>
          <div><L>Motivo</L><Entrada value={aj.motivo} onChange={(e) => setAj({ ...aj, motivo: e.target.value })} /></div>
          <div className="flex items-end"><BotonAcento onClick={() => void (async () => {
            const m = Number(aj.monto);
            if (!aj.codigo.trim() || !m) return toast.error('Código y monto requeridos');
            if (await ajustarSaldo(aj.codigo, m, aj.motivo)) { setAj({ codigo: '', monto: '', motivo: '' }); await recargar(); toast.success('Ajuste aplicado'); }
          })()}>Aplicar</BotonAcento></div>
        </div>
      </Panel>
      <Panel>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div><L>Estado</L><select className={CLASE_CAMPO} value={estado} onChange={(e) => setEstado(e.target.value)}><option value="">Todos</option>{['pendiente', 'aprobado', 'rechazado'].map((s) => <option key={s}>{s}</option>)}</select></div>
          <div><L>Tipo</L><select className={CLASE_CAMPO} value={tipo} onChange={(e) => setTipo(e.target.value)}><option value="">Todos</option>{['recarga', 'cargo', 'ajuste'].map((s) => <option key={s}>{s}</option>)}</select></div>
          <Boton variant="outline" onClick={() => downloadCSV('wallet.csv', visibles.map((m) => ({ fecha: m.created_at, cliente: quien(m.profiles), tipo: m.tipo, metodo: m.metodo, referencia: m.referencia, monto_usd: m.monto, estado: m.estado })))}><Download size={14} className="mr-1" />CSV</Boton>
        </div>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-muted-foreground"><Th>Fecha</Th><Th>Cliente</Th><Th>Tipo</Th><Th>Método / ref</Th><Th>Monto</Th><Th>Estado</Th><Th /></tr></thead>
          <tbody>
            {visibles.map((m) => (
              <tr key={m.id} className="border-t">
                <td className="p-2">{fecha(m.created_at)}</td><td>{quien(m.profiles)}</td><td>{m.tipo}</td>
                <td>{[m.metodo, m.referencia].filter(Boolean).join(' · ')}</td><td>{usd(m.monto)}</td><td><Etiqueta valor={m.estado} /></td>
                <td>{m.estado === 'pendiente' && m.metodo !== 'wompi' && (
                  <span className="flex gap-1"><Boton onClick={() => void resolver(m.id, 'aprobado')}>Aprobar</Boton><Boton variant="outline" onClick={() => void resolver(m.id, 'rechazado')}>Rechazar</Boton></span>
                )}</td>
              </tr>
            ))}
            {!visibles.length && <Vacio cols={7} />}
          </tbody>
        </table>
        <p className="mt-3 text-xs text-muted-foreground">Las recargas con Wompi se acreditan solas al confirmarse el pago; aquí solo se aprueban las reportadas a mano.</p>
      </Panel>
    </>
  );
}

/* ------------------------------ Clientes ------------------------------ */
type Cliente = Profile & { casillero_bloqueado?: boolean };
const CAMPOS_CLIENTE = [
  ['full_name', 'Nombre'], ['telefono', 'Teléfono'], ['tipo_doc', 'Tipo doc.'], ['num_doc', 'Número doc.'], ['direccion', 'Dirección'],
  ['pais', 'País'], ['departamento', 'Departamento'], ['ciudad', 'Ciudad'], ['codigo_postal', 'Código postal'], ['company', 'Empresa'],
] as const;

function ClientesAdmin() {
  const { filas, recargar } = usarTabla<Cliente>('profiles', '*', 'created_at', false, 1000);
  const saldos = usarTabla<{ user_id: string; saldo: number }>('casillero_saldos', '*', 'user_id', true, 2000);
  const mapa = useMemo(() => Object.fromEntries(saldos.filas.map((s) => [s.user_id, Number(s.saldo)])), [saldos.filas]);
  const [q, setQ] = useState('');
  const [abierto, setAbierto] = useState<Cliente | null>(null);
  const visibles = filas.filter((c) => `${c.casillero_codigo} ${c.full_name} ${c.email} ${c.telefono} ${c.num_doc}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <Panel>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="min-w-64 flex-1"><L>Buscar por código, nombre, correo, teléfono o documento</L><Entrada value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <Boton variant="outline" onClick={() => downloadCSV('clientes.csv', visibles.map((c) => ({ codigo: c.casillero_codigo, nombre: c.full_name, correo: c.email, telefono: c.telefono, documento: `${c.tipo_doc ?? ''} ${c.num_doc ?? ''}`, ciudad: c.ciudad, rol: c.role, saldo_usd: mapa[c.id] ?? 0, alta: c.created_at })))}><Download size={14} className="mr-1" />CSV</Boton>
        </div>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-muted-foreground"><Th>Código</Th><Th>Nombre</Th><Th>Correo</Th><Th>Teléfono</Th><Th>Ciudad</Th><Th>Saldo</Th><Th>Rol</Th><Th>Alta</Th></tr></thead>
          <tbody>
            {visibles.map((c) => (
              <tr key={c.id} className="cursor-pointer border-t hover:bg-gray-50" onClick={() => setAbierto(c)}>
                <td className="p-2 font-bold">{c.casillero_codigo}</td>
                <td>{c.full_name} {c.casillero_bloqueado && <span className="ml-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700">bloqueado</span>}</td>
                <td>{c.email}</td><td>{c.telefono}</td><td>{c.ciudad}</td><td>{usd(mapa[c.id])}</td><td>{c.role}</td><td>{fecha(c.created_at)}</td>
              </tr>
            ))}
            {!visibles.length && <Vacio cols={8} />}
          </tbody>
        </table>
      </Panel>
      {abierto && <FichaCliente cliente={abierto} saldo={mapa[abierto.id] ?? 0} onCerrar={() => setAbierto(null)} onCambio={async () => { await recargar(); await saldos.recargar(); setAbierto(null); }} />}
    </>
  );
}

function FichaCliente({ cliente, saldo, onCerrar, onCambio }: { cliente: Cliente; saldo: number; onCerrar: () => void; onCambio: () => Promise<void> }) {
  const { user } = useAuth();
  const [v, setV] = useState<Record<string, string>>(() => Object.fromEntries(CAMPOS_CLIENTE.map(([k]) => [k, String((cliente as unknown as Record<string, unknown>)[k] ?? '')])));
  const [aj, setAj] = useState({ monto: '', motivo: '' });
  const [paquetes, setPaquetes] = useState<Paquete[]>([]);
  const [movs, setMovs] = useState<MovimientoWallet[]>([]);
  const esYo = cliente.id === user?.id;

  useEffect(() => {
    void (async () => {
      const s = await db();
      const [p, m] = await Promise.all([
        s.from('casillero_paquetes').select('*').eq('user_id', cliente.id).order('created_at', { ascending: false }).limit(50),
        s.from('casillero_wallet').select('*').eq('user_id', cliente.id).order('created_at', { ascending: false }).limit(50),
      ]);
      setPaquetes((p.data ?? []) as Paquete[]); setMovs((m.data ?? []) as MovimientoWallet[]);
    })();
  }, [cliente.id]);

  const guardar = async () => {
    const { error } = await (await db()).from('profiles').update(v).eq('id', cliente.id);
    if (error) toast.error(error.message); else { toast.success('Datos guardados'); await onCambio(); }
  };
  const rpc = async (fn: string, args: Record<string, unknown>, ok: string) => {
    const { error } = await (await db()).rpc(fn, args);
    if (error) toast.error(error.message); else { toast.success(ok); await onCambio(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onCerrar}>
      <div className="h-full w-full max-w-2xl overflow-y-auto bg-gray-50 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between">
          <div><h2 className="text-2xl font-black text-primary">{cliente.full_name}</h2><p className="text-sm text-muted-foreground">{cliente.casillero_codigo} · {cliente.email}</p></div>
          <button className="bg-transparent border-0 text-2xl cursor-pointer" onClick={onCerrar}>×</button>
        </div>
        <div className="mb-4 grid grid-cols-2 gap-3"><Cifra acento etiqueta="Saldo wallet" valor={usd(saldo)} /><Cifra etiqueta="Paquetes" valor={String(paquetes.length)} /></div>

        <Panel>
          <b>Datos</b>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">{CAMPOS_CLIENTE.map(([k, l]) => <div key={k}><L>{l}</L><Entrada value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></div>)}</div>
          <div className="mt-4"><BotonAcento onClick={() => void guardar()}>Guardar datos</BotonAcento></div>
        </Panel>

        <Panel>
          <b>Acciones</b>
          <div className="mt-3 flex flex-wrap gap-2">
            {cliente.casillero_bloqueado
              ? <Boton disabled={esYo} onClick={() => void rpc('casillero_set_bloqueo', { p_user: cliente.id, p_bloqueado: false }, 'Cliente desbloqueado')}><Unlock size={14} className="mr-1" />Desbloquear</Boton>
              : <Boton variant="outline" disabled={esYo} onClick={() => void rpc('casillero_set_bloqueo', { p_user: cliente.id, p_bloqueado: true }, 'Cliente bloqueado')}><Lock size={14} className="mr-1" />Bloquear (no puede prealertar ni despachar)</Boton>}
            {cliente.role === 'cliente'
              ? <Boton variant="outline" onClick={() => confirm(`¿Dar acceso de administrador a ${cliente.full_name}?`) && void rpc('casillero_set_rol', { p_user: cliente.id, p_rol: 'vendedor' }, 'Ahora es del equipo')}>Hacer administrador</Boton>
              : <Boton variant="outline" disabled={esYo} onClick={() => confirm(`¿Quitar el acceso de administrador a ${cliente.full_name}?`) && void rpc('casillero_set_rol', { p_user: cliente.id, p_rol: 'cliente' }, 'Ahora es cliente')}><ShieldOff size={14} className="mr-1" />Quitar administrador</Boton>}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div><L>Ajuste USD (+/−)</L><Entrada type="number" step="0.01" value={aj.monto} onChange={(e) => setAj({ ...aj, monto: e.target.value })} /></div>
            <div><L>Motivo</L><Entrada value={aj.motivo} onChange={(e) => setAj({ ...aj, motivo: e.target.value })} /></div>
            <div className="flex items-end"><Boton onClick={() => void (async () => { const m = Number(aj.monto); if (!m) return toast.error('Monto requerido'); if (await ajustarSaldo(cliente.casillero_codigo ?? '', m, aj.motivo)) { toast.success('Ajuste aplicado'); await onCambio(); } })()}>Aplicar ajuste</Boton></div>
          </div>
        </Panel>

        <Panel>
          <b>Paquetes</b>
          <table className="mt-2 w-full text-sm"><tbody>{paquetes.map((p) => <tr key={p.id} className="border-t"><td className="py-1.5">{p.guia}</td><td>{p.descripcion}</td><td>{p.peso_lb ?? '—'} lb</td><td><Etiqueta valor={p.estado} /></td></tr>)}{!paquetes.length && <Vacio cols={4} texto="Sin paquetes." />}</tbody></table>
        </Panel>
        <Panel>
          <b>Movimientos del wallet</b>
          <table className="mt-2 w-full text-sm"><tbody>{movs.map((m) => <tr key={m.id} className="border-t"><td className="py-1.5">{fecha(m.created_at)}</td><td>{m.tipo}</td><td>{m.referencia ?? m.metodo}</td><td>{usd(m.monto)}</td><td><Etiqueta valor={m.estado} /></td></tr>)}{!movs.length && <Vacio cols={5} texto="Sin movimientos." />}</tbody></table>
        </Panel>
      </div>
    </div>
  );
}

/* ------------------------------ Tarifas ------------------------------ */
type ColTarifa = 'rec_oficina' | 'local' | 'regional' | 'nacional';
const COLS_TARIFA: ColTarifa[] = ['rec_oficina', 'local', 'regional', 'nacional'];

function TarifasAdmin() {
  const { filas, recargar } = usarTabla<Tarifa>('casillero_tarifas', '*', 'libras_desde', true);
  const [edit, setEdit] = useState<Record<number, Record<string, string>>>({});
  const [nueva, setNueva] = useState({ desde: '', hasta: '', rec_oficina: '', local: '', regional: '', nacional: '' });

  const guardar = async (t: Tarifa) => {
    const cambios = Object.fromEntries(Object.entries(edit[t.id] ?? {}).map(([k, x]) => [k, Number(x)]));
    const { error } = await (await db()).from('casillero_tarifas').update(cambios).eq('id', t.id);
    if (error) toast.error(error.message); else { toast.success('Tarifa guardada'); await recargar(); }
  };
  const borrar = async (t: Tarifa) => {
    if (!confirm(`¿Eliminar la fila de ${t.libras_desde} a ${t.libras_hasta} lb?`)) return;
    const { error } = await (await db()).from('casillero_tarifas').delete().eq('id', t.id);
    if (error) toast.error(error.message); else await recargar();
  };
  const agregar = async () => {
    const n = { libras_desde: Number(nueva.desde), libras_hasta: Number(nueva.hasta), rec_oficina: Number(nueva.rec_oficina), local: Number(nueva.local), regional: Number(nueva.regional), nacional: Number(nueva.nacional) };
    if (!n.libras_desde || n.libras_hasta < n.libras_desde) return toast.error('Revisa el rango de libras');
    const { error } = await (await db()).from('casillero_tarifas').insert(n);
    if (error) return toast.error(error.message);
    setNueva({ desde: '', hasta: '', rec_oficina: '', local: '', regional: '', nacional: '' });
    await recargar();
  };
  return (
    <Panel>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-muted-foreground"><Th>Libras</Th><Th>Rec. oficina</Th><Th>Local</Th><Th>Regional</Th><Th>Nacional</Th><Th /></tr></thead>
        <tbody>
          {filas.map((t) => (
            <tr key={t.id} className="border-t">
              <td className="p-2">{t.libras_desde} a {t.libras_hasta}</td>
              {COLS_TARIFA.map((c) => <td key={c}><Entrada className="!w-28 !py-1.5" type="number" step="0.01" value={edit[t.id]?.[c] ?? String(t[c])} onChange={(ev) => setEdit({ ...edit, [t.id]: { ...edit[t.id], [c]: ev.target.value } })} /></td>)}
              <td className="whitespace-nowrap"><Boton onClick={() => void guardar(t)}>Guardar</Boton> <button className="ml-1 bg-transparent border-0 cursor-pointer text-red-600" onClick={() => void borrar(t)}><Trash2 size={16} /></button></td>
            </tr>
          ))}
          <tr className="border-t bg-gray-50">
            <td className="p-2"><span className="flex gap-1"><Entrada className="!w-16 !py-1.5" placeholder="de" value={nueva.desde} onChange={(e) => setNueva({ ...nueva, desde: e.target.value })} /><Entrada className="!w-16 !py-1.5" placeholder="a" value={nueva.hasta} onChange={(e) => setNueva({ ...nueva, hasta: e.target.value })} /></span></td>
            {COLS_TARIFA.map((c) => <td key={c}><Entrada className="!w-28 !py-1.5" type="number" step="0.01" placeholder="USD" value={nueva[c]} onChange={(e) => setNueva({ ...nueva, [c]: e.target.value })} /></td>)}
            <td><Boton onClick={() => void agregar()}>Agregar fila</Boton></td>
          </tr>
        </tbody>
      </table>
      <p className="mt-3 text-sm text-muted-foreground">Para pesos mayores a la última fila, fija el precio por libra extra en Configuración; sin él, el sistema pide contactar a un asesor.</p>
    </Panel>
  );
}

/* ------------------------------ Anuncios ------------------------------ */
function Anuncios() {
  const [f, setF] = useState({ titulo: '', cuerpo: '' });
  const enviar = async () => {
    if (!f.titulo.trim()) return toast.error('Escribe un título');
    if (!confirm('Esto le llega a TODOS los clientes. ¿Enviar?')) return;
    const { data, error } = await (await db()).rpc('casillero_anunciar', { p_titulo: f.titulo.trim(), p_cuerpo: f.cuerpo.trim() });
    if (error) return toast.error(error.message);
    toast.success(`Anuncio enviado a ${data} clientes`);
    setF({ titulo: '', cuerpo: '' });
  };
  return (
    <Panel className="max-w-2xl">
      <p className="mb-4 text-sm text-muted-foreground">Llega a la campanita de cada cliente (y como notificación push si la activó).</p>
      <div className="space-y-3">
        <div><L>Título</L><Entrada value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} placeholder="Feriado: sin despachos el lunes" /></div>
        <div><L>Mensaje</L><textarea className={CLASE_CAMPO} rows={4} value={f.cuerpo} onChange={(e) => setF({ ...f, cuerpo: e.target.value })} /></div>
        <BotonAcento onClick={() => void enviar()}>Enviar a todos los clientes</BotonAcento>
      </div>
    </Panel>
  );
}

/* ------------------------------ Configuración ------------------------------ */
function Configuracion() {
  const { filas, recargar } = usarTabla<{ clave: string; valor: string; descripcion: string | null }>('casillero_config', '*', 'clave', true);
  const [edit, setEdit] = useState<Record<string, string>>({});
  const guardar = async (clave: string) => {
    const { error } = await (await db()).from('casillero_config').update({ valor: edit[clave] ?? '' }).eq('clave', clave);
    if (error) toast.error(error.message); else { toast.success('Guardado'); await recargar(); }
  };
  return (
    <Panel>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-muted-foreground"><Th>Ajuste</Th><Th>Valor</Th><Th /></tr></thead>
        <tbody>
          {filas.map((c) => (
            <tr key={c.clave} className="border-t align-top">
              <td className="p-2"><b>{c.clave}</b><br /><span className="text-muted-foreground">{c.descripcion}</span></td>
              <td className="p-2"><Entrada className="min-w-72" value={edit[c.clave] ?? c.valor} onChange={(e) => setEdit({ ...edit, [c.clave]: e.target.value })} /></td>
              <td className="p-2"><Boton onClick={() => void guardar(c.clave)}>Guardar</Boton></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

/* ------------------------------ Equipo ------------------------------ */
function Equipo() {
  const { user } = useAuth();
  const { filas, recargar } = usarTabla<Profile>('profiles', '*', 'created_at', true, 1000);
  const [correo, setCorreo] = useState('');
  const equipo = filas.filter((p) => p.role === 'vendedor');

  const cambiar = async (id: string, rol: 'cliente' | 'vendedor') => {
    const { error } = await (await db()).rpc('casillero_set_rol', { p_user: id, p_rol: rol });
    if (error) toast.error(error.message); else { toast.success('Listo'); await recargar(); }
  };
  const agregar = async () => {
    const c = filas.find((p) => p.email.toLowerCase() === correo.trim().toLowerCase());
    if (!c) return toast.error('No hay ninguna cuenta con ese correo. La persona debe registrarse primero.');
    if (!confirm(`¿Dar acceso de administrador a ${c.full_name ?? c.email}?`)) return;
    await cambiar(c.id, 'vendedor');
    setCorreo('');
  };
  return (
    <>
      <Panel>
        <b>Agregar a alguien al equipo</b>
        <div className="mt-3 flex flex-wrap items-end gap-3"><div className="min-w-72 flex-1"><L>Correo de su cuenta</L><Entrada type="email" value={correo} onChange={(e) => setCorreo(e.target.value)} /></div><BotonAcento onClick={() => void agregar()}>Dar acceso</BotonAcento></div>
        <p className="mt-2 text-xs text-muted-foreground">Quien entra al equipo ve y controla todo el casillero: clientes, dinero, tarifas y configuración.</p>
      </Panel>
      <Panel>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-muted-foreground"><Th>Nombre</Th><Th>Correo</Th><Th>Desde</Th><Th /></tr></thead>
          <tbody>
            {equipo.map((p) => (
              <tr key={p.id} className="border-t"><td className="p-2">{p.full_name}</td><td>{p.email}</td><td>{fecha(p.created_at)}</td>
                <td>{p.id === user?.id ? <span className="text-muted-foreground">(tú)</span> : <Boton variant="outline" onClick={() => confirm(`¿Quitar el acceso a ${p.email}?`) && void cambiar(p.id, 'cliente')}>Quitar acceso</Boton>}</td></tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  );
}

/* ------------------------------ Auditoría ------------------------------ */
function Auditoria() {
  const { filas } = usarTabla<{ id: number; actor: string | null; tabla: string; accion: string; fila: string | null; detalle: Record<string, unknown> | null; created_at: string }>('casillero_auditoria', '*', 'created_at', false, 300);
  const perfiles = usarTabla<Profile>('profiles', 'id, full_name, email', 'created_at', true, 1000);
  const nombre = (id: string | null) => { const p = perfiles.filas.find((x) => x.id === id); return p?.full_name || p?.email || (id ?? 'sistema').slice(0, 8); };
  const [abierta, setAbierta] = useState<number | null>(null);
  return (
    <Panel>
      <p className="mb-3 text-sm text-muted-foreground">Cada cambio que hace alguien del equipo queda anotado aquí (últimos 300).</p>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-muted-foreground"><Th>Fecha</Th><Th>Quién</Th><Th>Qué</Th><Th>Dónde</Th><Th /></tr></thead>
        <tbody>
          {filas.map((a) => (
            <Fragment key={a.id}>
              <tr className="border-t">
                <td className="p-2">{fecha(a.created_at)}</td><td>{nombre(a.actor)}</td><td>{a.accion}</td><td>{a.tabla.replace('casillero_', '')} {a.fila ? `· ${a.fila.slice(0, 8)}` : ''}</td>
                <td><button className="bg-transparent border-0 cursor-pointer text-accent font-bold" onClick={() => setAbierta(abierta === a.id ? null : a.id)}>{abierta === a.id ? 'Ocultar' : 'Ver'}</button></td>
              </tr>
              {abierta === a.id && <tr><td colSpan={5} className="bg-gray-50 p-3"><pre className="max-h-64 overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(a.detalle, null, 2)}</pre></td></tr>}
            </Fragment>
          ))}
          {!filas.length && <Vacio cols={5} texto="Todavía no hay cambios del equipo." />}
        </tbody>
      </table>
    </Panel>
  );
}
