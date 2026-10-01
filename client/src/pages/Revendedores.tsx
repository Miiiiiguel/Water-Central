import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, Check, Coins, Copy, KeyRound, Loader2, LogOut, Sparkles, Users, Wallet } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { fetchCatalog, type CatalogItem } from '@/lib/checkout';
import { PORTAFOLIO, enlaceReferido, entrarConSerial, leerPortal, usd, type ItemPortafolio, type Portal } from '@/lib/revendedores';

// El portal del revendedor. Sin sesión, pide el número de serie. Con
// sesión de revendedor: a la izquierda el portafolio de planes de
// Easycomex con el enlace de cada uno ya marcado con su código, y a la
// derecha la billetera (lo que se le debe por comisiones) y sus tokens.

const inputCls =
  'w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base font-semibold tracking-wider text-primary outline-none transition-all placeholder:font-normal placeholder:tracking-normal placeholder:text-gray-400 focus:border-accent focus:ring-2 focus:ring-accent/20';

function Cabecera({ es, onSalir }: { es: boolean; onSalir?: () => void }) {
  return (
    <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div className="container flex h-16 items-center justify-between gap-3 md:h-20">
        <Link href="/" className="tap-scale-sm flex items-center gap-2 py-2 font-logo text-xl tracking-tight md:text-2xl">
          <ArrowLeft size={18} className="text-muted-foreground" />
          <span><span className="text-accent">easy</span><span className="text-primary">comex</span></span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="hidden rounded-full border border-gray-200 bg-secondary/60 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary sm:block">
            {es ? 'Revendedores' : 'Resellers'}
          </span>
          {onSalir && (
            <button
              type="button"
              onClick={onSalir}
              className="tap-scale-sm inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3.5 py-2 text-sm font-semibold text-primary hover:bg-secondary/60"
            >
              <LogOut size={15} />
              {es ? 'Salir' : 'Sign out'}
            </button>
          )}
        </div>
      </div>
    </header>
  );
}

function EntradaConSerial({ es }: { es: boolean }) {
  const [serial, setSerial] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const entrar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (enviando || serial.trim().length < 8) return;
    setEnviando(true);
    setError(null);
    const r = await entrarConSerial(serial);
    if (!r.ok) {
      setEnviando(false);
      setError(r.message);
      return;
    }
    // Se recarga a propósito: quien llega sin sesión guardada no tiene a
    // AuthContext escuchando a Supabase (la librería se carga sólo cuando
    // hace falta). Con la sesión ya guardada, la recarga la restaura
    // como a cualquier otra.
    window.location.assign('/revendedores');
  };

  return (
    <div className="container flex min-h-[70vh] items-center justify-center py-12">
      <form onSubmit={entrar} className="w-full max-w-md rounded-3xl border border-gray-100 bg-white p-6 app-shadow md:p-8">
        <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500/10 text-accent">
          <KeyRound size={22} />
        </span>
        <h1 className="text-2xl font-black text-primary md:text-3xl">{es ? 'Entrada de revendedores' : 'Reseller sign-in'}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {es
            ? 'Escribe el número de serie que te dio Easycomex. Es personal: no lo compartas.'
            : 'Enter the serial number Easycomex gave you. It is personal: do not share it.'}
        </p>
        <label htmlFor="serial" className="mb-2 mt-6 block text-sm font-semibold text-foreground">
          {es ? 'Número de serie' : 'Serial number'}
        </label>
        <input
          id="serial"
          name="serial"
          value={serial}
          onChange={(e) => setSerial(e.target.value.toUpperCase())}
          placeholder="ECX-XXXX-XXXX-XXXX-XXXX"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className={inputCls}
        />
        {error && <p role="alert" className="mt-3 rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <button
          type="submit"
          disabled={enviando || serial.trim().length < 8}
          className="tap-scale mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3.5 font-bold text-white shadow-glow hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {enviando ? <Loader2 size={18} className="animate-spin" /> : <KeyRound size={18} />}
          {es ? 'Entrar' : 'Sign in'}
        </button>
        <p className="mt-5 text-center text-xs text-muted-foreground">
          {es ? '¿Perdiste tu número de serie? Escríbenos y te damos uno nuevo.' : 'Lost your serial? Write to us and we will issue a new one.'}
        </p>
      </form>
    </div>
  );
}

