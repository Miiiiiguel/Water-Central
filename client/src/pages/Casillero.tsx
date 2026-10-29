import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRoute } from 'wouter';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import CasilleroShell, { CLASE_CAMPO, Cifra, Entrada, Etiqueta, Panel, type ItemMenu } from '@/components/CasilleroShell';
import {
  DIRECCION_MIAMI, MODALIDADES, api, cotizar, db, fecha, saldoDe, usd,
  type Despacho, type Modalidad, type MovimientoWallet, type Paquete, type Tarifa,
} from '@/lib/casillero';

const MENU: ItemMenu[] = [
  { ruta: '/casillero', etiqueta: 'Inicio' },
  { ruta: '/casillero/prealerta', etiqueta: 'Prealertar' },
  { ruta: '/casillero/paquetes', etiqueta: 'Mis paquetes' },
  { ruta: '/casillero/despacho', etiqueta: 'Despachar' },
  { ruta: '/casillero/despachos', etiqueta: 'Mis despachos' },
  { ruta: '/casillero/wallet', etiqueta: 'Wallet' },
  { ruta: '/casillero/tarifas', etiqueta: 'Tarifas' },
  { ruta: '/casillero/perfil', etiqueta: 'Mi perfil' },
];
const TITULOS: Record<string, string> = {
  '': 'Mi casillero', prealerta: 'Prealertar un envío', paquetes: 'Mis paquetes', despacho: 'Solicitar despacho',
  despachos: 'Mis despachos', wallet: 'Wallet', tarifas: 'Tarifas mínimas', perfil: 'Mi perfil',
};

const selectCls = CLASE_CAMPO;

function useDatos() {
  const [paquetes, setPaquetes] = useState<Paquete[]>([]);
  const [movs, setMovs] = useState<MovimientoWallet[]>([]);
  const [tarifas, setTarifas] = useState<Tarifa[]>([]);
  const [despachos, setDespachos] = useState<Despacho[]>([]);
  const [config, setConfig] = useState<Record<string, string>>({});
  const recargar = useCallback(async () => {
    const s = await db();
    const [p, m, t, d, c] = await Promise.all([
      s.from('casillero_paquetes').select('*').order('created_at', { ascending: false }),
      s.from('casillero_wallet').select('*').order('created_at', { ascending: false }),
      s.from('casillero_tarifas').select('*').order('libras_desde'),
      s.from('casillero_despachos').select('*').order('created_at', { ascending: false }),
      s.from('casillero_config').select('clave,valor'),
    ]);
    setConfig(Object.fromEntries(((c.data ?? []) as { clave: string; valor: string }[]).map((x) => [x.clave, x.valor])));
    setPaquetes((p.data ?? []) as Paquete[]);
    setMovs((m.data ?? []) as MovimientoWallet[]);
    setTarifas((t.data ?? []) as Tarifa[]);
    setDespachos((d.data ?? []) as Despacho[]);
  }, []);
  useEffect(() => { void recargar(); }, [recargar]);
  return { paquetes, movs, tarifas, despachos, config, recargar };
}

export default function Casillero() {
  const [, params] = useRoute("/casillero/:seccion");
  const seccion = params?.seccion ?? '';
  const datos = useDatos();
  const actual = seccion ? `/casillero/${seccion}` : '/casillero';

  return (
    <CasilleroShell menu={MENU} actual={actual} titulo={TITULOS[seccion] ?? 'Mi casillero'}>
      {seccion === '' && <Inicio {...datos} />}
      {seccion === 'prealerta' && <Prealerta onListo={datos.recargar} config={datos.config} />}
      {seccion === 'paquetes' && <Paquetes {...datos} />}
      {seccion === 'despacho' && <Despachar {...datos} />}
      {seccion === 'despachos' && <MisDespachos {...datos} />}
      {seccion === 'wallet' && <Wallet {...datos} />}
      {seccion === 'tarifas' && <TablaTarifas tarifas={datos.tarifas} />}
      {seccion === 'perfil' && <Perfil />}
    </CasilleroShell>
  );
}

