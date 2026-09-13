import { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import {
  LogOut, Package, FileText, CalendarClock, Users, TrendingUp,
  Inbox, ArrowRight, Loader2, Copy, Check, Gift, MapPin, Bell, BellOff, Download,
  BarChart3, Plug,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase, FreightQuote, Profile, ContactLead, Payment } from '@/lib/supabase';
import { buildReferralLink } from '@/lib/referral';
import { downloadCSV } from '@/lib/csv';
import { isPushConfigured, getPushStatus, subscribeToPush, unsubscribeFromPush, PushStatus } from '@/lib/push';
import NotificationBell from '@/components/NotificationBell';
import CountUp from '@/components/CountUp';
import { Skeleton } from '@/components/ui/skeleton';

function ListSkeleton({ rows = 3, avatar = true, trailing = 'badge' }: { rows?: number; avatar?: boolean; trailing?: 'badge' | 'date' | 'none' }) {
  return (
    <ul className="divide-y divide-gray-100">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="p-5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {avatar && <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />}
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-3.5 w-2/5" />
              <Skeleton className="h-3 w-3/5" />
            </div>
          </div>
          {trailing === 'badge' && <Skeleton className="h-6 w-16 rounded-full flex-shrink-0" />}
          {trailing === 'date' && <Skeleton className="h-3 w-14 flex-shrink-0" />}
        </li>
      ))}
    </ul>
  );
}

function PushToggle() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [status, setStatus] = useState<PushStatus>('unsupported');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isPushConfigured) return;
    getPushStatus().then(setStatus);
  }, []);

  if (!isPushConfigured || status === 'denied') return null;

  const handleToggle = async () => {
    if (!user || busy) return;
    setBusy(true);
    if (status === 'subscribed') {
      await unsubscribeFromPush();
      setStatus('unsubscribed');
    } else {
      const { error } = await subscribeToPush(user.id);
      setStatus(error ? 'denied' : 'subscribed');
    }
    setBusy(false);
  };

  const subscribed = status === 'subscribed';

  return (
    <button
      onClick={handleToggle}
      disabled={busy}
      title={
        subscribed
          ? (language === 'es' ? 'Desactivar notificaciones push' : 'Turn off push notifications')
          : (language === 'es' ? 'Activar notificaciones push' : 'Turn on push notifications')
      }
      className="tap-scale-sm p-2 rounded-full hover:bg-orange-50 transition-colors bg-transparent border-0 cursor-pointer disabled:opacity-50"
    >
      {subscribed ? <Bell size={20} className="text-accent" /> : <BellOff size={20} className="text-muted-foreground" />}
    </button>
  );
}

function TopBar() {
  const { profile, user, signOut } = useAuth();
  const { language } = useLanguage();
  const [, navigate] = useLocation();

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xl border-b border-gray-100">
      <div className="container flex items-center justify-between h-16 md:h-20">
        <Link href="/" className="font-logo text-xl md:text-2xl tracking-tight">
          <span className="text-accent">easy</span>
          <span className="text-primary">comex</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground text-xs font-bold uppercase tracking-wide">
            {profile?.role === 'vendedor'
              ? (language === 'es' ? 'Equipo Easycomex' : 'Easycomex team')
              : (language === 'es' ? 'Cliente' : 'Client')}
          </span>
          <span className="hidden md:inline text-sm text-muted-foreground">
            {profile?.full_name || user?.email}
          </span>
          <PushToggle />
          <NotificationBell />
          <button
            onClick={handleLogout}
            className="tap-scale-sm flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 hover:bg-gray-50 text-sm font-bold text-foreground transition-colors bg-transparent cursor-pointer"
          >
            <LogOut size={16} />
            {language === 'es' ? 'Salir' : 'Log out'}
          </button>
        </div>
      </div>
    </header>
  );
}

function StatCard({ icon: Icon, label, value, accent = false }: { icon: any; label: string; value: string | number; accent?: boolean }) {
  const isNumeric = typeof value === 'number';
  return (
    <div
      className={`relative overflow-hidden rounded-3xl p-6 app-shadow transition-all duration-300 hover:-translate-y-1 ${
        accent
          ? 'bg-gradient-to-br from-primary via-indigo-950 to-primary'
          : 'bg-white border border-gray-100'
      }`}
    >
      {accent && <div className="absolute -top-10 -right-10 w-40 h-40 bg-accent/25 rounded-full blur-3xl pointer-events-none" />}
      <div
        className={`relative w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${
          accent ? 'bg-white/15' : 'bg-gradient-to-br from-orange-500 to-orange-600 shadow-glow'
        }`}
      >
        <Icon size={22} className="text-white" />
      </div>
      <p className={`relative text-2xl font-black ${accent ? 'text-white' : 'text-primary'}`}>
        {isNumeric ? <CountUp value={String(value)} /> : value}
      </p>
      <p className={`relative text-sm ${accent ? 'text-white/70' : 'text-muted-foreground'}`}>{label}</p>
    </div>
  );
}

