import { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import {
  LogOut, Package, FileText, CalendarClock, Users, TrendingUp,
  Inbox, ArrowRight, Loader2, Copy, Check, Gift, MapPin, Bell, BellOff, Download,
  BarChart3, Plug, Receipt, RefreshCw, Search, Sparkles,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { getSupabase, FreightQuote, Profile, ContactLead, Payment, Subscription } from '@/lib/supabase';
import { buildReferralLink } from '@/lib/referral';
import { downloadCSV } from '@/lib/csv';
import { isPushConfigured, getPushStatus, subscribeToPush, unsubscribeFromPush, PushStatus } from '@/lib/push';
import { RESUME_EVENT, openExternal } from '@/lib/native';
import NotificationBell from '@/components/NotificationBell';
import CountUp from '@/components/CountUp';
import MfaSetup from '@/components/MfaSetup';
import DeleteAccount from '@/components/DeleteAccount';
import MfaChallenge from '@/components/MfaChallenge';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchQuota, type ResearchQuota } from '@/lib/research';

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
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xl border-b border-gray-100 pt-[env(safe-area-inset-top)]">
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
    void getSupabase().then((sb) =>
      sb
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('referred_by', profile.id)
        .then(({ count }) => setCount(count ?? 0)));
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
  acompanamiento: { es: 'Acompañamiento mensual', en: 'Monthly retainer' },
  suscripcion: { es: 'Suscripción', en: 'Subscription' },
};

const paymentStatusStyle: Record<string, { badge: string; icon: string }> = {
  paid: { badge: 'text-green-700 bg-green-50', icon: 'bg-green-50 text-green-600' },
  pending: { badge: 'text-blue-700 bg-blue-50', icon: 'bg-blue-50 text-blue-600' },
  refunded: { badge: 'text-gray-600 bg-gray-100', icon: 'bg-gray-100 text-gray-500' },
  failed: { badge: 'text-red-700 bg-red-50', icon: 'bg-red-50 text-red-600' },
};

const paymentStatusLabel: Record<string, { es: string; en: string }> = {
  paid: { es: 'Pagado', en: 'Paid' },
  pending: { es: 'Procesando', en: 'Processing' },
  refunded: { es: 'Reembolsado', en: 'Refunded' },
  failed: { es: 'No completado', en: 'Not completed' },
};

