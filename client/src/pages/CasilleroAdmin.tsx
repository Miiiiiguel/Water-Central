import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import CasilleroShell, { Etiqueta, Panel } from '@/components/CasilleroShell';
import {
  ESTADOS_PAQUETE, MODALIDADES, api, db, fecha, usd,
  type Despacho, type MovimientoWallet, type Paquete, type Tarifa,
} from '@/lib/casillero';
import type { Profile } from '@/lib/supabase';

const MENU = [{ ruta: '/casillero/admin', etiqueta: 'Panel del equipo' }, { ruta: '/casillero', etiqueta: '← Mi casillero' }];
const SECCIONES = ['Paquetes', 'Despachos', 'Recargas', 'Clientes', 'Tarifas'] as const;
type Seccion = (typeof SECCIONES)[number];

const selectCls = 'rounded-md border border-input bg-transparent px-2 py-1 text-sm';
const quien = (p?: { full_name: string | null; casillero_codigo: string | null } | null) => `${p?.casillero_codigo ?? ''} · ${p?.full_name ?? ''}`;

export default function CasilleroAdmin() {
  const [sec, setSec] = useState<Seccion>('Paquetes');
  return (
    <CasilleroShell menu={MENU} actual="/casillero/admin" titulo="Casillero · equipo" soloEquipo>
      <div className="mb-4 flex flex-wrap gap-2">
        {SECCIONES.map((s) => (
          <Button key={s} size="sm" variant={s === sec ? 'default' : 'outline'} className={s === sec ? 'bg-[#b01c2e] hover:bg-[#8e1523]' : ''} onClick={() => setSec(s)}>{s}</Button>
        ))}
      </div>
      {sec === 'Paquetes' && <PaquetesAdmin />}
      {sec === 'Despachos' && <DespachosAdmin />}
      {sec === 'Recargas' && <RecargasAdmin />}
      {sec === 'Clientes' && <ClientesAdmin />}
      {sec === 'Tarifas' && <TarifasAdmin />}
    </CasilleroShell>
  );
}

function usarTabla<T>(tabla: string, select: string, orden = 'created_at', asc = false) {
  const [filas, setFilas] = useState<T[]>([]);
  const recargar = useCallback(async () => {
    const { data, error } = await (await db()).from(tabla).select(select).order(orden, { ascending: asc }).limit(300);
    if (error) toast.error(error.message);
    setFilas((data ?? []) as T[]);
  }, [tabla, select, orden, asc]);
  useEffect(() => { void recargar(); }, [recargar]);
  return [filas, recargar] as const;
}

