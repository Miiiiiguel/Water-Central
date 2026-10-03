import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, CalendarCheck, CreditCard, Eye, Loader2, Mail, MessageCircle, MousePointerClick, Search } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { TarjetaFabricante } from '@/components/FabricantesPatrocinados';
import { leerPortal, pagarPauta, type PortalFabricante } from '@/lib/fabricantes';

// /fabricante: el portal de cada fabricante patrocinado. Entra con su
// cuenta de Easycomex (el correo que registró el equipo) y ve su pauta,
// cuántas veces lo vieron y lo contactaron, dónde y buscando qué, los
// contactos con su mensaje, y paga la pauta en línea. Es lo que lo
// convence de renovar: por eso los números van primero.

const fecha = (iso: string, es: boolean) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString(es ? 'es-CO' : 'en-US', { day: 'numeric', month: 'short' });

const wa = (tel: string | null) => {
  const d = (tel ?? '').replace(/\D/g, '');
  return d.length >= 8 ? `https://wa.me/${d}` : null;
};

function Kpi({ icono: Icono, valor, titulo, nota }: { icono: typeof Eye; valor: string; titulo: string; nota?: string }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 app-shadow">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <Icono size={14} /> {titulo}
      </p>
      <p className="mt-1 text-3xl font-black tabular-nums text-primary">{valor}</p>
      {nota && <p className="text-xs text-muted-foreground">{nota}</p>}
    </div>
  );
}