function DirCasillero({ config }: { config?: Record<string, string> }) {
  const { profile } = useAuth();
  return (
    <Panel className="bg-secondary">
      <b>Tu dirección de casillero en Miami</b>
      <p className="mt-1 leading-relaxed">
        {profile?.full_name} — <b>{profile?.casillero_codigo}</b><br />
        {config?.direccion_bodega || DIRECCION_MIAMI}<br />
        <span className="text-sm text-muted-foreground">Usa tu código {profile?.casillero_codigo} en el nombre o suite para identificar tus compras.</span>
      </p>
    </Panel>
  );
}

function Inicio({ paquetes, movs, config }: ReturnType<typeof useDatos>) {
  const { profile } = useAuth();
  const c = (e: string) => paquetes.filter((p) => p.estado === e).length;
  const tarjetas: [string, string][] = [
    ['Saldo wallet', usd(saldoDe(movs))], ['Prealertados', String(c('prealertado'))],
    ['En bodega', String(c('recibido'))], ['En proceso / enviados', String(c('alistamiento') + c('despachado'))],
  ];
  return (
    <>
      {profile?.casillero_bloqueado && <p className="mb-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">Tu casillero está bloqueado: no puedes prealertar ni despachar. Escríbenos para resolverlo.</p>}
      {config.aviso_clientes && <p className="mb-4 rounded-2xl border border-orange-100 bg-orange-50 p-4 text-sm text-orange-800">{config.aviso_clientes}</p>}
      <DirCasillero config={config} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tarjetas.map(([t, v], i) => <Cifra key={t} etiqueta={t} valor={v} acento={i === 0} />)}
      </div>
    </>
  );
}

function Prealerta({ onListo, config }: { onListo: () => Promise<void>; config: Record<string, string> }) {
  const { user } = useAuth();
  const [f, setF] = useState({ guia: '', proveedor: '', descripcion: '', valor: '' });
  const [ocupado, setOcupado] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const enviar = async () => {
    if (!user || !f.guia.trim()) return toast.error('Ingresa el número de guía');
    setOcupado(true);
    const { error } = await (await db()).from('casillero_paquetes').insert({
      user_id: user.id, guia: f.guia.trim(), proveedor: f.proveedor.trim(), descripcion: f.descripcion.trim(), valor_declarado: Number(f.valor) || 0,
    });
    setOcupado(false);
    if (error) return toast.error(error.message);
    toast.success('Prealerta registrada');
    setF({ guia: '', proveedor: '', descripcion: '', valor: '' });
    await onListo();
  };

  return (
    <>
      <DirCasillero config={config} />
      <Panel>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><Label className="mb-1.5 block">Número de guía</Label><Entrada value={f.guia} onChange={set('guia')} /></div>
          <div><Label className="mb-1.5 block">Proveedor / tienda</Label><Entrada value={f.proveedor} onChange={set('proveedor')} placeholder="Amazon, Shein, Nike…" /></div>
          <div><Label className="mb-1.5 block">Contenido</Label><Entrada value={f.descripcion} onChange={set('descripcion')} /></div>
          <div><Label className="mb-1.5 block">Valor declarado (USD)</Label><Entrada type="number" min="0" step="0.01" value={f.valor} onChange={set('valor')} /></div>
        </div>
        <Button className="mt-4 rounded-full bg-accent hover:bg-accent/90 text-white font-bold" disabled={ocupado} onClick={() => void enviar()}>Registrar prealerta</Button>
      </Panel>
    </>
  );
}