function PaquetesAdmin() {
  const { getAccessToken } = useAuth();
  const [filas, recargar] = usarTabla<Paquete>('casillero_paquetes', '*, profiles(full_name, casillero_codigo)');
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Record<string, { peso: string; estado: string }>>({});
  const visibles = filas.filter((p) => `${p.guia} ${quien(p.profiles)}`.toLowerCase().includes(q.toLowerCase()));

  const guardar = async (p: Paquete) => {
    const e = edit[p.id] ?? { peso: String(p.peso_lb ?? ''), estado: p.estado };
    const { error } = await (await db()).from('casillero_paquetes').update({ peso_lb: e.peso === '' ? null : Number(e.peso), estado: e.estado }).eq('id', p.id);
    if (error) return toast.error(error.message);
    if (e.estado !== p.estado) {
      // El correo al cliente lo manda el servidor (Resend); si no está configurado, solo queda la campanita.
      const r = await api<{ enviado: boolean }>(`/casillero/paquetes/${p.id}/avisar`, getAccessToken());
      toast.success(r.ok && r.data.enviado ? 'Guardado y cliente avisado por correo' : 'Guardado');
    } else toast.success('Guardado');
    await recargar();
  };

  return (
    <>
      <RecibirSinPrealerta onListo={recargar} />
      <Panel>
      <div className="mb-3 max-w-xs"><Label>Buscar guía o cliente</Label><Input value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-neutral-500"><th className="p-2">Guía</th><th>Cliente</th><th>Contenido</th><th>Peso lb</th><th>Estado</th><th /></tr></thead>
        <tbody>
          {visibles.map((p) => {
            const e = edit[p.id] ?? { peso: String(p.peso_lb ?? ''), estado: p.estado };
            return (
              <tr key={p.id} className="border-t">
                <td className="p-2">{p.guia}</td><td>{quien(p.profiles)}</td><td>{p.descripcion}</td>
                <td><Input className="h-8 w-20" type="number" step="0.01" min="0" value={e.peso} onChange={(ev) => setEdit({ ...edit, [p.id]: { ...e, peso: ev.target.value } })} /></td>
                <td><select className={selectCls} value={e.estado} onChange={(ev) => setEdit({ ...edit, [p.id]: { ...e, estado: ev.target.value } })}>{ESTADOS_PAQUETE.map((s) => <option key={s}>{s}</option>)}</select></td>
                <td><Button size="sm" onClick={() => void guardar(p)}>Guardar</Button></td>
              </tr>
            );
          })}
          {!visibles.length && <tr><td colSpan={6} className="p-3 text-neutral-500">Sin paquetes.</td></tr>}
        </tbody>
      </table>
      </Panel>
    </>
  );
}

// Llega un paquete a la bodega y el cliente no lo prealertó: se registra por
// su código de casillero y queda directamente como recibido.
function RecibirSinPrealerta({ onListo }: { onListo: () => Promise<void> }) {
  const [f, setF] = useState({ codigo: '', guia: '', peso: '', descripcion: '' });
  const { getAccessToken } = useAuth();
  const registrar = async () => {
    if (!f.codigo.trim() || !f.guia.trim()) return toast.error('Código de cliente y guía son obligatorios');
    const s = await db();
    const { data: u } = await s.from('profiles').select('id').eq('casillero_codigo', f.codigo.trim().toUpperCase()).maybeSingle();
    if (!u) return toast.error('No existe un cliente con ese código');
    const { data, error } = await s.from('casillero_paquetes')
      .insert({ user_id: u.id, guia: f.guia.trim(), peso_lb: f.peso === '' ? null : Number(f.peso), descripcion: f.descripcion.trim(), estado: 'recibido' })
      .select('id').single();
    if (error) return toast.error(error.message);
    const r = await api<{ enviado: boolean }>(`/casillero/paquetes/${data.id}/avisar`, getAccessToken());
    toast.success(r.ok && r.data.enviado ? 'Paquete registrado y cliente avisado por correo' : 'Paquete registrado');
    setF({ codigo: '', guia: '', peso: '', descripcion: '' });
    await onListo();
  };
  return (
    <Panel>
      <b>Recibir un paquete sin prealerta</b>
      <div className="mt-2 grid gap-3 sm:grid-cols-5">
        <div><Label>Código cliente</Label><Input placeholder="DM1001" value={f.codigo} onChange={(e) => setF({ ...f, codigo: e.target.value })} /></div>
        <div><Label>Guía</Label><Input value={f.guia} onChange={(e) => setF({ ...f, guia: e.target.value })} /></div>
        <div><Label>Peso (lb)</Label><Input type="number" step="0.01" min="0" value={f.peso} onChange={(e) => setF({ ...f, peso: e.target.value })} /></div>
        <div><Label>Contenido</Label><Input value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} /></div>
        <div className="flex items-end"><Button onClick={() => void registrar()}>Registrar</Button></div>
      </div>
    </Panel>
  );
}

