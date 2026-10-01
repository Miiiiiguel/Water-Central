import { useCallback, useEffect, useState } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, Check, Coins, Copy, KeyRound, Loader2, Pause, Play, Plus, Trash2, Wallet } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  borrarMovimiento,
  cambiarEstado,
  cargarMovimiento,
  crearRevendedor,
  darTokens,
  listarRevendedores,
  nuevoSerial,
  usd,
  type RevendedorAdmin,
} from '@/lib/revendedores';

// Administración de revendedores, sólo para las cuentas maestras (el
// servidor lo exige; esta página sólo lo refleja). Acá se crean, se les
// entrega el número de serie, se cargan a mano sus comisiones y los pagos
// que se les hacen, y se les regalan tokens.

const inputCls =
  'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-primary outline-none transition-all placeholder:font-normal placeholder:text-gray-400 focus:border-accent focus:ring-2 focus:ring-accent/20';
const hoy = () => new Date().toISOString().slice(0, 10);

function SerialNuevo({ serial, onCerrar }: { serial: string; onCerrar: () => void }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="rounded-2xl border-2 border-accent bg-orange-50 p-5">
      <p className="text-sm font-bold text-primary">Número de serie (cópialo ahora: no se vuelve a mostrar)</p>
      <p className="mt-2 select-all break-all font-mono text-xl font-black tracking-wider text-primary">{serial}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(serial).then(() => setCopiado(true));
          }}
          className="tap-scale-sm inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-bold text-white"
        >
          {copiado ? <Check size={15} /> : <Copy size={15} />}
          {copiado ? 'Copiado' : 'Copiar'}
        </button>
        <button type="button" onClick={onCerrar} className="tap-scale-sm rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-primary">
          Ya lo guardé
        </button>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">El revendedor entra en /revendedores con este número. Si lo pierde, genera uno nuevo.</p>
    </div>
  );
}