function EmptyState({ icon: Icon, title, description, ctaLabel, ctaHref }: { icon: any; title: string; description: string; ctaLabel?: string; ctaHref?: string }) {
  return (
    <div className="flex flex-col items-center text-center py-12 px-6">
      <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center text-accent mb-4">
        <Icon size={24} />
      </div>
      <p className="font-bold text-primary mb-1">{title}</p>
      <p className="text-sm text-muted-foreground max-w-sm mb-5">{description}</p>
      {ctaLabel && ctaHref && (
        <a
          href={ctaHref}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-accent hover:bg-accent/90 text-white text-sm font-bold transition-colors"
        >
          {ctaLabel}
          <ArrowRight size={16} />
        </a>
      )}
    </div>
  );
}

const statusLabel: Record<string, { es: string; en: string }> = {
  pending: { es: 'Pendiente', en: 'Pending' },
  quoted: { es: 'Cotizado', en: 'Quoted' },
  won: { es: 'Ganado', en: 'Won' },
  lost: { es: 'Perdido', en: 'Lost' },
};

function ReferralCard() {
  const { profile } = useAuth();
  const { language } = useLanguage();
  const [copied, setCopied] = useState(false);
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!profile) return;
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .eq('referred_by', profile.id)
      .then(({ count }) => setCount(count ?? 0));
  }, [profile]);

  if (!profile) return null;
  const link = buildReferralLink(profile.referral_code);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — the link is still visible to copy manually
    }
  };

  return (
    <div className="bg-gradient-to-br from-primary to-indigo-950 rounded-3xl app-shadow p-6 text-white">
      <div className="flex items-center gap-2 mb-2">
        <Gift size={18} className="text-accent" />
        <h2 className="font-bold">{language === 'es' ? 'Tu link de referidos' : 'Your referral link'}</h2>
      </div>
      <p className="text-white/70 text-sm mb-4">
        {language === 'es'
          ? `${count ?? 0} persona${count === 1 ? '' : 's'} se ha${count === 1 ? '' : 'n'} registrado con tu link.`
          : `${count ?? 0} ${count === 1 ? 'person has' : 'people have'} signed up with your link.`}
      </p>
      <div className="flex items-center gap-2 bg-white/10 rounded-2xl p-1.5">
        <input
          readOnly
          value={link}
          className="flex-1 bg-transparent border-0 outline-none text-sm text-white/90 px-3 min-w-0"
        />
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-accent hover:bg-accent/90 text-white text-xs font-bold flex-shrink-0 border-0 cursor-pointer transition-colors"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? (language === 'es' ? 'Copiado' : 'Copied') : (language === 'es' ? 'Copiar' : 'Copy')}
        </button>
      </div>
    </div>
  );
}

const planLabel: Record<string, { es: string; en: string }> = {
  diagnostico_madurez: { es: 'Diagnóstico de madurez', en: 'Maturity diagnosis' },
  analisis_mercado: { es: 'Análisis de mercado', en: 'Market analysis' },
};

