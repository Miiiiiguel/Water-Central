import { useCallback, useEffect, useState } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, CalendarPlus, ChevronDown, Eye, Loader2, Mail, Plus, Save, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  aLista,
  borrarFabricante,
  crearFabricante,
  guardarFabricante,
  listarFabricantesAdmin,
  type FabricanteAdmin,
  extenderUnMes,
  type FabricanteEditable,
} from '@/lib/fabricantes';
import { PAISES } from '@/lib/paises';

// Administración de fabricantes patrocinados, sólo para las cuentas
// maestras (el servidor lo exige; esta página sólo lo refleja). Acá se
// crean, se aprueban las solicitudes que llegan desde /fabricantes, se
// activa o extiende la pauta (el cobro es manual: pagan el mes y se
// extiende) y se ven las vistas y los contactos de cada uno, que es lo que
// se le reporta al fabricante para que renueve.

const inputCls =
  'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-primary outline-none transition-all placeholder:font-normal placeholder:text-gray-400 focus:border-accent focus:ring-2 focus:ring-accent/20';

const VACIO: FabricanteEditable = {
  nombre: '',
  descripcion: null,
  pais: 'CO',
  ciudad: null,
  categorias: [],
  palabras: [],
  pedido_minimo: null,
  certificaciones: null,
  contacto_nombre: null,
  contacto_email: null,
  contacto_whatsapp: null,
  sitio_web: null,
  estado: 'aprobado',
  activo: true,
  pauta_hasta: null,
  prioridad: 0,
  plan: null,
  precio_mensual_usd: null,
  notas: null,
};

const editable = (f: FabricanteAdmin): FabricanteEditable => {
  const e = { ...VACIO };
  for (const k of Object.keys(VACIO) as Array<keyof FabricanteEditable>) (e as Record<string, unknown>)[k] = f[k];
  return e;
};