function FilaRevendedor({ r, token, onCambio, onSerial }: { r: RevendedorAdmin; token: string | null; onCambio: () => void; onSerial: (s: string) => void }) {
  const [abierta, setAbierta] = useState(false);
  const [tipo, setTipo] = useState<'comision' | 'pago'>('comision');
  const [monto, setMonto] = useState('');
  const [cliente, setCliente] = useState('');
  const [nota, setNota] = useState('');
  const [fecha, setFecha] = useState(hoy());
  const [tokens, setTokens] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const correr = async (fn: () => Promise<{ ok: boolean; message?: string }>) => {
    setOcupado(true);
    setError(null);
    const res = await fn();
    setOcupado(false);
    if (!res.ok) setError(res.message ?? 'No se pudo.');
    else onCambio();
    return res.ok;
  };

  const guardarMovimiento = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseFloat(monto.replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0) return setError('Escribe un monto mayor que cero.');
    const ok = await correr(async () => {
      const x = await cargarMovimiento(token, r.id, { tipo, monto: n, cliente, nota, fecha });
      return x.ok ? { ok: true } : { ok: false, message: x.message };
    });
    if (ok) {
      setMonto('');
      setCliente('');
      setNota('');
    }
  };

  return (
    <div className="rounded-2xl border border-gray-100 bg-white app-shadow">
      <button type="button" onClick={() => setAbierta((v) => !v)} className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left">
        <div className="min-w-0">
          <p className="font-bold text-primary">
            {r.nombre}
            {!r.activo && <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">Pausado</span>}
          </p>
          <p className="text-xs text-muted-foreground">
            {r.empresa ? `${r.empresa} · ` : ''}Serial …{r.serial_pista} · {r.tokens} tokens
          </p>
        </div>
        <div className="text-right">
          <p className="font-black tabular-nums text-primary">{usd(r.billetera.saldo)}</p>
          <p className="text-[11px] text-muted-foreground">por pagarle</p>
        </div>
      </button>

      {abierta && (
        <div className="space-y-5 border-t border-gray-100 p-4">
          {r.contacto && <p className="text-sm text-muted-foreground">Contacto: {r.contacto}</p>}

          <form onSubmit={guardarMovimiento} className="space-y-2">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              <Wallet size={13} /> Cargar en la billetera
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <select value={tipo} onChange={(e) => setTipo(e.target.value as 'comision' | 'pago')} className={inputCls} aria-label="Tipo">
                <option value="comision">Comisión (+)</option>
                <option value="pago">Pago hecho (−)</option>
              </select>
              <input value={monto} onChange={(e) => setMonto(e.target.value)} inputMode="decimal" placeholder="Monto USD" aria-label="Monto en USD" className={inputCls} />
              <input value={fecha} onChange={(e) => setFecha(e.target.value)} type="date" aria-label="Fecha" className={inputCls} />
              <input
                value={cliente}
                onChange={(e) => setCliente(e.target.value)}
                placeholder={tipo === 'comision' ? 'Cliente que exportó' : 'Medio de pago'}
                aria-label="Cliente"
                className={inputCls}
              />
            </div>
            <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nota (opcional)" aria-label="Nota" className={inputCls} />
            <button type="submit" disabled={ocupado} className="tap-scale-sm inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
              <Plus size={15} /> Guardar movimiento
            </button>
          </form>

          {r.movimientos.length > 0 && (
            <ul className="divide-y divide-gray-100 text-sm">
              {r.movimientos.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{m.tipo === 'comision' ? m.cliente || 'Comisión' : `Pago${m.cliente ? ` · ${m.cliente}` : ''}`}</p>
                    <p className="text-xs text-muted-foreground">
                      {m.fecha}
                      {m.nota ? ` · ${m.nota}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`font-bold tabular-nums ${m.tipo === 'comision' ? 'text-green-700' : 'text-muted-foreground'}`}>
                      {m.tipo === 'comision' ? '+' : '−'}
                      {usd(m.monto_usd)}
                    </span>
                    <button
                      type="button"
                      aria-label="Borrar movimiento"
                      disabled={ocupado}
                      onClick={() => {
                        if (window.confirm('¿Borrar este movimiento?'))
                          void correr(async () => {
                            const x = await borrarMovimiento(token, r.id, m.id);
                            return x.ok ? { ok: true } : { ok: false, message: x.message };
                          });
                      }}
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-end gap-2 border-t border-gray-100 pt-4">
            <label className="block">
              <span className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <Coins size={13} /> Regalar tokens
              </span>
              <input value={tokens} onChange={(e) => setTokens(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="Cantidad" className={`${inputCls} w-32`} />
            </label>
            <button
              type="button"
              disabled={ocupado || !tokens}
              onClick={() =>
                void correr(async () => {
                  const x = await darTokens(token, r.id, parseInt(tokens, 10));
                  if (x.ok) setTokens('');
                  return x.ok ? { ok: true } : { ok: false, message: x.message };
                })
              }
              className="tap-scale-sm rounded-full border border-gray-200 px-4 py-2.5 text-sm font-semibold text-primary disabled:opacity-50"
            >
              Dar tokens
            </button>
            <span className="flex-1" />
            <button
              type="button"
              disabled={ocupado}
              onClick={() => {
                if (!window.confirm('El serial actual deja de servir. ¿Generar uno nuevo?')) return;
                void (async () => {
                  setOcupado(true);
                  const x = await nuevoSerial(token, r.id);
                  setOcupado(false);
                  if (x.ok) onSerial(x.data.serial);
                  else setError(x.message);
                })();
              }}
              className="tap-scale-sm inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-4 py-2.5 text-sm font-semibold text-primary"
            >
              <KeyRound size={15} /> Nuevo serial
            </button>
            <button
              type="button"
              disabled={ocupado}
              onClick={() =>
                void correr(async () => {
                  const x = await cambiarEstado(token, r.id, !r.activo);
                  return x.ok ? { ok: true } : { ok: false, message: x.message };
                })
              }
              className="tap-scale-sm inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-4 py-2.5 text-sm font-semibold text-primary"
            >
              {r.activo ? <Pause size={15} /> : <Play size={15} />}
              {r.activo ? 'Pausar' : 'Reactivar'}
            </button>
          </div>
          {error && <p role="alert" className="text-sm font-semibold text-red-600">{error}</p>}
        </div>
      )}
    </div>
  );
}

export default function AdminRevendedores() {
  const { user, loading, getAccessToken } = useAuth();
  const token = getAccessToken();
  const [lista, setLista] = useState<RevendedorAdmin[] | null>(null);
  const [error, setError] = useState<{ status: number; message: string } | null>(null);
  const [serial, setSerial] = useState<string | null>(null);
  const [nombre, setNombre] = useState('');
  const [empresa, setEmpresa] = useState('');
  const [contacto, setContacto] = useState('');
  const [tokensIniciales, setTokensIniciales] = useState('20');
  const [creando, setCreando] = useState(false);

  const cargar = useCallback(async () => {
    const r = await listarRevendedores(getAccessToken());
    if (r.ok) {
      setLista(r.data.revendedores);
      setError(null);
    } else setError({ status: r.status, message: r.message });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (user) void cargar();
  }, [user, cargar]);

  const crear = async (e: React.FormEvent) => {
    e.preventDefault();
    if (nombre.trim().length < 2) return;
    setCreando(true);
    const r = await crearRevendedor(token, { nombre, empresa, contacto, tokens: parseInt(tokensIniciales || '0', 10) || 0 });
    setCreando(false);
    if (!r.ok) return setError({ status: r.status, message: r.message });
    setSerial(r.data.serial);
    setNombre('');
    setEmpresa('');
    setContacto('');
    void cargar();
  };

  const totalPorPagar = (lista ?? []).reduce((s, r) => s + r.billetera.saldo, 0);

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
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <div className="rounded-2xl bg-gradient-to-br from-primary to-indigo-950 p-5 text-white">
            <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-200">Total por pagar a revendedores</p>
            <p className="mt-2 text-3xl font-black tabular-nums">{usd(totalPorPagar)}</p>
            <p className="mt-1 text-sm text-indigo-200">{lista?.length ?? 0} revendedores</p>
          </div>
          {serial && <SerialNuevo serial={serial} onCerrar={() => setSerial(null)} />}
          <form onSubmit={crear} className="space-y-3 rounded-2xl border border-gray-100 bg-white p-5 app-shadow">
            <p className="font-bold text-primary">Nuevo revendedor</p>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" aria-label="Nombre" className={inputCls} required />
            <input value={empresa} onChange={(e) => setEmpresa(e.target.value)} placeholder="Empresa (opcional)" aria-label="Empresa" className={inputCls} />
            <input value={contacto} onChange={(e) => setContacto(e.target.value)} placeholder="Teléfono o correo (opcional)" aria-label="Contacto" className={inputCls} />
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-muted-foreground">Tokens de regalo para consultar</span>
              <input value={tokensIniciales} onChange={(e) => setTokensIniciales(e.target.value.replace(/\D/g, ''))} inputMode="numeric" className={inputCls} />
            </label>
            <button
              type="submit"
              disabled={creando || nombre.trim().length < 2}
              className="tap-scale inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-5 py-3 font-bold text-white disabled:opacity-50"
            >
              {creando ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              Crear y generar serial
            </button>
          </form>
        </aside>

        <section className="space-y-3">
          {error && <p role="alert" className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700">{error.message}</p>}
          {lista === null && !error && <Loader2 className="mx-auto mt-10 animate-spin text-accent" size={24} />}
          {lista?.length === 0 && <p className="text-muted-foreground">Todavía no hay revendedores. Crea el primero a la izquierda.</p>}
          {lista?.map((r) => (
            <FilaRevendedor key={r.id} r={r} token={token} onCambio={() => void cargar()} onSerial={setSerial} />
          ))}
        </section>
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50/60 pb-24 md:pb-0">
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between gap-3 md:h-20">
          <Link href="/dashboard" className="tap-scale-sm flex items-center gap-2 py-2 font-logo text-xl tracking-tight md:text-2xl">
            <ArrowLeft size={18} className="text-muted-foreground" />
            <span><span className="text-accent">easy</span><span className="text-primary">comex</span></span>
          </Link>
          <span className="rounded-full border border-gray-200 bg-secondary/60 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary">
            Revendedores · admin
          </span>
        </div>
      </header>
      <div className="container py-8 md:py-12">
        <h1 className="mb-6 text-3xl font-black text-primary">Revendedores</h1>
        {cuerpo}
      </div>
    </div>
  );
}