// Opens Stripe's own billing portal: invoices, payment method, and
// cancelling a recurring plan all live there, so none of that is
// re-implemented (or exposed) here. In the native app it opens in the
// system browser, like Checkout.
function BillingPortalButton() {
  const { language } = useLanguage();
  const { getAccessToken } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = async () => {
    setBusy(true);
    setError(null);
    try {
      const token = getAccessToken();
      const res = await fetch('/api/billing-portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: '{}',
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.message || 'portal_failed');
      await openExternal(data.url);
    } catch (err) {
      setError(
        (err as Error).message && (err as Error).message !== 'portal_failed'
          ? (err as Error).message
          : language === 'es'
            ? 'No pudimos abrir el portal de facturación.'
            : 'We could not open the billing portal.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={open}
        disabled={busy}
        className="tap-scale-sm inline-flex items-center gap-2 text-xs font-bold text-accent hover:underline bg-transparent border-0 cursor-pointer disabled:opacity-50"
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Receipt size={14} />}
        {language === 'es' ? 'Facturación' : 'Billing'}
      </button>
      {error && <span className="text-[11px] text-muted-foreground max-w-[16rem] text-right">{error}</span>}
    </div>
  );
}

// Marco Polo's research allowance: how many Kalodata/Sicex lookups this
// account has left today, and whether those sources are connected at all.
// Every number here comes from the server — the client cannot grant
// itself lookups, and nothing is shown for a source that is not wired up.
function ResearchQuotaCard() {
  const { language } = useLanguage();
  const { getAccessToken } = useAuth();
  const [quota, setQuota] = useState<ResearchQuota | null>(null);
  const [busy, setBusy] = useState(false);
  const es = language === 'es';

  useEffect(() => {
    fetchQuota(getAccessToken()).then(setQuota);
  }, [getAccessToken]);

  if (!quota) return null;

  const buy = async () => {
    setBusy(true);
    try {
      const token = getAccessToken();
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ plan: 'creditos_marco_polo', platform: 'web' }),
      });
      const data = await res.json();
      if (data.url) await openExternal(data.url);
    } finally {
      setBusy(false);
    }
  };

  const connected = quota.sources.kalodata || quota.sources.sicex;
  const pct = quota.dailyLimit > 0 ? Math.round((quota.freeRemaining / quota.dailyLimit) * 100) : 0;

  return (
    <div className="bg-white rounded-3xl border border-gray-100 app-shadow p-6">
      <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-11 h-11 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 text-white flex items-center justify-center flex-shrink-0 shadow-glow">
            <Search size={18} />
          </span>
          <div className="min-w-0">
            <p className="font-bold text-primary">{es ? 'Investigación de Marco Polo' : "Marco Polo's research"}</p>
            <p className="text-xs text-muted-foreground">
              {es ? 'Consultas a Kalodata y Sicex desde el chat' : 'Kalodata and Sicex lookups from the chat'}
            </p>
          </div>
        </div>
        <button
          onClick={buy}
          disabled={busy}
          className="tap-scale-sm inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent hover:bg-accent/90 text-white text-xs font-bold border-0 cursor-pointer disabled:opacity-50 transition-colors"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {es ? 'Comprar consultas' : 'Buy lookups'}
        </button>
      </div>

      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-3xl font-black text-primary">{quota.freeRemaining}</span>
        <span className="text-sm text-muted-foreground">
          {es ? `de ${quota.dailyLimit} gratis hoy` : `of ${quota.dailyLimit} free today`}
          {quota.credits > 0 && (es ? ` · ${quota.credits} créditos` : ` · ${quota.credits} credits`)}
        </span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden mb-3">
        <div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-orange-600 transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>

      <p className="text-xs text-muted-foreground">
        {connected
          ? es
            ? 'Tu plan define cuántas consultas trae cada día. Cuando se acaban, seguís con créditos comprados.'
            : 'Your plan sets how many lookups you get each day. When they run out, purchased credits take over.'
          : es
            ? 'Kalodata y Sicex todavía no están conectados: hasta que el equipo cargue los accesos, Marco Polo no muestra datos de esas fuentes (y nunca inventa números).'
            : 'Kalodata and Sicex are not connected yet: until the team loads the access, Marco Polo shows no data from those sources (and never invents numbers).'}
      </p>
    </div>
  );
}