function TarjetaPlan({ item, precio, enlace, es }: { item: ItemPortafolio; precio: CatalogItem | undefined; enlace: string; es: boolean }) {
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(enlace);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1800);
    } catch {
      window.prompt(es ? 'Copia el enlace:' : 'Copy the link:', enlace);
    }
  };
  const principal = precio?.displayUsd ?? (item.respaldo === 'A medida' && !es ? 'Custom' : item.respaldo);
  return (
    <div className="flex flex-col rounded-2xl border border-gray-100 bg-white p-5 app-shadow">
      <div className="flex items-start justify-between gap-3">
        <p className="font-bold text-primary">{es ? item.nombre.es : item.nombre.en}</p>
        <p className="flex-none text-right font-black tabular-nums text-primary">
          {principal}
          {precio?.displayCop && <span className="block text-xs font-semibold text-muted-foreground">{precio.displayCop}</span>}
        </p>
      </div>
      <p className="mt-2 flex-1 text-sm text-muted-foreground">{es ? item.descripcion.es : item.descripcion.en}</p>
      <button
        type="button"
        onClick={() => void copiar()}
        className="tap-scale-sm mt-4 inline-flex items-center justify-center gap-2 rounded-full border border-gray-200 px-4 py-2 text-sm font-semibold text-primary hover:bg-secondary/60"
      >
        {copiado ? <Check size={15} className="text-green-600" /> : <Copy size={15} />}
        {copiado ? (es ? 'Enlace copiado' : 'Link copied') : es ? 'Copiar enlace para tu cliente' : 'Copy link for your client'}
      </button>
    </div>
  );
}

