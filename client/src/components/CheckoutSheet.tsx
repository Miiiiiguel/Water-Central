import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Loader2, Lock, ShieldCheck, X, Sparkles } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';

export interface CheckoutItem {
  plan: string;
  title: string;
  features: string[];
  /** Fallback price copy used until Stripe is connected. */
  priceLabel: string;
}

/**
 * Order summary shown before handing off to Stripe Checkout.
 *
 * Three reasons it exists:
 *  - the buyer sees exactly what they get and what it costs before a
 *    payment page opens (fewer abandoned checkouts, fewer chargebacks);
 *  - the amount comes from Stripe itself (`GET /api/plans`), so the page
 *    can never advertise a price different from the one charged;
 *  - it states, in the purchase flow, that the service is delivered by
 *    the team outside the app — which is exactly what Apple guideline
 *    3.1.3(e) and Google's services policy ask you to make clear.
 */
export default function CheckoutSheet({
  item,
  open,
  busy,
  error,
  onConfirm,
  onClose,
}: {
  item: CheckoutItem | null;
  open: boolean;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const { language } = useLanguage();
  const es = language === 'es';
  const [livePrice, setLivePrice] = useState<string | null>(null);

  // Real price from Stripe. Silent no-op until the keys are connected.
  useEffect(() => {
    if (!open || !item) return;
    let cancelled = false;
    fetch('/api/plans')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data?.configured) return;
        const match = (data.plans ?? []).find((p: { id: string }) => p.id === item.plan);
        if (match?.amountCents != null) {
          const formatted = new Intl.NumberFormat(es ? 'es-CO' : 'en-US', {
            style: 'currency',
            currency: (match.currency ?? 'usd').toUpperCase(),
          }).format(match.amountCents / 100);
          setLivePrice(match.interval ? `${formatted} / ${es ? 'mes' : 'month'}` : formatted);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [open, item, es]);

  // Close on Escape and on the Android back button, like a native sheet.
  //
  // The handlers are read through a ref and the effect depends only on
  // `open`: taking `onClose`/`busy` as dependencies would re-run it on
  // every parent render, pushing a history entry each time and leaving
  // the sheet impossible to close with one "back".
  const handlers = useRef({ busy, onClose });
  handlers.current = { busy, onClose };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !handlers.current.busy) handlers.current.onClose(); };
    const onPop = () => handlers.current.onClose();
    window.addEventListener('keydown', onKey);
    window.history.pushState({ ...(window.history.state ?? {}), checkoutSheet: true }, '');
    window.addEventListener('popstate', onPop);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('popstate', onPop);
      document.body.style.overflow = previousOverflow;
      if (window.history.state?.checkoutSheet) window.history.back();
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && item && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] bg-primary/60 backdrop-blur-sm"
            onClick={() => !busy && onClose()}
            aria-hidden="true"
          />
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.98 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            role="dialog"
            aria-modal="true"
            aria-label={es ? 'Resumen de compra' : 'Order summary'}
            className="fixed z-[61] inset-x-0 bottom-0 sm:inset-0 sm:m-auto sm:h-fit sm:max-w-md w-full bg-white rounded-t-3xl sm:rounded-3xl app-shadow border border-gray-100 overflow-hidden pb-[env(safe-area-inset-bottom)]"
          >
            {/* Drag handle (mobile affordance) */}
            <div className="sm:hidden pt-3 pb-1 flex justify-center">
              <span className="w-10 h-1.5 rounded-full bg-gray-200" />
            </div>

            <div className="relative px-6 pt-4 pb-5 bg-gradient-to-br from-primary via-indigo-950 to-primary text-white">
              <div className="absolute -top-12 -right-10 w-40 h-40 bg-accent/30 rounded-full blur-3xl pointer-events-none" />
              <button
                type="button"
                onClick={() => !busy && onClose()}
                aria-label={es ? 'Cerrar' : 'Close'}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center border-0 cursor-pointer transition-colors"
              >
                <X size={16} />
              </button>
              <span className="relative inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-orange-200">
                <Sparkles size={12} />
                {es ? 'Resumen de tu compra' : 'Order summary'}
              </span>
              <h3 className="relative text-xl font-black mt-2 pr-8 leading-snug">{item.title}</h3>
              <p className="relative text-3xl font-black text-orange-300 mt-3">{livePrice ?? item.priceLabel}</p>
            </div>

            <div className="px-6 py-5">
              <ul className="space-y-2.5 mb-5">
                {item.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <Check size={16} className="text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-sm text-muted-foreground leading-relaxed">{f}</span>
                  </li>
                ))}
              </ul>

              <div className="rounded-2xl bg-secondary/60 border border-gray-100 p-3.5 mb-5 space-y-2">
                <p className="flex items-center gap-2 text-xs font-semibold text-primary">
                  <ShieldCheck size={14} className="text-accent flex-shrink-0" />
                  {es
                    ? 'Servicio entregado por nuestro equipo fuera de la app (informe y sesiones).'
                    : 'Service delivered by our team outside the app (report and sessions).'}
                </p>
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Lock size={14} className="text-accent flex-shrink-0" />
                  {es
                    ? 'Pago procesado por Stripe. Easycomex nunca ve ni guarda tu tarjeta.'
                    : 'Payment processed by Stripe. Easycomex never sees or stores your card.'}
                </p>
              </div>

              {error && <p className="text-xs text-red-500 mb-3 text-center">{error}</p>}

              <Button
                onClick={onConfirm}
                disabled={busy}
                className="tap-scale btn-shine w-full rounded-full bg-accent hover:bg-accent/90 text-white border-0 py-6 text-base font-bold flex items-center justify-center gap-2"
              >
                {busy ? <Loader2 size={18} className="animate-spin" /> : <Lock size={16} />}
                {busy
                  ? (es ? 'Abriendo pago seguro…' : 'Opening secure checkout…')
                  : (es ? 'Pagar de forma segura' : 'Pay securely')}
              </Button>
              <button
                type="button"
                onClick={() => !busy && onClose()}
                className="tap-scale-sm w-full mt-2.5 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground bg-transparent border-0 cursor-pointer"
              >
                {es ? 'Cancelar' : 'Cancel'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