function Paquetes({ paquetes, recargar }: ReturnType<typeof useDatos>) {
  const [hist, setHist] = useState<{ estado: string; created_at: string; nota: string | null }[] | null>(null);
  const borrar = async (id: string) => {
    if (!confirm('¿Eliminar esta prealerta?')) return;
    const { error } = await (await db()).from('casillero_paquetes').delete().eq('id', id);
    if (error) toast.error(error.message); else await recargar();
  };
  const ver = async (id: string) => {
    const { data } = await (await db()).from('casillero_eventos').select('estado,created_at,nota').eq('paquete_id', id).order('created_at');
    setHist((data ?? []) as typeof hist);
  };
  return (
    <Panel>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-muted-foreground"><th className="p-2">Guía</th><th>Proveedor</th><th>Contenido</th><th>Peso (lb)</th><th>Estado</th><th>Fecha</th><th /></tr></thead>
        <tbody>
          {paquetes.map((p) => (
            <tr key={p.id} className="border-t">
              <td className="p-2">{p.guia}</td><td>{p.proveedor}</td><td>{p.descripcion}</td><td>{p.peso_lb ?? '—'}</td>
              <td><Etiqueta valor={p.estado} /></td><td>{fecha(p.created_at)}</td>
              <td>{p.estado === 'prealertado'
                ? <button className="text-accent underline" onClick={() => void borrar(p.id)}>Eliminar</button>
                : <button className="text-accent underline" onClick={() => void ver(p.id)}>Historial</button>}</td>
            </tr>
          ))}
          {!paquetes.length && <tr><td colSpan={7} className="p-3 text-muted-foreground">Aún no tienes paquetes.</td></tr>}
        </tbody>
      </table>
      {hist && (
        <div className="mt-4 border-t pt-3"><b>Historial</b>
          {hist.map((h, i) => <p key={i} className="text-sm"><Etiqueta valor={h.estado} /> {fecha(h.created_at)} {h.nota}</p>)}
        </div>
      )}
    </Panel>
  );
}