function DespachosAdmin() {
  const [filas, recargar] = usarTabla<Despacho>('casillero_despachos', '*, profiles(full_name, casillero_codigo)');
  const [edit, setEdit] = useState<Record<string, { guia: string; estado: string }>>({});
  const guardar = async (d: Despacho) => {
    const e = edit[d.id] ?? { guia: d.guia_despacho ?? '', estado: d.estado };
    const s = await db();
    const { error } = await s.from('casillero_despachos').update({ guia_despacho: e.guia.trim(), estado: e.estado }).eq('id', d.id);
    if (error) return toast.error(error.message);
    // Al despachar o entregar, los paquetes del despacho siguen el mismo estado.
    if (e.estado === 'despachado' || e.estado === 'entregado') await s.from('casillero_paquetes').update({ estado: e.estado }).eq('despacho_id', d.id);
    toast.success('Guardado');
    await recargar();
  };
  return (
    <Panel>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-neutral-500"><th className="p-2">Fecha</th><th>Cliente</th><th>Modalidad</th><th>Destino</th><th>Peso</th><th>Costo</th><th>Guía despacho</th><th>Estado</th><th /></tr></thead>
        <tbody>
          {filas.map((d) => {
            const e = edit[d.id] ?? { guia: d.guia_despacho ?? '', estado: d.estado };
            return (
              <tr key={d.id} className="border-t">
                <td className="p-2">{fecha(d.created_at)}</td><td>{quien(d.profiles)}</td><td>{MODALIDADES[d.modalidad]}</td><td>{d.destino}</td><td>{d.peso_total}</td><td>{usd(d.costo)}</td>
                <td><Input className="h-8 w-36" value={e.guia} onChange={(ev) => setEdit({ ...edit, [d.id]: { ...e, guia: ev.target.value } })} /></td>
                <td><select className={selectCls} value={e.estado} onChange={(ev) => setEdit({ ...edit, [d.id]: { ...e, estado: ev.target.value } })}>{['solicitado', 'despachado', 'entregado', 'cancelado'].map((s) => <option key={s}>{s}</option>)}</select></td>
                <td><Button size="sm" onClick={() => void guardar(d)}>Guardar</Button></td>
              </tr>
            );
          })}
          {!filas.length && <tr><td colSpan={9} className="p-3 text-neutral-500">Sin despachos.</td></tr>}
        </tbody>
      </table>
    </Panel>
  );
}