function PortalRevendedor({ es, portal }: { es: boolean; portal: Portal }) {
  const [catalogo, setCatalogo] = useState<CatalogItem[]>([]);
  useEffect(() => {
    let vivo = true;
    void fetchCatalog().then((items) => vivo && setCatalogo(items));
    return () => {
      vivo = false;
    };
  }, []);
  const precioDe = useMemo(() => new Map(catalogo.map((c) => [c.plan as string, c])), [catalogo]);
  const origen = typeof window !== 'undefined' ? window.location.origin : '';
  const codigo = portal.referido.codigo;
  const { billetera, movimientos } = portal;

  const grupo = (g: ItemPortafolio['grupo']) => PORTAFOLIO.filter((i) => i.grupo === g);

  return (
    <div className="container py-8 md:py-12">
      <div className="mb-8">
        <span className="mb-3 inline-flex items-center gap-2 rounded-full bg-orange-500/10 px-4 py-2 text-xs font-bold uppercase tracking-wider text-accent">
          <Sparkles size={13} />
          {es ? 'Portal de revendedor' : 'Reseller portal'}
        </span>
        <h1 className="text-3xl font-black text-primary md:text-4xl">
          {es ? `Hola, ${portal.revendedor.nombre}` : `Hi, ${portal.revendedor.nombre}`}
        </h1>
        {portal.revendedor.empresa && <p className="mt-1 text-muted-foreground">{portal.revendedor.empresa}</p>}
        {!portal.revendedor.activo && (
          <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {es ? 'Tu acceso está pausado. Escríbenos para reactivarlo.' : 'Your access is paused. Write to us to reactivate it.'}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Portafolio */}
        <section className="order-2 lg:order-1">
          <h2 className="text-xl font-black text-primary">{es ? 'Portafolio de planes' : 'Plan portfolio'}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {es
              ? 'Comparte el enlace de cada plan: lleva tu código, así el cliente queda registrado como tuyo.'
              : 'Share each plan’s link: it carries your code, so the client is registered as yours.'}
          </p>
          <h3 className="mb-3 mt-6 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{es ? 'Servicios' : 'Services'}</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {grupo('servicios').map((i) => (
              <TarjetaPlan key={i.plan} item={i} precio={precioDe.get(i.plan)} enlace={enlaceReferido(origen, i.ruta, codigo)} es={es} />
            ))}
          </div>
          <h3 className="mb-3 mt-8 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{es ? 'Tokens de consulta' : 'Lookup tokens'}</h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {grupo('tokens').map((i) => (
              <TarjetaPlan key={i.plan} item={i} precio={precioDe.get(i.plan)} enlace={enlaceReferido(origen, i.ruta, codigo)} es={es} />
            ))}
          </div>
        </section>

        {/* Billetera */}
        <aside className="order-1 space-y-4 lg:order-2 lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-3xl bg-gradient-to-br from-primary to-indigo-950 p-6 text-white shadow-glow-lg">
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-indigo-200">
              <Wallet size={14} />
              {es ? 'Tu billetera' : 'Your wallet'}
            </p>
            <p className="mt-3 text-4xl font-black tabular-nums">{usd(billetera.saldo)}</p>
            <p className="mt-1 text-sm text-indigo-200">{es ? 'Saldo por pagarte' : 'Balance owed to you'}</p>
            <dl className="mt-5 grid grid-cols-3 gap-2 border-t border-white/15 pt-4 text-sm">
              <div>
                <dt className="text-[11px] text-indigo-200">{es ? 'Comisiones' : 'Commissions'}</dt>
                <dd className="font-bold tabular-nums">{usd(billetera.comisiones)}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-indigo-200">{es ? 'Pagado' : 'Paid'}</dt>
                <dd className="font-bold tabular-nums">{usd(billetera.pagado)}</dd>
              </div>
              <div>
                <dt className="text-[11px] text-indigo-200">{es ? 'Clientes' : 'Clients'}</dt>
                <dd className="font-bold tabular-nums">{billetera.clientes}</dd>
              </div>
            </dl>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl border border-gray-100 bg-white p-4 app-shadow">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <Coins size={13} />
                Tokens
              </p>
              <p className="mt-1 text-2xl font-black tabular-nums text-primary">{portal.tokens}</p>
              <Link href="/analizar" className="text-xs font-semibold text-accent hover:underline">
                {es ? 'Usarlos →' : 'Use them →'}
              </Link>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-white p-4 app-shadow">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <Users size={13} />
                {es ? 'Registrados' : 'Signed up'}
              </p>
              <p className="mt-1 text-2xl font-black tabular-nums text-primary">{portal.referido.clientes}</p>
              <p className="text-xs text-muted-foreground">{es ? 'con tu enlace' : 'with your link'}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white p-5 app-shadow">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{es ? 'Movimientos' : 'Activity'}</p>
            {movimientos.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                {es
                  ? 'Todavía no hay comisiones. Cuando un cliente tuyo exporte con Easycomex, la verás aquí.'
                  : 'No commissions yet. When one of your clients exports with Easycomex, you will see it here.'}
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-gray-100">
                {movimientos.map((m) => (
                  <li key={m.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-foreground">
                        {m.tipo === 'comision' ? m.cliente || (es ? 'Comisión' : 'Commission') : es ? 'Pago recibido' : 'Payment received'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {m.fecha}
                        {m.nota ? ` · ${m.nota}` : ''}
                      </p>
                    </div>
                    <span className={`flex-none font-bold tabular-nums ${m.tipo === 'comision' ? 'text-green-700' : 'text-muted-foreground'}`}>
                      {m.tipo === 'comision' ? '+' : '−'}
                      {usd(m.monto_usd)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function Revendedores() {
  const { language } = useLanguage();
  const { user, loading, getAccessToken, signOut } = useAuth();
  const es = language === 'es';
  const [portal, setPortal] = useState<Portal | null>(null);
  const [estado, setEstado] = useState<'idle' | 'cargando' | 'no_es' | 'error'>('idle');
  const [mensaje, setMensaje] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setEstado('cargando');
    const r = await leerPortal(getAccessToken());
    if (r.ok) {
      setPortal(r.data);
      setEstado('idle');
    } else if (r.status === 404) setEstado('no_es');
    else {
      setMensaje(r.message);
      setEstado('error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  useEffect(() => {
    if (user) void cargar();
    else setPortal(null);
  }, [user, cargar]);

  const salir = async () => {
    await signOut();
    setPortal(null);
    setEstado('idle');
  };

  let cuerpo: React.ReactNode;
  if (loading || (user && estado === 'cargando' && !portal)) {
    cuerpo = (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="animate-spin text-accent" size={28} />
      </div>
    );
  } else if (!user) {
    cuerpo = <EntradaConSerial es={es} />;
  } else if (estado === 'no_es') {
    cuerpo = (
      <div className="container flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <p className="max-w-md text-muted-foreground">
          {es
            ? 'Estás con una cuenta que no es de revendedor. Sal y entra con tu número de serie.'
            : 'You are signed in with an account that is not a reseller. Sign out and enter your serial number.'}
        </p>
        <button type="button" onClick={() => void salir()} className="tap-scale rounded-full bg-accent px-6 py-3 font-bold text-white">
          {es ? 'Salir y entrar con serial' : 'Sign out and use a serial'}
        </button>
      </div>
    );
  } else if (estado === 'error' || !portal) {
    cuerpo = (
      <div className="container flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
        <p className="max-w-md text-muted-foreground">{mensaje ?? (es ? 'No pudimos cargar tu portal.' : 'We could not load your portal.')}</p>
        <button type="button" onClick={() => void cargar()} className="tap-scale rounded-full border border-gray-200 px-6 py-3 font-bold text-primary">
          {es ? 'Reintentar' : 'Retry'}
        </button>
      </div>
    );
  } else {
    cuerpo = <PortalRevendedor es={es} portal={portal} />;
  }

  return (
    <div className="min-h-screen bg-gray-50/60 pb-24 md:pb-0">
      <Cabecera es={es} onSalir={user ? () => void salir() : undefined} />
      {cuerpo}
    </div>
  );
}