function Despachar({ paquetes, tarifas, movs, recargar }: ReturnType<typeof useDatos>) {
  const { profile } = useAuth();
  const listos = paquetes.filter((p) => p.estado === 'recibido' && p.peso_lb != null);
  const [sel, setSel] = useState<string[]>([]);
  const [modalidad, setModalidad] = useState<Modalidad>('local');
  const [destino, setDestino] = useState([profile?.direccion, profile?.ciudad].filter(Boolean).join(', '));
  const peso = listos.filter((p) => sel.includes(p.id)).reduce((a, p) => a + Number(p.peso_lb), 0);
  const costo = sel.length ? cotizar(tarifas, peso, modalidad) : null;
  const saldo = saldoDe(movs);

  const solicitar = async () => {
    if (!sel.length) return toast.error('Selecciona al menos un paquete');
    if (!destino.trim()) return toast.error('Indica el destino');
    const { error } = await (await db()).rpc('casillero_solicitar_despacho', { p_paquetes: sel, p_modalidad: modalidad, p_destino: destino.trim() });
    if (error) return toast.error(error.message);
    toast.success('Despacho solicitado');
    setSel([]);
    await recargar();
  };

  return (
    <Panel>
      <p className="mb-3">Saldo disponible: <b>{usd(saldo)}</b></p>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-muted-foreground"><th className="p-2" /><th>Guía</th><th>Contenido</th><th>Peso (lb)</th></tr></thead>
        <tbody>
          {listos.map((p) => (
            <tr key={p.id} className="border-t">
              <td className="p-2"><input type="checkbox" checked={sel.includes(p.id)} onChange={(e) => setSel(e.target.checked ? [...sel, p.id] : sel.filter((x) => x !== p.id))} /></td>
              <td>{p.guia}</td><td>{p.descripcion}</td><td>{p.peso_lb}</td>
            </tr>
          ))}
          {!listos.length && <tr><td colSpan={4} className="p-3 text-muted-foreground">No tienes paquetes recibidos y pesados.</td></tr>}
        </tbody>
      </table>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div><Label className="mb-1.5 block">Modalidad</Label>
          <select className={selectCls} value={modalidad} onChange={(e) => setModalidad(e.target.value as Modalidad)}>
            {Object.entries(MODALIDADES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select></div>
        <div><Label className="mb-1.5 block">Destino (dirección y ciudad)</Label><Entrada value={destino} onChange={(e) => setDestino(e.target.value)} /></div>
      </div>
      {sel.length > 0 && (
        <p className="mt-3 text-base">
          Peso total: <b>{peso.toFixed(2)} lb</b> · {costo == null ? 'fuera de la tabla, contacta a un asesor' : <>Costo: <b>{usd(costo)}</b></>}
        </p>
      )}
      <Button className="mt-4 rounded-full bg-accent hover:bg-accent/90 text-white font-bold" onClick={() => void solicitar()}>Solicitar despacho y pagar con wallet</Button>
    </Panel>
  );
}

function MisDespachos({ despachos }: ReturnType<typeof useDatos>) {
  return (
    <Panel>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-muted-foreground"><th className="p-2">Fecha</th><th>Modalidad</th><th>Destino</th><th>Peso</th><th>Costo</th><th>Guía de despacho</th><th>Estado</th></tr></thead>
        <tbody>
          {despachos.map((d) => (
            <tr key={d.id} className="border-t"><td className="p-2">{fecha(d.created_at)}</td><td>{MODALIDADES[d.modalidad]}</td><td>{d.destino}</td><td>{d.peso_total} lb</td><td>{usd(d.costo)}</td><td>{d.guia_despacho || '—'}</td><td><Etiqueta valor={d.estado} /></td></tr>
          ))}
          {!despachos.length && <tr><td colSpan={7} className="p-4 text-muted-foreground">Aún no has solicitado despachos.</td></tr>}
        </tbody>
      </table>
    </Panel>
  );
}

function Wallet({ movs, recargar }: ReturnType<typeof useDatos>) {
  const { getAccessToken } = useAuth();
  const [monto, setMonto] = useState('');
  const [metodo, setMetodo] = useState('Transferencia');
  const [ref, setRef] = useState('');
  const saldo = useMemo(() => saldoDe(movs), [movs]);

  // Wompi vuelve a esta página con ?id=<transacción>: se confirma contra
  // Wompi (el servidor la lee de su API) y se refresca el saldo.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id');
    if (!id) return;
    void api<{ paid: boolean }>('/casillero/wallet/confirmar', getAccessToken(), { transactionId: id }).then(async (r) => {
      if (r.ok && r.data.paid) toast.success('¡Recarga acreditada!');
      else if (r.ok) toast.message('Tu pago aún se está procesando. Se acreditará solo en unos minutos.');
      window.history.replaceState(null, '', window.location.pathname);
      await recargar();
    });
  }, [getAccessToken, recargar]);

  const conWompi = async () => {
    const m = Number(monto);
    if (!(m > 0)) return toast.error('Ingresa un monto válido');
    const r = await api<{ url: string }>('/casillero/wallet/recargar', getAccessToken(), { montoUsd: m });
    if (!r.ok) return toast.error(r.message ?? (r.error === 'monto_invalido' ? 'El monto debe estar entre USD 5 y 1.000' : 'No pudimos abrir el pago'));
    window.location.href = r.data.url;
  };
  const reportar = async () => {
    const m = Number(monto);
    if (!(m > 0)) return toast.error('Ingresa un monto válido');
    const r = await api('/casillero/wallet/reportar', getAccessToken(), { montoUsd: m, metodo, referencia: ref });
    if (!r.ok) return toast.error(r.message ?? 'No pudimos registrar la recarga');
    toast.success('Recarga reportada: se acredita cuando el equipo la verifique');
    setMonto(''); setRef('');
    await recargar();
  };

  return (
    <>
      <div className="mb-4 rounded-3xl border border-gray-100 bg-white p-5 app-shadow"><p className="text-sm text-muted-foreground">Saldo disponible</p><p className="text-3xl font-semibold">{usd(saldo)}</p></div>
      <Panel>
        <b>Recargar</b>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <div><Label className="mb-1.5 block">Monto (USD)</Label><Entrada type="number" min="5" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} /></div>
          <div><Label className="mb-1.5 block">Método (si ya pagaste fuera)</Label>
            <select className={selectCls} value={metodo} onChange={(e) => setMetodo(e.target.value)}>
              {['Transferencia', 'Zelle', 'Efectivo', 'Otro'].map((x) => <option key={x}>{x}</option>)}
            </select></div>
          <div><Label className="mb-1.5 block">Referencia / comprobante</Label><Entrada value={ref} onChange={(e) => setRef(e.target.value)} /></div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button className="rounded-full bg-accent hover:bg-accent/90 text-white font-bold" onClick={() => void conWompi()}>Pagar ahora con Wompi</Button>
          <Button variant="outline" onClick={() => void reportar()}>Reportar pago ya realizado</Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Wompi cobra en pesos colombianos a la tasa del día y acredita el wallet en USD automáticamente. Los pagos reportados los verifica el equipo.</p>
      </Panel>
      <Panel>
        <b>Movimientos</b>
        <table className="mt-2 w-full text-sm">
          <thead><tr className="text-left text-muted-foreground"><th className="p-2">Fecha</th><th>Tipo</th><th>Detalle</th><th>Monto</th><th>Estado</th></tr></thead>
          <tbody>
            {movs.map((m) => (
              <tr key={m.id} className="border-t"><td className="p-2">{fecha(m.created_at)}</td><td>{m.tipo}</td><td>{m.referencia ?? m.metodo}</td><td>{usd(m.monto)}</td><td><Etiqueta valor={m.estado} /></td></tr>
            ))}
            {!movs.length && <tr><td colSpan={5} className="p-3 text-muted-foreground">Sin movimientos.</td></tr>}
          </tbody>
        </table>
      </Panel>
    </>
  );
}

