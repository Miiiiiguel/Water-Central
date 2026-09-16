import { useState, type ReactNode } from 'react';
import { Lock, Loader2, Flame, Check } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { isNative, openExternal } from '@/lib/native';
import { fmtMoney2 } from '@/lib/roiFormat';

/**
 * Wraps a paid report. When the account has already bought it the
 * content is shown outright; otherwise it is blurred behind the offer.
 *
 * "Unlocked" is decided by a paid row in public.payments, which only the
 * Stripe webhook can write — the blur is presentation, the payment is
 * the gate.
 */
export default function RoiPaywall({
  plan,
  unlocked,
  title,
  blurb,
  priceCents,
  oldPriceCents,
  children,
}: {
  plan: string;
  unlocked: boolean;
  title: string;
  blurb: string;
  priceCents: number;
  oldPriceCents: number;
  children: ReactNode;
}) {
  const { language } = useLanguage();
  const { getAccessToken, user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const es = language === 'es';

  const buy = async () => {
    setBusy(true);
    setError(null);
    try {
      const token = getAccessToken();
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ plan, platform: isNative ? 'native' : 'web' }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || 'checkout_failed');
      if (isNative) await openExternal(data.url);
      else window.location.href = data.url;
    } catch {
      setError(es ? 'Los pagos aún no están configurados en este entorno.' : 'Payments are not configured in this environment yet.');
    } finally {
      setBusy(false);
    }
  };

  if (unlocked) {
    return (
      <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white app-shadow">
        <div className="flex items-center gap-2 border-b border-gray-100 px-5 py-3">
          <Check size={16} className="text-green-600" />
          <span className="text-sm font-bold text-primary">{title}</span>
          <span className="ml-auto rounded-full bg-green-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-green-700">
            {es ? 'Desbloqueado' : 'Unlocked'}
          </span>
        </div>
        <div className="p-2">{children}</div>
      </div>
    );
  }

  const saving = (oldPriceCents - priceCents) / 100;

  return (
    <div className="relative overflow-hidden rounded-3xl border border-gray-100 bg-white">
      <div aria-hidden="true" className="select-none blur-[5px]" style={{ pointerEvents: 'none' }}>
        {children}
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-white/40 to-white/95 px-8 py-8 text-center">
        <span className="mb-3 flex h-13 w-13 items-center justify-center rounded-full bg-primary p-3.5 text-white">
          <Lock size={20} />
        </span>
        <h3 className="text-lg font-bold text-primary">{title}</h3>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">{blurb}</p>

        <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-orange-500 to-orange-400 px-3.5 py-1.5 text-[11px] font-extrabold uppercase tracking-wide text-white shadow-glow">
          <Flame size={12} />
          {es ? 'Oferta de lanzamiento' : 'Launch offer'}
        </span>

        <div className="mt-3 flex flex-wrap items-baseline justify-center gap-2.5">
          <span className="text-lg font-bold text-muted-foreground line-through decoration-accent">{fmtMoney2(oldPriceCents / 100)}</span>
          <span className="font-heading text-3xl font-black text-accent">
            {fmtMoney2(priceCents / 100)}
            <span className="ml-1 text-sm font-semibold text-muted-foreground">{es ? '/ reporte' : '/ report'}</span>
          </span>
        </div>
        <span className="mt-2 rounded-full bg-green-50 px-3 py-1 text-xs font-bold text-green-700">
          {es ? `Ahorras $${saving.toFixed(0)} — precio por tiempo limitado` : `Save $${saving.toFixed(0)} — limited-time price`}
        </span>

        <button
          onClick={buy}
          disabled={busy}
          className="tap-scale btn-shine mt-4 inline-flex cursor-pointer items-center gap-2 rounded-full border-0 bg-accent px-7 py-3.5 text-sm font-bold text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Lock size={14} />}
          {es ? 'Desbloquear ahora' : 'Unlock now'}
        </button>

        {!user && (
          <p className="mt-2 text-[11px] text-muted-foreground">
            {es ? 'Te pedimos el email en el pago para enviarte el reporte.' : 'We ask for your email at checkout so we can send you the report.'}
          </p>
        )}
        {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
      </div>
    </div>
  );
}
