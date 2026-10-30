import { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { toast } from 'sonner';
import { Ban, Boxes, Building2, Mail, Package, Phone, Plug, Save, ShieldCheck, UserPlus, Users, Wallet } from 'lucide-react';
import { Aparece, Boton, Campo, Card, Entrada, Etiqueta, PageHeader, PanelLateral, Seccion, Segmentos, Seleccion, Skeleton, Stat, useAsync, useConfirmar } from '@/portal/ui';
import DataTable, { type Columna } from '@/portal/DataTable';
import { Barras, BarrasHorizontales, PALETA } from '@/portal/charts';
import { fecha, hace, iniciales, mesCorto, num, usd } from '@/portal/format';
import { AjustarSaldo } from '@/portal/clientes';
import { leerTodo, useAdmin } from '@/portal/admin';
import { db, type MovimientoWallet, type Paquete } from '@/lib/casillero';

interface Perfil {
  id: string; email: string; full_name: string | null; company: string | null; role: 'cliente' | 'vendedor'; created_at: string;
  casillero_codigo: string | null; telefono: string | null; tipo_doc: string | null; num_doc: string | null; direccion: string | null; pais: string | null;
  departamento: string | null; ciudad: string | null; codigo_postal: string | null; como_nos_conocio: string | null; es_empresa: boolean; casillero_bloqueado: boolean;
}
type Fila = Perfil & { saldo: number };
type Filtro = 'todos' | 'activos' | 'bloqueados' | 'saldo' | 'nuevos';

const EDITABLES = ['full_name', 'company', 'telefono', 'tipo_doc', 'num_doc', 'direccion', 'pais', 'departamento', 'ciudad', 'codigo_postal'] as const;
const DOCS = ['Cédula', 'Cédula de extranjería', 'Pasaporte', 'NIT'];
const hace30 = () => Date.now() - 30 * 86_400_000;

export default function Clientes() {
  const { recargar: recargarStats } = useAdmin();
  const d = useAsync(async () => {
    const s = await db();
    const [p, v] = await Promise.all([
      leerTodo<Perfil>((a, b) => s.from('profiles').select('*').eq('role', 'cliente').order('created_at', { ascending: false }).order('id').range(a, b)),
      leerTodo<{ user_id: string; saldo: number }>((a, b) => s.from('casillero_saldos').select('user_id, saldo').order('user_id').range(a, b)),
    ]);
    const saldos = new Map(v.map((x) => [x.user_id, Number(x.saldo)]));
    return p.map((x) => ({ ...x, saldo: saldos.get(x.id) ?? 0 })) as Fila[];
  }, []);
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [abierto, setAbierto] = useState<string | null>(null);
  const filas = d.datos ?? [];
  const elegido = filas.find((f) => f.id === abierto) ?? null;

  const visibles = useMemo(() => filas.filter((f) => (
    filtro === 'todos' ? true : filtro === 'activos' ? !f.casillero_bloqueado : filtro === 'bloqueados' ? f.casillero_bloqueado : filtro === 'saldo' ? f.saldo > 0 : new Date(f.created_at).getTime() > hace30()
  )), [filas, filtro]);
  const cuenta = (k: Filtro) => (k === 'todos' ? filas.length : filas.filter((f) => (k === 'activos' ? !f.casillero_bloqueado : k === 'bloqueados' ? f.casillero_bloqueado : k === 'saldo' ? f.saldo > 0 : new Date(f.created_at).getTime() > hace30())).length);

  const porMes = useMemo(() => {
    const hoy = new Date();
    const meses = Array.from({ length: 6 }, (_, i) => { const m = new Date(hoy.getFullYear(), hoy.getMonth() - (5 - i), 1); return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}`; });
    return meses.map((mes) => ({ mes, registros: filas.filter((f) => f.created_at.slice(0, 7) === mes).length }));
  }, [filas]);
  const origen = useMemo(() => {
    const t = new Map<string, number>();
    for (const f of filas) t.set(f.como_nos_conocio || 'Sin dato', (t.get(f.como_nos_conocio || 'Sin dato') ?? 0) + 1);
    return Array.from(t.entries()).map(([medio, n]) => ({ medio, n })).sort((a, b) => b.n - a.n).slice(0, 6);
  }, [filas]);
  const cambio = async () => { await Promise.all([d.recargar(), recargarStats()]); };

  const columnas: Columna<Fila>[] = [
    { clave: 'cliente', titulo: 'Cliente', movil: 'titulo', orden: (f) => f.casillero_codigo ?? '', celda: (f) => (
      <div className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-black text-white">{iniciales(f.full_name, f.email)}</span><div className="min-w-0"><p className="truncate font-bold text-primary">{f.full_name || 'Sin nombre'}</p><p className="truncate text-xs text-muted-foreground">{f.casillero_codigo} · {f.email}</p></div></div>) },
    { clave: 'contacto', titulo: 'Teléfono', celda: (f) => <span className="whitespace-nowrap text-muted-foreground">{f.telefono ?? '—'}</span> },
    { clave: 'ciudad', titulo: 'Ciudad', orden: (f) => f.ciudad ?? '', celda: (f) => <span className="whitespace-nowrap text-muted-foreground">{f.ciudad ?? '—'}</span> },
    { clave: 'saldo', titulo: 'Saldo', alinear: 'der', orden: (f) => f.saldo, celda: (f) => <b className={`tabular-nums ${f.saldo > 0 ? 'text-green-700' : 'text-gray-400'}`}>{usd(f.saldo)}</b> },
    { clave: 'estado', titulo: 'Estado', orden: (f) => Number(f.casillero_bloqueado), celda: (f) => (f.casillero_bloqueado ? <Etiqueta tono="rojo">Bloqueado</Etiqueta> : <Etiqueta tono="verde">Activo</Etiqueta>) },
    { clave: 'alta', titulo: 'Registro', orden: (f) => f.created_at, celda: (f) => <span className="whitespace-nowrap text-muted-foreground">{fecha(f.created_at)}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader titulo="Clientes" subtitulo="Todas las personas con casillero. Abre una ficha para editar sus datos, ver su actividad, ajustar su saldo o bloquear el acceso." />

      <Aparece>
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          <Stat tono="oscuro" etiqueta="Clientes" valor={filas.length} icono={<Users size={18} />} pista={`${cuenta('activos')} activos`} cargando={d.cargando} />
          <Stat tono="naranja" etiqueta="Nuevos 30 días" valor={cuenta('nuevos')} icono={<UserPlus size={18} />} cargando={d.cargando} onClick={() => setFiltro('nuevos')} />
          <Stat etiqueta="Con saldo" valor={cuenta('saldo')} icono={<Wallet size={18} />} tono="verde" pista={`${usd(filas.reduce((a, f) => a + Math.max(0, f.saldo), 0))} en total`} cargando={d.cargando} onClick={() => setFiltro('saldo')} />
          <Stat etiqueta="Bloqueados" valor={cuenta('bloqueados')} icono={<Ban size={18} />} tono="rojo" cargando={d.cargando} onClick={() => setFiltro('bloqueados')} />
        </div>
      </Aparece>

      <div className="grid gap-6 xl:grid-cols-3">
        <Aparece retraso={0.05} className="xl:col-span-2">
          <Seccion titulo="Registros por mes" ayuda="Clientes nuevos en los últimos seis meses.">
            {d.cargando ? <Skeleton className="h-48 w-full" /> : <Barras datos={porMes} x="mes" xFormato={mesCorto} alto={200} series={[{ clave: 'registros', etiqueta: 'Registros', color: PALETA.naranja }]} resumen="Registros de clientes por mes" />}
          </Seccion>
        </Aparece>
        <Aparece retraso={0.08}>
          <Seccion titulo="¿Cómo nos conocieron?" ayuda="Lo que eligen al registrarse.">
            {d.cargando ? <Skeleton className="h-48 w-full" /> : <BarrasHorizontales datos={origen} nombre="medio" valor="n" color={PALETA.marino} formato={num} resumen="Medios por los que conocieron el casillero" />}
          </Seccion>
        </Aparece>
      </div>

      <Aparece retraso={0.1}>
        <DataTable
          columnas={columnas} filas={visibles} id={(f) => f.id} cargando={d.cargando} porPagina={25} onFila={(f) => setAbierto(f.id)}
          buscar={(f) => `${f.full_name ?? ''} ${f.email} ${f.casillero_codigo ?? ''} ${f.telefono ?? ''} ${f.num_doc ?? ''} ${f.ciudad ?? ''} ${f.company ?? ''}`} textoBuscar="Buscar por nombre, código, correo, teléfono o documento"
          filtros={<Segmentos valor={filtro} onCambio={setFiltro} opciones={[{ valor: 'todos', etiqueta: 'Todos', cuenta: cuenta('todos') }, { valor: 'activos', etiqueta: 'Activos' }, { valor: 'saldo', etiqueta: 'Con saldo' }, { valor: 'nuevos', etiqueta: 'Nuevos' }, { valor: 'bloqueados', etiqueta: 'Bloqueados', cuenta: cuenta('bloqueados') }]} />}
          exportar={{ nombre: 'clientes', fila: (f) => ({ codigo: f.casillero_codigo, nombre: f.full_name, correo: f.email, telefono: f.telefono, documento: [f.tipo_doc, f.num_doc].filter(Boolean).join(' '), empresa: f.company, direccion: f.direccion, ciudad: f.ciudad, departamento: f.departamento, pais: f.pais, como_nos_conocio: f.como_nos_conocio, saldo_usd: f.saldo, bloqueado: f.casillero_bloqueado ? 'sí' : 'no', registro: f.created_at }) }}
          ordenInicial={{ clave: 'alta', asc: false }}
        />
      </Aparece>

      <PanelLateral abierto={!!elegido} onCerrar={() => setAbierto(null)} titulo={elegido?.full_name || elegido?.email || 'Cliente'} descripcion={elegido ? `${elegido.casillero_codigo} · cliente desde ${fecha(elegido.created_at)}` : undefined}>
        {elegido && <Ficha key={elegido.id} c={elegido} onCambio={cambio} />}
      </PanelLateral>
    </div>
  );
}

function Ficha({ c, onCambio }: { c: Fila; onCambio: () => Promise<void> }) {
  const confirmar = useConfirmar();
  const [v, setV] = useState<Record<string, string>>(() => Object.fromEntries(EDITABLES.map((k) => [k, c[k] ?? ''])));
  const [guardando, setGuardando] = useState(false);
  const [ajuste, setAjuste] = useState(false);
  useEffect(() => { setV(Object.fromEntries(EDITABLES.map((k) => [k, c[k] ?? '']))); }, [c]);
  const sucio = EDITABLES.some((k) => (v[k] ?? '').trim() !== (c[k] ?? ''));

  const act = useAsync(async () => {
    const s = await db();
    const [p, w, ds, ig, pr] = await Promise.all([
      s.from('casillero_paquetes').select('id, guia, estado, peso_lb, descripcion, created_at').eq('user_id', c.id).order('created_at', { ascending: false }).limit(8),
      s.from('casillero_wallet').select('id, tipo, monto, estado, metodo, referencia, created_at').eq('user_id', c.id).order('created_at', { ascending: false }).limit(8),
      s.from('casillero_despachos').select('id', { count: 'exact', head: true }).eq('user_id', c.id),
      s.from('casillero_integraciones').select('id, plataforma, dominio, estado').eq('user_id', c.id),
      s.from('casillero_inventario').select('id, disponibles').eq('user_id', c.id),
    ]);
    const prod = (pr.data ?? []) as { disponibles: number }[];
    return {
      paquetes: (p.data ?? []) as Pick<Paquete, 'id' | 'guia' | 'estado' | 'peso_lb' | 'descripcion' | 'created_at'>[],
      movs: (w.data ?? []) as Pick<MovimientoWallet, 'id' | 'tipo' | 'monto' | 'estado' | 'metodo' | 'referencia' | 'created_at'>[],
      despachos: ds.count ?? 0, tiendas: (ig.data ?? []) as { id: string; plataforma: string; dominio: string; estado: 'activa' | 'error' }[],
      productos: prod.length, unidades: prod.reduce((a, x) => a + x.disponibles, 0),
    };
  }, [c.id, c.saldo]);

  const guardar = async () => {
    setGuardando(true);
    const cambios = Object.fromEntries(EDITABLES.map((k) => [k, (v[k] ?? '').trim() || null]));
    const { error } = await (await db()).from('profiles').update({ ...cambios, es_empresa: !!(v.company ?? '').trim() }).eq('id', c.id);
    setGuardando(false);
    if (error) return toast.error(error.message);
    toast.success('Datos del cliente guardados');
    await onCambio();
  };
  const bloquear = async () => {
    const bloquear = !c.casillero_bloqueado;
    if (bloquear && !(await confirmar({ titulo: `¿Bloquear a ${c.full_name ?? c.email}?`, texto: 'No podrá prealertar paquetes, pedir despachos ni crear productos. Sus datos y su saldo se conservan, y puedes desbloquearlo cuando quieras.', confirmar: 'Bloquear', peligro: true }))) return;
    const { error } = await (await db()).rpc('casillero_set_bloqueo', { p_user: c.id, p_bloqueado: bloquear });
    if (error) return toast.error(error.message);
    toast.success(bloquear ? 'Cliente bloqueado' : 'Cliente desbloqueado');
    await onCambio();
  };
  const campo = (k: (typeof EDITABLES)[number], etiqueta: string, extra?: string) => (
    <Campo etiqueta={etiqueta} id={`cl-${k}`} className={extra}><Entrada id={`cl-${k}`} value={v[k] ?? ''} onChange={(e) => setV({ ...v, [k]: e.target.value })} /></Campo>
  );
  const a = act.datos;

  return (
    <>
      <Card className="!p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-black text-white">{iniciales(c.full_name, c.email)}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-heading text-lg font-black text-primary">{c.full_name || 'Sin nombre'}</p>
            <p className="flex items-center gap-1.5 truncate text-sm text-muted-foreground"><Mail size={13} />{c.email}</p>
            {c.telefono && <p className="flex items-center gap-1.5 text-sm text-muted-foreground"><Phone size={13} />{c.telefono}</p>}
          </div>
          <div className="flex flex-col items-end gap-1.5"><b className="rounded-full bg-secondary px-3 py-1 text-xs font-black text-secondary-foreground">{c.casillero_codigo}</b>{c.casillero_bloqueado ? <Etiqueta tono="rojo">Bloqueado</Etiqueta> : <Etiqueta tono="verde">Activo</Etiqueta>}{c.es_empresa && <Etiqueta tono="azul"><Building2 size={11} />Empresa</Etiqueta>}</div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-gray-50 p-3"><p className="text-xs text-muted-foreground">Saldo</p><p className="font-heading text-lg font-black text-primary">{usd(c.saldo)}</p></div>
          <div className="rounded-2xl bg-gray-50 p-3"><p className="text-xs text-muted-foreground">Despachos</p><p className="font-heading text-lg font-black text-primary">{a ? a.despachos : '…'}</p></div>
          <div className="rounded-2xl bg-gray-50 p-3"><p className="text-xs text-muted-foreground">Unidades en stock</p><p className="font-heading text-lg font-black text-primary">{a ? num(a.unidades) : '…'}</p></div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Boton chico variante="oscuro" onClick={() => setAjuste(true)} icono={<Wallet size={13} />}>Ajustar saldo</Boton>
          <Boton chico variante={c.casillero_bloqueado ? 'suave' : 'peligro'} onClick={() => void bloquear()} icono={c.casillero_bloqueado ? <ShieldCheck size={13} /> : <Ban size={13} />}>{c.casillero_bloqueado ? 'Desbloquear' : 'Bloquear'}</Boton>
        </div>
      </Card>

      <Seccion titulo="Datos del cliente" ayuda={c.como_nos_conocio ? `Nos conoció por: ${c.como_nos_conocio}` : undefined}>
        <div className="grid gap-3 sm:grid-cols-2">
          {campo('full_name', 'Nombre completo', 'sm:col-span-2')}
          {campo('telefono', 'Teléfono')}
          {campo('company', 'Empresa')}
          <Campo etiqueta="Tipo de documento" id="cl-tipo_doc"><Seleccion id="cl-tipo_doc" value={v.tipo_doc ?? ''} onChange={(e) => setV({ ...v, tipo_doc: e.target.value })}><option value="">—</option>{DOCS.map((x) => <option key={x}>{x}</option>)}</Seleccion></Campo>
          {campo('num_doc', 'Número de documento')}
          {campo('direccion', 'Dirección', 'sm:col-span-2')}
          {campo('pais', 'País')}
          {campo('departamento', 'Departamento')}
          {campo('ciudad', 'Ciudad')}
          {campo('codigo_postal', 'Código postal')}
        </div>
        <div className="mt-4 flex justify-end"><Boton variante="primario" chico cargando={guardando} disabled={!sucio} onClick={() => void guardar()} icono={<Save size={13} />}>Guardar cambios</Boton></div>
      </Seccion>

      <Seccion titulo="Paquetes recientes" acciones={<Link href="/admin/casillero/paquetes" className="text-xs font-bold text-accent hover:underline">Ver todos</Link>}>
        {act.cargando ? <Skeleton className="h-20 w-full" /> : !a?.paquetes.length ? <p className="text-sm text-muted-foreground">Aún no tiene paquetes.</p> : (
          <ul className="divide-y divide-gray-100">{a.paquetes.map((p) => <li key={p.id} className="flex items-center gap-3 py-2.5 text-sm"><Package size={15} className="shrink-0 text-gray-400" /><div className="min-w-0 flex-1"><b className="break-all font-mono text-[13px] text-primary">{p.guia}</b><p className="truncate text-xs text-muted-foreground">{p.descripcion ?? 'Sin descripción'} · {hace(p.created_at)}</p></div><Etiqueta estado={p.estado} /></li>)}</ul>
        )}
      </Seccion>

      <Seccion titulo="Wallet" acciones={<Link href="/admin/casillero/wallet" className="text-xs font-bold text-accent hover:underline">Ir al wallet</Link>}>
        {act.cargando ? <Skeleton className="h-20 w-full" /> : !a?.movs.length ? <p className="text-sm text-muted-foreground">Sin movimientos.</p> : (
          <ul className="divide-y divide-gray-100">{a.movs.map((m) => <li key={m.id} className="flex items-center gap-3 py-2.5 text-sm"><div className="min-w-0 flex-1"><p className="font-semibold text-primary">{m.tipo === 'recarga' ? 'Recarga' : m.tipo === 'cargo' ? 'Cobro de despacho' : 'Ajuste'}{m.metodo ? ` · ${m.metodo === 'wompi' ? 'Wompi' : m.metodo}` : ''}</p><p className="truncate text-xs text-muted-foreground">{m.referencia ?? ''} {hace(m.created_at)}</p></div><b className={`tabular-nums ${Number(m.monto) < 0 ? 'text-red-600' : 'text-green-700'}`}>{Number(m.monto) > 0 ? '+' : ''}{usd(m.monto)}</b><Etiqueta estado={m.estado} /></li>)}</ul>
        )}
      </Seccion>

      <Seccion titulo="Inventario e integraciones" acciones={<Link href="/admin/casillero/inventario" className="text-xs font-bold text-accent hover:underline">Ver inventario</Link>}>
        {act.cargando ? <Skeleton className="h-16 w-full" /> : (
          <div className="space-y-2 text-sm">
            <p className="flex items-center gap-2 text-muted-foreground"><Boxes size={15} className="shrink-0" /><span><b className="text-primary">{a?.productos ?? 0}</b> productos · <b className="text-primary">{num(a?.unidades ?? 0)}</b> unidades disponibles</span></p>
            {a?.tiendas.length ? a.tiendas.map((t) => <p key={t.id} className="flex items-center gap-2 text-muted-foreground"><Plug size={15} className="shrink-0" /><span className="min-w-0 break-all">{t.plataforma === 'shopify' ? 'Shopify' : 'WordPress'} · {t.dominio.replace(/^https?:\/\//, '')}</span> <Etiqueta estado={t.estado} /></p>) : <p className="flex items-center gap-2 text-muted-foreground"><Plug size={15} />Sin tiendas conectadas.</p>}
          </div>
        )}
      </Seccion>

      <AjustarSaldo abierto={ajuste} onCerrar={() => setAjuste(false)} onListo={onCambio} clienteInicial={c.id} />
    </>
  );
}