// Only rendered when a recurring plan actually exists in Stripe.
function SubscriptionCard({ sub }: { sub: Subscription }) {
  const { language } = useLanguage();
  const es = language === 'es';
  const active = sub.status === 'active' || sub.status === 'trialing';
  const renews = sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString() : null;

  return (
    <div className="bg-white rounded-3xl border border-gray-100 app-shadow p-6 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3 min-w-0">
        <span className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${active ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-accent'}`}>
          <RefreshCw size={18} />
        </span>
        <div className="min-w-0">
          <p className="font-bold text-primary truncate">
            {(sub.plan && planLabel[sub.plan]?.[es ? 'es' : 'en']) ?? (es ? 'Plan recurrente' : 'Recurring plan')}
          </p>
          <p className="text-xs text-muted-foreground">
            {sub.cancel_at_period_end
              ? es ? `Se cancela el ${renews}` : `Cancels on ${renews}`
              : renews
                ? es ? `Se renueva el ${renews}` : `Renews on ${renews}`
                : sub.status}
          </p>
        </div>
      </div>
      <BillingPortalButton />
    </div>
  );
}

function ClienteDashboard() {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [quotes, setQuotes] = useState<FreightQuote[] | null>(null);
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);

  useEffect(() => {
    if (!user) return;
    void getSupabase().then((sb) =>
      sb
        .from('freight_quotes')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .then(({ data }) => setQuotes((data as FreightQuote[]) ?? [])));

    // Written only by the Stripe webhook on the server — a client can
    // read its own rows here but never create one (see schema.sql).
    const loadPayments = () => {
      // Every status, not just 'paid': a voucher payment still clearing
      // ('pending') or a refund must be visible to the buyer too.
      void getSupabase().then((sb) =>
        sb
          .from('payments')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .then(({ data }) => setPayments((data as Payment[]) ?? [])));
      // Empty unless a plan is configured as recurring in Stripe.
      void getSupabase().then((sb) =>
        sb
          .from('subscriptions')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .then(({ data }) => setSubscription(((data as Subscription[]) ?? [])[0] ?? null)));
    };
    loadPayments();

    // After paying in the system browser (native app) or another tab,
    // the webhook has usually landed by the time the user is back here.
    const onVisible = () => { if (document.visibilityState === 'visible') loadPayments(); };
    window.addEventListener(RESUME_EVENT, loadPayments);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener(RESUME_EVENT, loadPayments);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user]);

  // Only a paid, non-refunded purchase counts as an active plan.
  const latestPayment = payments?.find((p) => p.status === 'paid') ?? null;
  const activePlanLabel = latestPayment
    ? (planLabel[latestPayment.plan]?.[language === 'es' ? 'es' : 'en'] ?? latestPayment.plan)
    : (language === 'es' ? 'Ninguno' : 'None');
  const hasBilling = !!(payments?.length || subscription);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Package} label={language === 'es' ? 'Plan activo' : 'Active plan'} value={activePlanLabel} />
        <StatCard icon={FileText} label={language === 'es' ? 'Cotizaciones enviadas' : 'Quotes submitted'} value={quotes?.length ?? 0} accent />
        <StatCard icon={CalendarClock} label={language === 'es' ? 'Consultoría agendada' : 'Consultation booked'} value={language === 'es' ? 'No' : 'No'} />
      </div>

      {subscription && <SubscriptionCard sub={subscription} />}

      <ResearchQuotaCard />

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
                    <p className="text-xs text-muted-foreground">
                      {new Date(q.created_at).toLocaleDateString()} {q.weight_kg ? `· ${q.weight_kg} kg` : ''}
                      {q.quote_cop ? ` · ${q.quote_cop.toLocaleString('es-CO')} COP` : ''}
                    </p>
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
        <div className="p-6 border-b border-gray-100 flex items-center justify-between gap-4">
          <h2 className="font-bold text-primary">
            {payments?.length
              ? (language === 'es' ? 'Tus pagos' : 'Your payments')
              : (language === 'es' ? 'Elige tu plan' : 'Choose your plan')}
          </h2>
          {hasBilling && !subscription && <BillingPortalButton />}
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
                  <span className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${paymentStatusStyle[p.status]?.icon ?? paymentStatusStyle.paid.icon}`}>
                    {p.status === 'pending' ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
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
                <div className="flex items-center gap-2 flex-shrink-0">
                  {p.receipt_url && (
                    <a href={p.receipt_url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-accent hover:underline">
                      {language === 'es' ? 'Ver recibo' : 'View receipt'}
                    </a>
                  )}
                  <span className={`text-xs font-bold rounded-full px-3 py-1 ${paymentStatusStyle[p.status]?.badge ?? paymentStatusStyle.paid.badge}`}>
                    {paymentStatusLabel[p.status]?.[language === 'es' ? 'es' : 'en'] ?? p.status}
                  </span>
                </div>
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

// Live status of every integration, read from GET /api/health (booleans
// only — the server never sends key values). This is the "what's left
// to connect" checklist for the team; Kalodata/Sicex live here too, and
// stay honest: no data is shown until real API access exists.
type HealthIntegrations = Record<string, boolean>;

function IntegrationsPanel() {
  const { language } = useLanguage();
  const { getAccessToken } = useAuth();
  const [health, setHealth] = useState<HealthIntegrations | null | 'error'>(null);

  useEffect(() => {
    // The server only reveals configuration to a verified vendedor token.
    const token = getAccessToken();
    fetch('/api/health', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setHealth(d.integrations ?? 'error'))
      .catch(() => setHealth('error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rows: { key: string; name: string; description: { es: string; en: string }; group: 'intel' | 'core' }[] = [
    { key: 'kalodata', name: 'Kalodata', group: 'intel', description: { es: 'Productos en tendencia, ventas y competidores en TikTok Shop.', en: 'Trending products, sales and competitors on TikTok Shop.' } },
    { key: 'sicex', name: 'Sicex', group: 'intel', description: { es: 'Datos reales de importación/exportación por país y producto.', en: 'Real import/export data by country and product.' } },
    { key: 'supabase', name: 'Supabase', group: 'core', description: { es: 'Login, registro, base de datos, notificaciones.', en: 'Login, sign-up, database, notifications.' } },
    { key: 'stripe', name: 'Stripe', group: 'core', description: { es: 'Cobros con tarjeta.', en: 'Card payments.' } },
    { key: 'stripeWebhook', name: 'Stripe webhook', group: 'core', description: { es: 'Registra cada pago en el dashboard.', en: 'Records each payment in the dashboard.' } },
    { key: 'email', name: 'Correo (Resend)', group: 'core', description: { es: 'Recibo al comprador y aviso de cada lead. Sin esto, nada sale por correo.', en: 'Buyer receipt and lead alerts. Without it, no email goes out.' } },
    { key: 'emailTeamInbox', name: 'Bandeja del equipo', group: 'core', description: { es: 'A qué correo llegan los leads (TEAM_EMAIL).', en: 'Where lead alerts land (TEAM_EMAIL).' } },
    { key: 'wompi', name: 'Wompi', group: 'core', description: { es: 'Cobro del plan de acción del diagnóstico (Colombia).', en: 'Charges the diagnostic action plan (Colombia).' } },
    { key: 'publicAppUrl', name: 'PUBLIC_APP_URL', group: 'core', description: { es: 'A dónde vuelve el cliente tras pagar y qué orígenes pueden llamar a /api.', en: 'Where the customer returns after paying, and which origins may call /api.' } },
    { key: 'push', name: 'Push', group: 'core', description: { es: 'Notificaciones con la app cerrada.', en: 'Notifications with the app closed.' } },
    { key: 'chatAI', name: 'Marco Polo · IA', group: 'core', description: { es: 'Respuestas abiertas con Anthropic (sin esto usa reglas).', en: 'Open answers via Anthropic (rule-based without it).' } },
    { key: 'voicePremium', name: 'Marco Polo · voz premium', group: 'core', description: { es: 'ElevenLabs (sin esto usa la voz del navegador).', en: 'ElevenLabs (browser voice without it).' } },
    { key: 'monitoring', name: 'Sentry', group: 'core', description: { es: 'Monitoreo de errores y eventos de seguridad.', en: 'Error and security event monitoring.' } },
    { key: 'calendly', name: 'Calendly', group: 'core', description: { es: 'Agenda de consultorías.', en: 'Consultation booking.' } },
    { key: 'metaPixel', name: 'Meta Pixel', group: 'core', description: { es: 'Tracking de ads.', en: 'Ad tracking.' } },
    { key: 'tiktokPixel', name: 'TikTok Pixel', group: 'core', description: { es: 'Tracking de ads.', en: 'Ad tracking.' } },
    { key: 'googleAnalytics', name: 'Google Analytics', group: 'core', description: { es: 'Analítica web.', en: 'Web analytics.' } },
  ];

  const statusPill = (key: string) => {
    if (health === null) return <Skeleton className="h-6 w-24 rounded-full" />;
    const on = health !== 'error' && health[key];
    return (
      <span className={`flex items-center gap-1.5 text-xs font-bold rounded-full px-3 py-1 flex-shrink-0 ${on ? 'text-green-700 bg-green-50' : 'text-muted-foreground bg-gray-100'}`}>
        <Plug size={12} />
        {on ? (language === 'es' ? 'Conectado' : 'Connected') : (language === 'es' ? 'No conectado' : 'Not connected')}
      </span>
    );
  };

  const connected = health && health !== 'error' ? rows.filter((r) => health[r.key]).length : 0;

  return (
    <div className="bg-white rounded-3xl border border-gray-100 app-shadow">
      <div className="p-6 border-b border-gray-100 flex items-center gap-3">
        <span className="w-10 h-10 rounded-2xl bg-secondary flex items-center justify-center text-accent flex-shrink-0">
          <BarChart3 size={18} />
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-primary">{language === 'es' ? 'Integraciones' : 'Integrations'}</h2>
          <p className="text-xs text-muted-foreground">
            {health === 'error'
              ? (language === 'es' ? 'No se pudo consultar el servidor.' : 'Could not reach the server.')
              : (language === 'es' ? `${connected} de ${rows.length} conectadas · se activan solo con las keys en el servidor` : `${connected} of ${rows.length} connected · activated just by adding keys on the server`)}
          </p>
        </div>
      </div>
      <div className="px-6 pt-4 pb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
        {language === 'es' ? 'Inteligencia de mercado' : 'Market intelligence'}
      </div>
      <ul className="divide-y divide-gray-100">
        {rows.filter((r) => r.group === 'intel').map((r) => (
          <li key={r.key} className="px-6 py-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="font-semibold text-foreground">{r.name}</p>
              <p className="text-xs text-muted-foreground">{r.description[language]}</p>
            </div>
            {statusPill(r.key)}
          </li>
        ))}
      </ul>
      <div className="px-6 pt-4 pb-1 text-[11px] font-bold uppercase tracking-wide text-muted-foreground border-t border-gray-100">
        {language === 'es' ? 'Plataforma' : 'Platform'}
      </div>
      <ul className="divide-y divide-gray-100">
        {rows.filter((r) => r.group === 'core').map((r) => (
          <li key={r.key} className="px-6 py-3.5 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="font-semibold text-foreground text-sm">{r.name}</p>
              <p className="text-xs text-muted-foreground">{r.description[language]}</p>
            </div>
            {statusPill(r.key)}
          </li>
        ))}
      </ul>
      <div className="px-6 py-4 border-t border-gray-100">
        <p className="text-xs text-muted-foreground">
          {language === 'es'
            ? 'Cada fila se pone en verde sola al agregar su variable en el hosting (ver README). Kalodata y Sicex no muestran datos hasta tener acceso real — nunca números inventados.'
            : 'Each row turns green on its own once its variable is added on the host (see README). Kalodata and Sicex show no data until real access exists — never made-up numbers.'}
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
    void getSupabase().then((sb) =>
      sb
        .from('profiles')
        .select('*')
        .eq('role', 'cliente')
        .order('created_at', { ascending: false })
        .then(({ data }) => setClients((data as Profile[]) ?? [])));

    void getSupabase().then((sb) =>
      sb
        .from('freight_quotes')
        .select('*')
        .order('created_at', { ascending: false })
        .then(({ data }) => setQuotes((data as FreightQuote[]) ?? [])));

    void getSupabase().then((sb) =>
      sb
        .from('contact_leads')
        .select('*')
        .order('created_at', { ascending: false })
        .then(({ data }) => setLeads((data as ContactLead[]) ?? [])));
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
    peso_kg: q.weight_kg ?? '', tipo_cliente: q.client_type ?? '', zona: q.zone ?? '', cotizacion_cop: q.quote_cop ?? '', estado: q.status, fecha: q.created_at,
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

      <IntegrationsPanel />

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
  const { user, profile, loading, configured, mfaRequired } = useAuth();
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

  // 2FA is enabled on this account but this session hasn't passed the
  // code yet (e.g. a Google sign-in landed here directly): nothing
  // renders until it does. RLS enforces the same on the data side.
  if (mfaRequired) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <MfaChallenge onSuccess={() => { /* mfaRequired flips via refreshMfa */ }} />
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
            : (language === 'es' ? 'Así va tu expansión.' : "Here's how your expansion is going.")}
        </p>
        {profile?.role === 'vendedor' ? <VendedorDashboard /> : <ClienteDashboard />}
        <div className="mt-6">
          <MfaSetup />
        </div>
        <div className="mt-6">
          <DeleteAccount />
        </div>
      </main>
    </div>
  );
}