function ClienteDashboard() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [quotes, setQuotes] = useState<FreightQuote[] | null>(null);
  const [payments, setPayments] = useState<Payment[] | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('freight_quotes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setQuotes((data as FreightQuote[]) ?? []));

    // Written only by the Stripe webhook on the server — a client can
    // read its own rows here but never create one (see schema.sql).
    supabase
      .from('payments')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'paid')
      .order('created_at', { ascending: false })
      .then(({ data }) => setPayments((data as Payment[]) ?? []));
  }, [user]);

  const latestPayment = payments?.[0] ?? null;
  const activePlanLabel = latestPayment
    ? (planLabel[latestPayment.plan]?.[language === 'es' ? 'es' : 'en'] ?? latestPayment.plan)
    : (language === 'es' ? 'Ninguno' : 'None');

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Package} label={language === 'es' ? 'Plan activo' : 'Active plan'} value={activePlanLabel} />
        <StatCard icon={FileText} label={language === 'es' ? 'Cotizaciones enviadas' : 'Quotes submitted'} value={quotes?.length ?? 0} accent />
        <StatCard icon={CalendarClock} label={language === 'es' ? 'Consultoría agendada' : 'Consultation booked'} value={language === 'es' ? 'No' : 'No'} />
      </div>

      <ReferralCard />

      <div className="bg-white rounded-3xl border border-gray-100 app-shadow">
        <div className="p-6 border-b border-gray-100">
          <h2 className="font-bold text-primary">{language === 'es' ? 'Tus cotizaciones de flete' : 'Your freight quotes'}</h2>
        </div>
        {quotes === null ? (
          <ListSkeleton rows={3} />
        ) : quotes.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={language === 'es' ? 'Aún no tienes cotizaciones' : "You don't have quotes yet"}
            description={language === 'es'
              ? 'Cuando uses la calculadora de fletes, tus cotizaciones aparecerán acá.'
              : 'Once you use the freight calculator, your quotes will show up here.'}
            ctaLabel={language === 'es' ? 'Ir a la calculadora' : 'Go to the calculator'}
            ctaHref="/#calculadora"
          />
        ) : (
          <ul className="divide-y divide-gray-100">
            {quotes.map((q) => (
              <li key={q.id} className="p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center text-accent flex-shrink-0">
                    <MapPin size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">{q.origin} → {q.destination}</p>
                    <p className="text-xs text-muted-foreground">{new Date(q.created_at).toLocaleDateString()} {q.weight_kg ? `· ${q.weight_kg} kg` : ''}</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-accent bg-secondary rounded-full px-3 py-1 flex-shrink-0">
                  {language === 'es' ? statusLabel[q.status]?.es : statusLabel[q.status]?.en}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 app-shadow">
        <div className="p-6 border-b border-gray-100">
          <h2 className="font-bold text-primary">
            {payments?.length
              ? (language === 'es' ? 'Tus pagos' : 'Your payments')
              : (language === 'es' ? 'Elige tu plan' : 'Choose your plan')}
          </h2>
        </div>
        {payments === null ? (
          <ListSkeleton rows={2} avatar={false} trailing="date" />
        ) : payments.length === 0 ? (
          <EmptyState
            icon={TrendingUp}
            title={language === 'es' ? 'Aún no tienes un plan activo' : "You don't have an active plan yet"}
            description={language === 'es'
              ? 'Empieza con el diagnóstico gratuito o el plan que mejor se ajuste a tu marca.'
              : 'Start with the free diagnosis or the plan that fits your brand best.'}
            ctaLabel={language === 'es' ? 'Ver planes' : 'See plans'}
            ctaHref="/#planes"
          />
        ) : (
          <ul className="divide-y divide-gray-100">
            {payments.map((p) => (
              <li key={p.id} className="p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-10 h-10 rounded-xl bg-green-50 text-green-600 flex items-center justify-center flex-shrink-0">
                    <Check size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">
                      {planLabel[p.plan]?.[language === 'es' ? 'es' : 'en'] ?? p.plan}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(p.created_at).toLocaleDateString()} · {(p.amount_cents / 100).toFixed(2)} {p.currency.toUpperCase()}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold text-green-700 bg-green-50 rounded-full px-3 py-1 flex-shrink-0">
                  {language === 'es' ? 'Pagado' : 'Paid'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ExportButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline bg-transparent border-0 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <Download size={14} />
      {label}
    </button>
  );
}

// Placeholder for the Kalodata (TikTok Shop) + Sicex (foreign trade data)
// integrations the team asked for. Deliberately honest about the state:
// no fabricated numbers, just what each tool would unlock once wired up
// server-side with real API credentials. Swap this for real cards fed
// by a server endpoint once those keys exist — see SETUP.md.
function MarketIntelPanel() {
  const { language } = useLanguage();

  const tools = [
    {
      name: 'Kalodata',
      description: language === 'es'
        ? 'Productos en tendencia, ventas y competidores en TikTok Shop.'
        : 'Trending products, sales, and competitors on TikTok Shop.',
    },
    {
      name: 'Sicex',
      description: language === 'es'
        ? 'Datos reales de importación/exportación por país y producto para tus análisis de mercado.'
        : 'Real import/export data by country and product for your market analyses.',
    },
  ];

  return (
    <div className="bg-white rounded-3xl border border-gray-100 app-shadow">
      <div className="p-6 border-b border-gray-100 flex items-center gap-3">
        <span className="w-10 h-10 rounded-2xl bg-secondary flex items-center justify-center text-accent flex-shrink-0">
          <BarChart3 size={18} />
        </span>
        <div>
          <h2 className="font-bold text-primary">{language === 'es' ? 'Inteligencia de mercado' : 'Market intelligence'}</h2>
          <p className="text-xs text-muted-foreground">
            {language === 'es' ? 'Pendiente de conectar tus cuentas' : 'Pending your account connections'}
          </p>
        </div>
      </div>
      <ul className="divide-y divide-gray-100">
        {tools.map((tool) => (
          <li key={tool.name} className="p-5 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="font-semibold text-foreground">{tool.name}</p>
              <p className="text-xs text-muted-foreground">{tool.description}</p>
            </div>
            <span className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground bg-gray-100 rounded-full px-3 py-1 flex-shrink-0">
              <Plug size={12} />
              {language === 'es' ? 'No conectado' : 'Not connected'}
            </span>
          </li>
        ))}
      </ul>
      <div className="px-5 pb-5">
        <p className="text-xs text-muted-foreground">
          {language === 'es'
            ? 'Necesitamos las API keys de cada plataforma para traer datos reales acá — nunca vamos a mostrar números inventados mientras tanto.'
            : "We need each platform's API keys to bring in real data here — we'll never show made-up numbers in the meantime."}
        </p>
      </div>
    </div>
  );
}

function VendedorDashboard() {
  const { language } = useLanguage();
  const [clients, setClients] = useState<Profile[] | null>(null);
  const [quotes, setQuotes] = useState<FreightQuote[] | null>(null);
  const [leads, setLeads] = useState<ContactLead[] | null>(null);

  useEffect(() => {
    supabase
      .from('profiles')
      .select('*')
      .eq('role', 'cliente')
      .order('created_at', { ascending: false })
      .then(({ data }) => setClients((data as Profile[]) ?? []));

    supabase
      .from('freight_quotes')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => setQuotes((data as FreightQuote[]) ?? []));

    supabase
      .from('contact_leads')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => setLeads((data as ContactLead[]) ?? []));
  }, []);

  const pendingQuotes = quotes?.filter((q) => q.status === 'pending').length ?? null;
  const leadsThisMonth = leads
    ? leads.filter((l) => {
        const created = new Date(l.created_at);
        const now = new Date();
        return created.getFullYear() === now.getFullYear() && created.getMonth() === now.getMonth();
      }).length
    : null;

  const exportClients = () => downloadCSV('easycomex-clientes.csv', (clients ?? []).map((c) => ({
    nombre: c.full_name ?? '', email: c.email, empresa: c.company ?? '', rol: c.role, registrado: c.created_at,
  })));
  const exportQuotes = () => downloadCSV('easycomex-cotizaciones.csv', (quotes ?? []).map((q) => ({
    nombre: q.name ?? '', email: q.email ?? '', telefono: q.phone ?? '', origen: q.origin, destino: q.destination,
    peso_kg: q.weight_kg ?? '', tipo_cliente: q.client_type ?? '', estado: q.status, fecha: q.created_at,
  })));
  const exportLeads = () => downloadCSV('easycomex-leads.csv', (leads ?? []).map((l) => ({
    nombre: `${l.first_name ?? ''} ${l.last_name ?? ''}`.trim(), email: l.email ?? '', telefono: l.phone ?? '',
    empresa: l.company ?? '', pais: l.country ?? '', canal: l.sales_channel ?? '',
    intereses: (l.interests ?? []).join('; '), mensaje: l.message ?? '', estado: l.status, fecha: l.created_at,
  })));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Users} label={language === 'es' ? 'Clientes registrados' : 'Registered clients'} value={clients?.length ?? 0} accent />
        <StatCard icon={FileText} label={language === 'es' ? 'Cotizaciones pendientes' : 'Pending quotes'} value={pendingQuotes ?? 0} />
        <StatCard icon={TrendingUp} label={language === 'es' ? 'Leads este mes' : 'Leads this month'} value={leadsThisMonth ?? 0} />
      </div>

      <MarketIntelPanel />

      <div className="bg-white rounded-3xl border border-gray-100 app-shadow">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-primary">{language === 'es' ? 'Clientes' : 'Clients'}</h2>
          <ExportButton label={language === 'es' ? 'Exportar CSV' : 'Export CSV'} onClick={exportClients} disabled={!clients?.length} />
        </div>
        {clients === null ? (
          <ListSkeleton rows={4} trailing="date" />
        ) : clients.length === 0 ? (
          <EmptyState
            icon={Users}
            title={language === 'es' ? 'Sin clientes todavía' : 'No clients yet'}
            description={language === 'es'
              ? 'A medida que se registren marcas, las vas a ver listadas acá con su plan y estado.'
              : 'As brands sign up, you will see them listed here with their plan and status.'}
          />
        ) : (
          <ul className="divide-y divide-gray-100">
            {clients.map((c) => (
              <li key={c.id} className="p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-10 h-10 rounded-full bg-secondary text-accent font-bold flex items-center justify-center flex-shrink-0">
                    {(c.full_name || c.email).charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground truncate">{c.full_name || c.email}</p>
                    <p className="text-xs text-muted-foreground truncate">{c.company || c.email}</p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {new Date(c.created_at).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 app-shadow">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-primary">{language === 'es' ? 'Cotizaciones de flete' : 'Freight quotes'}</h2>
          <ExportButton label={language === 'es' ? 'Exportar CSV' : 'Export CSV'} onClick={exportQuotes} disabled={!quotes?.length} />
        </div>
        {quotes === null ? (
          <ListSkeleton rows={3} avatar={false} />
        ) : quotes.length === 0 ? (
          <EmptyState
            icon={MapPin}
            title={language === 'es' ? 'Sin cotizaciones todavía' : 'No quotes yet'}
            description={language === 'es'
              ? 'Cuando alguien use la calculadora de fletes, va a aparecer acá.'
              : 'Once someone uses the freight calculator, it will show up here.'}
          />
        ) : (
          <ul className="divide-y divide-gray-100">
            {quotes.slice(0, 5).map((q) => (
              <li key={q.id} className="p-5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground truncate">{q.name || q.email || (language === 'es' ? 'Un visitante' : 'A visitor')}</p>
                  <p className="text-xs text-muted-foreground truncate">{q.origin} → {q.destination}</p>
                </div>
                <span className="text-xs font-bold text-accent bg-secondary rounded-full px-3 py-1 flex-shrink-0">
                  {language === 'es' ? statusLabel[q.status]?.es : statusLabel[q.status]?.en}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 app-shadow">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-primary">{language === 'es' ? 'Leads de contacto' : 'Contact leads'}</h2>
          <ExportButton label={language === 'es' ? 'Exportar CSV' : 'Export CSV'} onClick={exportLeads} disabled={!leads?.length} />
        </div>
        {leads === null ? (
          <ListSkeleton rows={3} avatar={false} trailing="date" />
        ) : leads.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={language === 'es' ? 'Sin leads todavía' : 'No leads yet'}
            description={language === 'es'
              ? 'Cuando alguien llene el formulario de contacto, va a aparecer acá.'
              : 'Once someone fills out the contact form, it will show up here.'}
          />
        ) : (
          <ul className="divide-y divide-gray-100">
            {leads.slice(0, 5).map((l) => (
              <li key={l.id} className="p-5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-semibold text-foreground truncate">{`${l.first_name ?? ''} ${l.last_name ?? ''}`.trim() || l.email || (language === 'es' ? 'Un visitante' : 'A visitor')}</p>
                  <p className="text-xs text-muted-foreground truncate">{l.company || l.email}</p>
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {new Date(l.created_at).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user, profile, loading, configured } = useAuth();
  const [, navigate] = useLocation();
  const { language } = useLanguage();

  useEffect(() => {
    if (!loading && configured && !user) {
      navigate('/login');
    }
  }, [loading, configured, user, navigate]);

  if (!configured) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <p className="font-bold text-primary mb-2">
            {language === 'es' ? 'Supabase no está configurado' : 'Supabase is not configured'}
          </p>
          <p className="text-sm text-muted-foreground">
            {language === 'es'
              ? 'Agrega VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY para activar el login y este dashboard.'
              : 'Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable login and this dashboard.'}
          </p>
        </div>
      </div>
    );
  }

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-accent" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar />
      <main className="container py-10">
        <h1 className="text-2xl md:text-3xl font-black text-primary mb-1">
          {language === 'es' ? `Hola, ${profile?.full_name?.split(' ')[0] || ''}` : `Hi, ${profile?.full_name?.split(' ')[0] || ''}`}
        </h1>
        <p className="text-muted-foreground mb-8">
          {profile?.role === 'vendedor'
            ? (language === 'es' ? 'Vista general de tus clientes.' : 'Overview of your clients.')
            : (language === 'es' ? 'Así va tu expansión a Estados Unidos.' : "Here's how your US expansion is going.")}
        </p>
        {profile?.role === 'vendedor' ? <VendedorDashboard /> : <ClienteDashboard />}
      </main>
    </div>
  );
}