const usd = (n: number) => `US$${n.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;

function Campo({ label, children, ancho = false }: { label: string; children: React.ReactNode; ancho?: boolean }) {
  return (
    <label className={`block ${ancho ? 'sm:col-span-2' : ''}`}>
      <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Formulario({ inicial, onGuardar, ocupado, textoBoton }: { inicial: FabricanteEditable; onGuardar: (f: FabricanteEditable) => void; ocupado: boolean; textoBoton: string }) {
  const [f, setF] = useState<FabricanteEditable>(inicial);
  const [categorias, setCategorias] = useState(inicial.categorias.join(', '));
  const [palabras, setPalabras] = useState(inicial.palabras.join(', '));
  const set = <K extends keyof FabricanteEditable>(k: K, v: FabricanteEditable[K]) => setF((x) => ({ ...x, [k]: v }));
  const texto = (k: keyof FabricanteEditable) => ({
    value: (f[k] as string | null) ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k, (e.target.value || null) as never),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onGuardar({ ...f, categorias: aLista(categorias), palabras: aLista(palabras) });
      }}
      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
    >
      <Campo label="Nombre">
        <input value={f.nombre} onChange={(e) => set('nombre', e.target.value)} required minLength={2} className={inputCls} />
      </Campo>
      <Campo label="Ciudad">
        <input {...texto('ciudad')} className={inputCls} />
      </Campo>
      <Campo label="País">
        <select value={f.pais} onChange={(e) => set('pais', e.target.value)} className={inputCls}>
          {PAISES.map((p) => (
            <option key={p.iso} value={p.iso}>{p.es}</option>
          ))}
        </select>
      </Campo>
      <Campo label="Sitio web (https://…)">
        <input {...texto('sitio_web')} className={inputCls} />
      </Campo>
      <Campo label="Lo que ve el cliente (descripción corta)" ancho>
        <textarea {...texto('descripcion')} rows={2} maxLength={600} className={inputCls} />
      </Campo>
      <Campo label="Categorías: capítulos o partidas (ej.: 33, 3401)">
        <input value={categorias} onChange={(e) => setCategorias(e.target.value)} placeholder="33, 3401" className={inputCls} />
      </Campo>
      <Campo label="Palabras con que lo buscan (ej.: shampoo, crema)">
        <input value={palabras} onChange={(e) => setPalabras(e.target.value)} placeholder="shampoo, crema, jabón" className={inputCls} />
      </Campo>
      <Campo label="Pedido mínimo">
        <input {...texto('pedido_minimo')} placeholder="500 unidades" className={inputCls} />
      </Campo>
      <Campo label="Certificaciones">
        <input {...texto('certificaciones')} placeholder="Invima, BPM, ISO 9001" className={inputCls} />
      </Campo>
      <Campo label="Contacto (nombre)">
        <input {...texto('contacto_nombre')} className={inputCls} />
      </Campo>
      <Campo label="Correo donde le llegan los clientes">
        <input {...texto('contacto_email')} type="email" className={inputCls} />
      </Campo>
      <Campo label="WhatsApp (con indicativo, ej.: +57 300…)">
        <input {...texto('contacto_whatsapp')} className={inputCls} />
      </Campo>
      <Campo label="Plan">
        <input {...texto('plan')} placeholder="Destacado cosméticos" className={inputCls} />
      </Campo>
      <Campo label="Precio mensual (USD)">
        <input
          value={f.precio_mensual_usd ?? ''}
          onChange={(e) => set('precio_mensual_usd', e.target.value === '' ? null : Math.max(0, Number(e.target.value)))}
          type="number"
          min={0}
          className={inputCls}
        />
      </Campo>
      <Campo label="Prioridad (más alto sale primero)">
        <input value={f.prioridad} onChange={(e) => set('prioridad', Math.max(0, Math.min(100, parseInt(e.target.value || '0', 10) || 0)))} type="number" min={0} max={100} className={inputCls} />
      </Campo>
      <Campo label="Pauta pagada hasta">
        <input value={f.pauta_hasta ?? ''} onChange={(e) => set('pauta_hasta', e.target.value || null)} type="date" className={inputCls} />
      </Campo>
      <Campo label="Estado">
        <select value={f.estado} onChange={(e) => set('estado', e.target.value as FabricanteEditable['estado'])} className={inputCls}>
          <option value="aprobado">Aprobado</option>
          <option value="pendiente">Pendiente de revisar</option>
        </select>
      </Campo>
      <Campo label="Notas internas (no las ve nadie más)" ancho>
        <textarea {...texto('notas')} rows={2} className={inputCls} />
      </Campo>
      <label className="flex items-center gap-2 text-sm font-semibold text-primary sm:col-span-2">
        <input type="checkbox" checked={f.activo} onChange={(e) => set('activo', e.target.checked)} className="h-4 w-4 accent-primary" />
        Activo (si lo apagas, deja de salir aunque tenga pauta)
      </label>
      <button type="submit" disabled={ocupado} className="tap-scale-sm inline-flex w-fit items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50">
        {ocupado ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} {textoBoton}
      </button>
    </form>
  );
}

function Estado({ f, hoy }: { f: FabricanteAdmin; hoy: string }) {
  const [cls, texto] =
    f.estado === 'pendiente'
      ? ['bg-blue-100 text-blue-800', 'Solicitud pendiente']
      : !f.activo
        ? ['bg-gray-100 text-gray-700', 'Apagado']
        : f.vigente
          ? ['bg-green-100 text-green-800', `Al aire hasta ${f.pauta_hasta}`]
          : f.pauta_hasta && f.pauta_hasta < hoy
            ? ['bg-amber-100 text-amber-800', `Venció el ${f.pauta_hasta}`]
            : ['bg-amber-100 text-amber-800', 'Sin pauta'];
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${cls}`}>{texto}</span>;
}