function RecargasAdmin() {
  const [filas, recargar] = usarTabla<MovimientoWallet>('casillero_wallet', '*, profiles(full_name, casillero_codigo)');
  const [aj, setAj] = useState({ codigo: '', monto: '', motivo: '' });

  const resolver = async (id: string, estado: 'aprobado' | 'rechazado') => {
    // Solo pasa de pendiente: una recarga de Wompi ya aprobada no se toca.
    const { error } = await (await db()).from('casillero_wallet').update({ estado }).eq('id', id).eq('estado', 'pendiente');
    if (error) toast.error(error.message); else await recargar();
  };
  const ajustar = async () => {
    const monto = Number(aj.monto);
    if (!aj.codigo.trim() || !monto) return toast.error('Código y monto requeridos');
    const s = await db();
    const { data: u } = await s.from('profiles').select('id').eq('casillero_codigo', aj.codigo.trim().toUpperCase()).maybeSingle();
    if (!u) return toast.error('Cliente no encontrado');
    const { error } = await s.from('casillero_wallet').insert({ user_id: u.id, tipo: 'ajuste', monto, estado: 'aprobado', referencia: aj.motivo.trim() || 'Ajuste del equipo' });
    if (error) return toast.error(error.message);
    setAj({ codigo: '', monto: '', motivo: '' });
    await recargar();
  };

  return (
    <>
      <Panel>
        <b>Ajuste manual de saldo</b>
        <div className="mt-2 grid gap-3 sm:grid-cols-4">
          <div><Label>Código cliente</Label><Input placeholder="DM1001" value={aj.codigo} onChange={(e) => setAj({ ...aj, codigo: e.target.value })} /></div>
          <div><Label>Monto (+/−)</Label><Input type="number" step="0.01" value={aj.monto} onChange={(e) => setAj({ ...aj, monto: e.target.value })} /></div>
          <div><Label>Motivo</Label><Input value={aj.motivo} onChange={(e) => setAj({ ...aj, motivo: e.target.value })} /></div>
          <div className="flex items-end"><Button onClick={() => void ajustar()}>Aplicar</Button></div>
        </div>
      </Panel>
      <Panel>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-neutral-500"><th className="p-2">Fecha</th><th>Cliente</th><th>Tipo</th><th>Método / ref</th><th>Monto</th><th>Estado</th><th /></tr></thead>
          <tbody>
            {filas.map((m) => (
              <tr key={m.id} className="border-t">
                <td className="p-2">{fecha(m.created_at)}</td><td>{quien(m.profiles)}</td><td>{m.tipo}</td>
                <td>{[m.metodo, m.referencia].filter(Boolean).join(' · ')}</td><td>{usd(m.monto)}</td><td><Etiqueta valor={m.estado} /></td>
                <td>{m.estado === 'pendiente' && m.metodo !== 'wompi' && (
                  <span className="flex gap-1"><Button size="sm" onClick={() => void resolver(m.id, 'aprobado')}>Aprobar</Button><Button size="sm" variant="outline" onClick={() => void resolver(m.id, 'rechazado')}>Rechazar</Button></span>
                )}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-neutral-500">Las recargas con Wompi se acreditan solas al confirmarse el pago; aquí solo se aprueban las reportadas a mano.</p>
      </Panel>
    </>
  );
}

function ClientesAdmin() {
  const [filas] = usarTabla<Profile>('profiles', '*', 'created_at');
  return (
    <Panel>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-neutral-500"><th className="p-2">Código</th><th>Nombre</th><th>Correo</th><th>Teléfono</th><th>Documento</th><th>Ciudad</th><th>Rol</th><th>Alta</th></tr></thead>
        <tbody>
          {filas.map((c) => (
            <tr key={c.id} className="border-t">
              <td className="p-2">{c.casillero_codigo}</td><td>{c.full_name}{c.es_empresa ? ` 🏢 ${c.company ?? ''}` : ''}</td><td>{c.email}</td>
              <td>{c.telefono}</td><td>{c.tipo_doc} {c.num_doc}</td><td>{c.ciudad}</td><td>{c.role}</td><td>{fecha(c.created_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

function TarifasAdmin() {
  const [filas, recargar] = usarTabla<Tarifa>('casillero_tarifas', '*', 'libras_desde', true);
  const [edit, setEdit] = useState<Record<number, Partial<Record<'rec_oficina' | 'local' | 'regional' | 'nacional', string>>>>({});
  const guardar = async (t: Tarifa) => {
    const e = edit[t.id] ?? {};
    const cambios = Object.fromEntries(Object.entries(e).map(([k, v]) => [k, Number(v)]));
    const { error } = await (await db()).from('casillero_tarifas').update(cambios).eq('id', t.id);
    if (error) toast.error(error.message); else { toast.success('Tarifa guardada'); await recargar(); }
  };
  const columnas = ['rec_oficina', 'local', 'regional', 'nacional'] as const;
  return (
    <Panel>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-neutral-500"><th className="p-2">Libras</th><th>Rec. oficina</th><th>Local</th><th>Regional</th><th>Nacional</th><th /></tr></thead>
        <tbody>
          {filas.map((t) => (
            <tr key={t.id} className="border-t">
              <td className="p-2">{t.libras_desde} a {t.libras_hasta}</td>
              {columnas.map((c) => (
                <td key={c}><Input className="h-8 w-24" type="number" step="0.01" value={edit[t.id]?.[c] ?? String(t[c])} onChange={(ev) => setEdit({ ...edit, [t.id]: { ...edit[t.id], [c]: ev.target.value } })} /></td>
              ))}
              <td><Button size="sm" onClick={() => void guardar(t)}>Guardar</Button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}
