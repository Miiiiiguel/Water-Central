import { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import {
  LogOut, Package, FileText, CalendarClock, Users, TrendingUp,
  Inbox, ArrowRight, Loader2, Copy, Check, Gift,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';
import { buildReferralLink } from '@/lib/referral';

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
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 hover:bg-gray-50 text-sm font-bold text-foreground transition-colors bg-transparent cursor-pointer"
          >
            <LogOut size={16} />
            {language === 'es' ? 'Salir' : 'Log out'}
          </button>
        </div>
      </div>
    </header>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="bg-white rounded-3xl border border-gray-100 app-shadow p-6">
      <div className="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center text-white mb-4">
        <Icon size={22} />
      </div>
      <p className="text-2xl font-black text-primary">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
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

function ClienteDashboard() {
  const { language } = useLanguage();
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Package} label={language === 'es' ? 'Plan activo' : 'Active plan'} value={language === 'es' ? 'Ninguno' : 'None'} />
        <StatCard icon={FileText} label={language === 'es' ? 'Cotizaciones enviadas' : 'Quotes submitted'} value="0" />
        <StatCard icon={CalendarClock} label={language === 'es' ? 'Consultoría agendada' : 'Consultation booked'} value={language === 'es' ? 'No' : 'No'} />
      </div>

      <ReferralCard />

      <div className="bg-white rounded-3xl border border-gray-100 app-shadow">
        <div className="p-6 border-b border-gray-100">
          <h2 className="font-bold text-primary">{language === 'es' ? 'Tus cotizaciones de flete' : 'Your freight quotes'}</h2>
        </div>
        <EmptyState
          icon={Inbox}
          title={language === 'es' ? 'Aún no tienes cotizaciones' : "You don't have quotes yet"}
          description={language === 'es'
            ? 'Cuando uses la calculadora de fletes, tus cotizaciones aparecerán acá.'
            : 'Once you use the freight calculator, your quotes will show up here.'}
          ctaLabel={language === 'es' ? 'Ir a la calculadora' : 'Go to the calculator'}
          ctaHref="/#calculadora"
        />
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 app-shadow">
        <div className="p-6 border-b border-gray-100">
          <h2 className="font-bold text-primary">{language === 'es' ? 'Elige tu plan' : 'Choose your plan'}</h2>
        </div>
        <EmptyState
          icon={TrendingUp}
          title={language === 'es' ? 'Aún no tienes un plan activo' : "You don't have an active plan yet"}
          description={language === 'es'
            ? 'Empieza con el diagnóstico gratuito o el plan que mejor se ajuste a tu marca.'
            : 'Start with the free diagnosis or the plan that fits your brand best.'}
          ctaLabel={language === 'es' ? 'Ver planes' : 'See plans'}
          ctaHref="/#planes"
        />
      </div>
    </div>
  );
}

function VendedorDashboard() {
  const { language } = useLanguage();
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Users} label={language === 'es' ? 'Clientes registrados' : 'Registered clients'} value="0" />
        <StatCard icon={FileText} label={language === 'es' ? 'Cotizaciones pendientes' : 'Pending quotes'} value="0" />
        <StatCard icon={TrendingUp} label={language === 'es' ? 'Diagnósticos este mes' : 'Diagnoses this month'} value="0" />
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 app-shadow">
        <div className="p-6 border-b border-gray-100">
          <h2 className="font-bold text-primary">{language === 'es' ? 'Clientes' : 'Clients'}</h2>
        </div>
        <EmptyState
          icon={Users}
          title={language === 'es' ? 'Sin clientes todavía' : 'No clients yet'}
          description={language === 'es'
            ? 'A medida que se registren marcas, las vas a ver listadas acá con su plan y estado.'
            : 'As brands sign up, you will see them listed here with their plan and status.'}
        />
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