/** Vistas por día, 30 días. Una serie: el título la nombra; el tooltip suma los contactos. */
function GraficaDiaria({ serie, es }: { serie: PortalFabricante['serie']; es: boolean }) {
  const max = Math.max(1, ...serie.map((d) => d.vistas));
  return (
    <figure className="rounded-2xl border border-gray-100 bg-white p-4 app-shadow md:p-5">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-bold text-primary">{es ? 'Vistas por día · últimos 30 días' : 'Views per day · last 30 days'}</span>
        <span className="text-xs text-muted-foreground">{es ? `máximo ${max} en un día` : `peak ${max} in a day`}</span>
      </figcaption>
      <div className="relative mt-4 flex h-40 items-end gap-[2px] border-b border-gray-200" role="img" aria-label={es ? 'Gráfica de vistas por día' : 'Views per day chart'}>
        {serie.map((d) => (
          <div key={d.dia} className="group relative flex h-full flex-1 items-end">
            <div
              className="w-full rounded-t-[4px] bg-accent/85 transition-colors group-hover:bg-accent"
              style={{ height: d.vistas ? `${Math.max(3, (d.vistas / max) * 100)}%` : '0%' }}
            />
            {d.contactos > 0 && <span className="absolute -top-2 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-primary ring-2 ring-white" style={{ bottom: `${(d.vistas / max) * 100}%`, top: 'auto' }} />}
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-primary px-2.5 py-1.5 text-xs text-white shadow-lg group-hover:block">
              <b>{fecha(d.dia, es)}</b> · {d.vistas} {es ? 'vistas' : 'views'} · {d.contactos} {es ? 'contactos' : 'contacts'}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
        <span>{fecha(serie[0]?.dia ?? '', es)}</span>
        <span>{fecha(serie[serie.length - 1]?.dia ?? '', es)}</span>
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="inline-block h-2 w-2 rounded-full bg-primary" /> {es ? 'día con contactos' : 'day with contacts'}
      </p>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">{es ? 'Ver como tabla' : 'View as table'}</summary>
        <table className="mt-2 w-full text-left text-xs">
          <thead>
            <tr className="text-muted-foreground">
              <th className="py-1 font-semibold">{es ? 'Día' : 'Day'}</th>
              <th className="py-1 text-right font-semibold">{es ? 'Vistas' : 'Views'}</th>
              <th className="py-1 text-right font-semibold">{es ? 'Contactos' : 'Contacts'}</th>
            </tr>
          </thead>
          <tbody>
            {serie.map((d) => (
              <tr key={d.dia} className="border-t border-gray-100">
                <td className="py-1">{fecha(d.dia, es)}</td>
                <td className="py-1 text-right tabular-nums">{d.vistas}</td>
                <td className="py-1 text-right tabular-nums">{d.contactos}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

function Pago({ f, es }: { f: PortalFabricante; es: boolean }) {
  const { getAccessToken } = useAuth();
  const [meses, setMeses] = useState(1);
  const [abriendo, setAbriendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const elegido = f.precios.find((p) => p.meses === meses);

  if (!f.pagoEnLinea)
    return (
      <p className="text-sm text-muted-foreground">
        {f.perfil.precio_mensual_usd
          ? es ? 'El pago en línea no está disponible ahora. Escríbenos y te mandamos el enlace de pago.' : 'Online payment is not available right now. Write to us and we will send you a payment link.'
          : es ? 'Tu plan todavía no tiene precio. Escríbenos y lo activamos.' : 'Your plan has no price yet. Write to us and we will set it up.'}
      </p>
    );

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {f.precios.map((p) => (
          <button
            key={p.meses}
            type="button"
            aria-pressed={meses === p.meses}
            onClick={() => setMeses(p.meses)}
            className={`tap-scale-sm rounded-xl border-[1.5px] px-3 py-2.5 text-left ${meses === p.meses ? 'border-primary bg-primary text-white' : 'border-gray-200 bg-white text-primary hover:border-gray-300'}`}
          >
            <span className="block text-sm font-bold">{p.meses} {p.meses === 1 ? (es ? 'mes' : 'month') : es ? 'meses' : 'months'}</span>
            <span className={`block text-xs ${meses === p.meses ? 'text-indigo-200' : 'text-muted-foreground'}`}>{p.cop}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        disabled={abriendo || !elegido?.cop}
        onClick={async () => {
          setAbriendo(true);
          setError(null);
          const r = await pagarPauta(getAccessToken(), f.perfil.id, meses);
          setAbriendo(false);
          if (!r.ok) setError(r.message);
        }}
        className="tap-scale-sm mt-3 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 font-bold text-white disabled:opacity-60"
      >
        {abriendo ? <Loader2 size={16} className="animate-spin" /> : <CreditCard size={16} />}
        {es ? `Pagar ${elegido?.cop ?? ''}` : `Pay ${elegido?.cop ?? ''}`}
      </button>
      <p className="mt-2 text-xs text-muted-foreground">
        {es
          ? 'Pagas con tarjeta, PSE o Nequi. Tu pauta se extiende sola apenas se confirma el pago, desde hoy o desde que vence.'
          : 'Pay by card, PSE or Nequi. Your listing extends on its own as soon as the payment clears, from today or from when it ends.'}
      </p>
      {error && <p role="alert" className="mt-2 text-sm font-semibold text-red-600">{error}</p>}
    </div>
  );
}

export function Panel({ f, es }: { f: PortalFabricante; es: boolean }) {
  const p = f.perfil;
  const tasa = f.metricas.impresiones30 ? (f.metricas.contactos30 / f.metricas.impresiones30) * 100 : 0;
  const [cls, estado] =
    p.estado === 'pendiente'
      ? ['bg-blue-50 text-blue-900 border-blue-200', es ? 'Tu solicitud está en revisión. Te escribimos con los planes.' : 'Your request is under review. We will write to you with the plans.']
      : p.vigente
        ? ['bg-green-50 text-green-900 border-green-200', es ? `Al aire hasta el ${fecha(p.pauta_hasta!, es)}.` : `Live until ${fecha(p.pauta_hasta!, es)}.`]
        : ['bg-amber-50 text-amber-900 border-amber-200', p.pauta_hasta
          ? es ? `Tu pauta venció el ${fecha(p.pauta_hasta, es)}: ya no sales en las búsquedas.` : `Your listing ended on ${fecha(p.pauta_hasta, es)}: you no longer show up in searches.`
          : es ? 'Tu pauta no está activa: no sales en las búsquedas.' : 'Your listing is not active: you do not show up in searches.'];
  const lugares = [
    { k: 'chat' as const, t: es ? 'Asistente Marco Polo' : 'Marco Polo assistant' },
    { k: 'roi' as const, t: es ? 'Calculadora de rentabilidad' : 'ROI calculator' },
    { k: 'directorio' as const, t: es ? 'Directorio de fabricantes' : 'Manufacturer directory' },
  ];
  const totalLugares = Math.max(1, lugares.reduce((n, l) => n + f.lugares[l.k], 0));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-primary md:text-3xl">{p.nombre}</h1>
          {p.plan && <p className="text-sm text-muted-foreground">{p.plan}</p>}
        </div>
      </div>

      <p className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold ${cls}`}>
        <CalendarCheck size={17} className="flex-none" /> {estado}
      </p>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icono={Eye} valor={f.metricas.impresiones30.toLocaleString(es ? 'es-CO' : 'en-US')} titulo={es ? 'Vistas · 30 días' : 'Views · 30 days'} />
        <Kpi icono={MousePointerClick} valor={String(f.metricas.contactos30)} titulo={es ? 'Contactos · 30 días' : 'Contacts · 30 days'} />
        <Kpi icono={Search} valor={`${tasa.toFixed(tasa && tasa < 10 ? 1 : 0)} %`} titulo={es ? 'Te contactan' : 'Contact rate'} nota={es ? 'de cada 100 que te ven' : 'per 100 views'} />
        <Kpi icono={Mail} valor={String(f.metricas.contactos)} titulo={es ? 'Contactos en total' : 'Total contacts'} />
      </div>

      <GraficaDiaria serie={f.serie} es={es} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-gray-100 bg-white p-4 app-shadow md:p-5">
          <h2 className="text-lg font-bold text-primary">{es ? 'Dónde te vieron' : 'Where they saw you'}</h2>
          <ul className="mt-3 space-y-2.5">
            {lugares.map((l) => (
              <li key={l.k}>
                <div className="flex justify-between text-sm">
                  <span>{l.t}</span>
                  <span className="font-bold tabular-nums">{f.lugares[l.k]}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-gray-100">
                  <div className="h-1.5 rounded-full bg-primary" style={{ width: `${(f.lugares[l.k] / totalLugares) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-2xl border border-gray-100 bg-white p-4 app-shadow md:p-5">
          <h2 className="text-lg font-bold text-primary">{es ? 'Qué buscaban' : 'What they searched for'}</h2>
          {f.busquedas.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">{es ? 'Todavía no hay búsquedas.' : 'No searches yet.'}</p>
          ) : (
            <ol className="mt-3 space-y-1.5 text-sm">
              {f.busquedas.map((b) => (
                <li key={b.texto} className="flex justify-between gap-3">
                  <span className="truncate">{b.texto}</span>
                  <span className="font-bold tabular-nums">{b.veces}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>

      <section className="rounded-2xl border border-gray-100 bg-white p-4 app-shadow md:p-5">
        <h2 className="text-lg font-bold text-primary">{es ? 'Tus contactos' : 'Your contacts'}</h2>
        {f.contactos.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">{es ? 'Todavía nadie te ha escrito. Cuando alguien lo haga, te llega también al correo.' : 'Nobody has written yet. When someone does, it also reaches your inbox.'}</p>
        ) : (
          <ul className="mt-3 divide-y divide-gray-100">
            {f.contactos.map((c) => (
              <li key={c.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-primary">{c.nombre}</p>
                  <p className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString(es ? 'es-CO' : 'en-US')}</p>
                </div>
                {c.contexto && <p className="text-xs text-muted-foreground">{es ? 'Buscaba' : 'Looking for'}: {c.contexto}</p>}
                {c.mensaje && <p className="mt-1 text-sm text-muted-foreground">{c.mensaje}</p>}
                <div className="mt-2 flex flex-wrap gap-2">
                  {c.correo && (
                    <a href={`mailto:${c.correo}`} className="tap-scale-sm inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-primary">
                      <Mail size={13} /> {c.correo}
                    </a>
                  )}
                  {wa(c.telefono) && (
                    <a href={wa(c.telefono)!} target="_blank" rel="noopener noreferrer" className="tap-scale-sm inline-flex items-center gap-1.5 rounded-full bg-green-600 px-3 py-1.5 text-xs font-bold text-white">
                      <MessageCircle size={13} /> WhatsApp
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-gray-100 bg-white p-4 app-shadow md:p-5">
          <h2 className="text-lg font-bold text-primary">{p.vigente ? (es ? 'Renueva tu pauta' : 'Renew your listing') : es ? 'Activa tu pauta' : 'Turn on your listing'}</h2>
          <div className="mt-3">
            <Pago f={f} es={es} />
          </div>
          {f.pagos.length > 0 && (
            <ul className="mt-4 divide-y divide-gray-100 border-t border-gray-100 text-sm">
              {f.pagos.map((pg) => (
                <li key={pg.created_at} className="flex justify-between gap-3 py-2">
                  <span>
                    {new Date(pg.created_at).toLocaleDateString(es ? 'es-CO' : 'en-US')} · {pg.meses} {pg.meses === 1 ? (es ? 'mes' : 'month') : es ? 'meses' : 'months'}
                    {pg.pauta_hasta_nueva ? ` · ${es ? 'hasta' : 'until'} ${fecha(pg.pauta_hasta_nueva, es)}` : ''}
                  </span>
                  <span className={`font-semibold ${pg.estado === 'paid' ? 'text-green-700' : 'text-muted-foreground'}`}>
                    {pg.monto} · {pg.estado === 'paid' ? (es ? 'pagado' : 'paid') : pg.estado === 'failed' ? (es ? 'rechazado' : 'declined') : es ? 'pendiente' : 'pending'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="rounded-2xl border border-gray-100 bg-secondary/40 p-4 md:p-5">
          <h2 className="text-lg font-bold text-primary">{es ? 'Así te ven los clientes' : 'How clients see you'}</h2>
          <p className="mb-3 mt-1 text-xs text-muted-foreground">{es ? 'Para cambiar tu descripción, escríbenos.' : 'To change your description, write to us.'}</p>
          <TarjetaFabricante f={p} es={es} contexto="" lugar="directorio" vistaPrevia />
        </section>
      </div>
    </div>
  );
}

export default function PortalFabricante() {
  const { language } = useLanguage();
  const es = language === 'es';
  const { user, loading, getAccessToken } = useAuth();
  const [datos, setDatos] = useState<PortalFabricante[] | null>(null);
  const [error, setError] = useState<{ status: number; message: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    void leerPortal(getAccessToken()).then((r) => {
      if (r.ok) setDatos(r.data.fabricantes);
      else setError({ status: r.status, message: r.message });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  let cuerpo: React.ReactNode;
  if (loading || (user && !datos && !error)) cuerpo = <Loader2 className="mx-auto mt-24 animate-spin text-accent" size={28} />;
  else if (!user)
    cuerpo = (
      <div className="mx-auto mt-16 max-w-md text-center">
        <h1 className="text-2xl font-black text-primary">{es ? 'Portal de fabricantes' : 'Manufacturer portal'}</h1>
        <p className="mt-2 text-muted-foreground">
          {es ? 'Entra con el correo que registraste como fabricante para ver tus vistas, tus contactos y pagar tu pauta.' : 'Sign in with the email you registered as a manufacturer to see your views and contacts and pay your listing.'}
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Link href="/login" className="tap-scale-sm rounded-full bg-primary px-5 py-2.5 font-bold text-white">{es ? 'Entrar' : 'Sign in'}</Link>
          <Link href="/registro" className="tap-scale-sm rounded-full border border-gray-200 px-5 py-2.5 font-semibold text-primary">{es ? 'Crear cuenta' : 'Create account'}</Link>
        </div>
      </div>
    );
  else if (error)
    cuerpo = (
      <div className="mx-auto mt-16 max-w-md text-center">
        <p className="text-muted-foreground">{error.message}</p>
        {error.status === 404 && (
          <Link href="/fabricantes#aparecer" className="mt-4 inline-block font-semibold text-accent hover:underline">
            {es ? '¿Eres fabricante? Pide aparecer →' : 'Are you a manufacturer? Get listed →'}
          </Link>
        )}
      </div>
    );
  else cuerpo = <div className="space-y-14">{datos!.map((f) => <Panel key={f.perfil.id} f={f} es={es} />)}</div>;

  return (
    <div className="min-h-screen bg-white pb-24 md:pb-0">
      <header className="sticky top-0 z-40 border-b border-gray-100 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between gap-3 md:h-20">
          <Link href="/dashboard" className="tap-scale-sm flex items-center gap-2 py-2 font-logo text-xl tracking-tight md:text-2xl">
            <ArrowLeft size={18} className="text-muted-foreground" />
            <span><span className="text-accent">easy</span><span className="text-primary">comex</span></span>
          </Link>
          <span className="rounded-full border border-gray-200 bg-secondary/60 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-primary">
            {es ? 'Portal de fabricante' : 'Manufacturer portal'}
          </span>
        </div>
      </header>
      <main className="container max-w-5xl py-8">{cuerpo}</main>
    </div>
  );
}