function Fila({ f, hoy, token, onCambio }: { f: FabricanteAdmin; hoy: string; token: string | null; onCambio: () => void }) {
  const [abierta, setAbierta] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const guardar = async (datos: FabricanteEditable) => {
    setOcupado(true);
    setError(null);
    const r = await guardarFabricante(token, f.id, datos);
    setOcupado(false);
    if (r.ok) onCambio();
    else setError(r.message);
  };

  return (
    <div className="rounded-2xl border border-gray-100 bg-white app-shadow">
      <button type="button" onClick={() => setAbierta((v) => !v)} className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2 font-bold text-primary">
            {f.nombre} <Estado f={f} hoy={hoy} />
          </p>
          <p className="text-xs text-muted-foreground">
            {[f.ciudad, f.pais].filter(Boolean).join(', ')}
            {f.plan ? ` · ${f.plan}` : ''}
            {f.precio_mensual_usd ? ` · ${usd(f.precio_mensual_usd)}/mes` : ''}
          </p>
        </div>
        <div className="flex items-center gap-4 text-right">
          <div>
            <p className="font-black tabular-nums text-primary">{f.metricas.impresiones30}</p>
            <p className="text-[11px] text-muted-foreground">vistas 30 días</p>
          </div>
          <div>
            <p className="font-black tabular-nums text-accent">{f.metricas.contactos30}</p>
            <p className="text-[11px] text-muted-foreground">contactos 30 días</p>
          </div>
          <ChevronDown size={18} className={`text-muted-foreground transition-transform ${abierta ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {abierta && (
        <div className="space-y-5 border-t border-gray-100 p-4">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={ocupado}
              onClick={() => void guardar({ ...editable(f), estado: 'aprobado', activo: true, pauta_hasta: extenderUnMes(f.pauta_hasta, hoy) })}
              className="tap-scale-sm inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
            >
              <CalendarPlus size={15} /> {f.estado === 'pendiente' ? 'Aprobar y activar 1 mes' : 'Pagó: extender 1 mes'}
            </button>
            <button
              type="button"
              disabled={ocupado}
              onClick={() => {
                if (!window.confirm(`¿Borrar a ${f.nombre} y todo su historial de vistas y contactos?`)) return;
                void (async () => {
                  setOcupado(true);
                  const r = await borrarFabricante(token, f.id);
                  setOcupado(false);
                  if (r.ok) onCambio();
                  else setError(r.message);
                })();
              }}
              className="tap-scale-sm inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
            >
              <Trash2 size={15} /> Borrar
            </button>
          </div>
          {error && <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>}

          <Formulario key={f.id + f.pauta_hasta + f.estado} inicial={editable(f)} onGuardar={(d) => void guardar(d)} ocupado={ocupado} textoBoton="Guardar cambios" />

          <div>
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <Mail size={13} /> Últimos contactos ({f.metricas.contactos} en total)
            </p>
            {f.contactos.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía nadie lo ha contactado.</p>
            ) : (
              <ul className="divide-y divide-gray-100 text-sm">
                {f.contactos.map((c) => (
                  <li key={c.id} className="py-2">
                    <p className="font-semibold text-primary">
                      {c.nombre} · {c.correo}
                      {c.telefono ? ` · ${c.telefono}` : ''}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(c.created_at).toLocaleString('es-CO')} · desde {c.lugar ?? '—'}
                      {c.contexto ? ` · buscaba "${c.contexto}"` : ''}
                    </p>
                    {c.mensaje && <p className="mt-1 text-muted-foreground">{c.mensaje}</p>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

type Filtro = 'todos' | 'pendientes' | 'al_aire' | 'sin_pauta';

export default function AdminFabricantes() {
  const { user, loading, getAccessToken } = useAuth();
  const token = getAccessToken();
  const [lista, setLista] = useState<FabricanteAdmin[] | null>(null);
  const [hoy, setHoy] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<{ status: number; message: string } | null>(null);
  const [creando, setCreando] = useState(false);
  const [nuevo, setNuevo] = useState(false);
  const [filtro, setFiltro] = useState<Filtro>('todos');

  const cargar = useCallback(async () => {
    const r = await listarFabricantesAdmin(getAccessToken());
    if (r.ok) {
      setLista(r.data.fabricantes);
      setHoy(r.data.hoy);
      setError(null);
    } else setError({ status: r.status, message: r.message });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (user) void cargar();
  }, [user, cargar]);

  const crear = async (f: FabricanteEditable) => {
    setCreando(true);
    const r = await crearFabricante(token, f);
    setCreando(false);
    if (!r.ok) return setError({ status: r.status, message: r.message });
    setNuevo(false);
    void cargar();
  };

  const todos = lista ?? [];
  const alAire = todos.filter((f) => f.vigente);
  const pendientes = todos.filter((f) => f.estado === 'pendiente');
  const ingresoMensual = alAire.reduce((s, f) => s + (f.precio_mensual_usd ?? 0), 0);
  const contactos30 = todos.reduce((s, f) => s + f.metricas.contactos30, 0);
  const visibles =
    filtro === 'pendientes' ? pendientes : filtro === 'al_aire' ? alAire : filtro === 'sin_pauta' ? todos.filter((f) => f.estado === 'aprobado' && !f.vigente) : todos;

  let cuerpo: React.ReactNode;
  if (loading) cuerpo = <Loader2 className="mx-auto mt-24 animate-spin text-accent" size={28} />;
  else if (!user)
    cuerpo = (
      <p className="mt-16 text-center text-muted-foreground">
        Entra con tu cuenta maestra.{' '}
        <Link href="/login" className="font-semibold text-accent hover:underline">
          Ingresar
        </Link>
      </p>
    );
  else if (error?.status === 403) cuerpo = <p className="mt-16 text-center text-muted-foreground">Esta página es sólo para las cuentas maestras.</p>;
  else
    cuerpo = (
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <div className="rounded-2xl bg-gradient-to-br from-primary to-indigo-950 p-5 text-white">
            <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-200">Pauta al aire</p>
            <p className="mt-2 text-3xl font-black tabular-nums">{usd(ingresoMensual)}<span className="text-base font-bold text-indigo-200">/mes</span></p>
            <p className="mt-1 text-sm text-indigo-200">
              {alAire.length} fabricante(s) al aire · {contactos30} contacto(s) en 30 días
            </p>
          </div>
          {pendientes.length > 0 && (
            <button type="button" onClick={() => setFiltro('pendientes')} className="tap-scale-sm w-full rounded-2xl border-2 border-blue-200 bg-blue-50 p-4 text-left text-sm font-semibold text-blue-900">
              {pendientes.length} solicitud(es) para aparecer esperando revisión →
            </button>
          )}
          <Link href="/fabricantes" className="tap-scale-sm flex items-center gap-2 rounded-2xl border border-gray-100 bg-white p-4 text-sm font-semibold text-primary app-shadow">
            <Eye size={16} /> Ver el directorio público
          </Link>
        </aside>

        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ['todos', `Todos (${todos.length})`],
                  ['al_aire', `Al aire (${alAire.length})`],
                  ['pendientes', `Solicitudes (${pendientes.length})`],
                  ['sin_pauta', 'Sin pauta o vencidos'],
                ] as Array<[Filtro, string]>
              ).map(([id, texto]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFiltro(id)}
                  className={`tap-scale-sm rounded-full px-3.5 py-1.5 text-xs font-bold ${filtro === id ? 'bg-primary text-white' : 'border border-gray-200 bg-white text-muted-foreground'}`}
                >
                  {texto}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setNuevo((v) => !v)} className="tap-scale-sm inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-bold text-white">
              <Plus size={15} /> Nuevo fabricante
            </button>
          </div>

          {nuevo && (
            <div className="rounded-2xl border-2 border-accent/30 bg-white p-5">
              <p className="mb-4 font-bold text-primary">Nuevo fabricante</p>
              <Formulario inicial={{ ...VACIO, pauta_hasta: extenderUnMes(null, hoy) }} onGuardar={(f) => void crear(f)} ocupado={creando} textoBoton="Crear" />
            </div>
          )}

          {error && error.status !== 403 && <p role="alert" className="text-sm font-semibold text-red-600">{error.message}</p>}
          {lista === null && !error && <Loader2 className="mx-auto mt-10 animate-spin text-accent" size={24} />}
          {lista && visibles.length === 0 && (
            <p className="rounded-2xl border border-dashed border-gray-200 p-6 text-center text-sm text-muted-foreground">No hay fabricantes en esta vista.</p>
          )}
          {visibles.map((f) => (
            <Fila key={f.id} f={f} hoy={hoy} token={token} onCambio={() => void cargar()} />
          ))}
        </section>
      </div>
    );

  return (
    <div className="min-h-screen bg-white pb-24 md:pb-0">
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between gap-3 md:h-20">
          <Link href="/dashboard" className="tap-scale-sm flex items-center gap-2 py-2 font-logo text-xl tracking-tight md:text-2xl">
            <ArrowLeft size={18} className="text-muted-foreground" />
            <span><span className="text-accent">easy</span><span className="text-primary">comex</span></span>
          </Link>
          <span className="rounded-full border border-gray-200 bg-secondary/60 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary">Fabricantes · Admin</span>
        </div>
      </header>
      <main className="container py-8">{cuerpo}</main>
    </div>
  );
}