export function TablaTarifas({ tarifas }: { tarifas: Tarifa[] }) {
  return (
    <Panel>
      <table className="w-full text-sm">
        <thead><tr className="text-left text-muted-foreground"><th className="p-2">Libras</th><th>Rec. oficina</th><th>Local</th><th>Regional</th><th>Nacional</th></tr></thead>
        <tbody>
          {tarifas.map((t) => (
            <tr key={t.id} className="border-t"><td className="p-2">{t.libras_desde} a {t.libras_hasta}</td><td>{usd(t.rec_oficina)}</td><td>{usd(t.local)}</td><td>{usd(t.regional)}</td><td>{usd(t.nacional)}</td></tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-sm text-muted-foreground">Aplican con valor declarado igual o menor a USD 100.00. Si la ciudad destino aplica para reexpedición, el sistema generará un cobro adicional por ese trayecto.</p>
    </Panel>
  );
}

const CAMPOS_PERFIL = [
  ['full_name', 'Nombre completo'], ['telefono', 'Teléfono'], ['tipo_doc', 'Tipo de documento'], ['num_doc', 'Número de documento'],
  ['direccion', 'Dirección'], ['pais', 'País'], ['departamento', 'Departamento'], ['ciudad', 'Ciudad'], ['codigo_postal', 'Código postal'],
] as const;

function Perfil() {
  const { profile, user } = useAuth();
  const [v, setV] = useState<Record<string, string>>(() => Object.fromEntries(CAMPOS_PERFIL.map(([k]) => [k, String((profile as unknown as Record<string, unknown>)?.[k] ?? '')])));
  const guardar = async () => {
    if (!user) return;
    const { error } = await (await db()).from('profiles').update(v).eq('id', user.id);
    if (error) toast.error(error.message); else toast.success('Guardado');
  };
  return (
    <Panel>
      <div className="grid gap-4 sm:grid-cols-2">
        {CAMPOS_PERFIL.map(([k, l]) => <div key={k}><Label className="mb-1.5 block">{l}</Label><Entrada value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></div>)}
      </div>
      <Button className="mt-4 rounded-full bg-accent hover:bg-accent/90 text-white font-bold" onClick={() => void guardar()}>Guardar</Button>
    </Panel>
  );
}
