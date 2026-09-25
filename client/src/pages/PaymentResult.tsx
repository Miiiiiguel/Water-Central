import { useEffect, useState } from 'react';
import { Link } from 'wouter';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, ArrowRight, MessageCircle, Loader2, Clock } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';

type Verification =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'paid'; plan: string | null; amountCents: number | null; currency: string | null }
  | { state: 'processing' }
  | { state: 'unknown' };

// La página a la que vuelve quien acaba de pagar — por Stripe o por
// Wompi.
//
// Antes de decir "gracias", le pregunta al servidor si ese pago existe:
// Stripe devuelve ?session_id=cs_…, Wompi devuelve ?id=<transacción>, y
// el servidor va a preguntarle a la pasarela. Una URL escrita a mano
// contesta "no pudimos confirmar", no "gracias".
//
// Y confirmar no es desbloquear: lo que da acceso es la fila en
// public.payments que escribe el webhook (o esta confirmación ya
// verificada contra la pasarela), nunca esta pantalla.
export default function PaymentResult({ status }: { status: 'success' | 'cancelled' }) {
  const { language } = useLanguage();
  const { user } = useAuth();
  const ok = status === 'success';
  const es = language === 'es';
  // Set by the server when Checkout was opened from the native app's
  // system browser: the user's next step is simply to go back to the app.
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const fromApp = params.get('native') === '1';
  const sessionId = params.get('session_id');
  // Wompi vuelve con el id de la transacción; Stripe con el de la sesión.
  const wompiTx = params.get('id');

  const [verification, setVerification] = useState<Verification>({ state: ok && (sessionId || wompiTx) ? 'checking' : 'idle' });

  useEffect(() => {
    if (!ok || (!sessionId && !wompiTx)) return;
    let cancelled = false;
    let attempt = 0;

    const ask = async (): Promise<Response> =>
      sessionId
        ? fetch(`/api/checkout-session/${encodeURIComponent(sessionId)}`)
        : fetch('/api/checkout/confirm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transactionId: wompiTx }),
          });

    const check = async () => {
      attempt += 1;
      try {
        const res = await ask();
        if (cancelled) return;
        if (res.status === 503) return setVerification({ state: 'idle' }); // la pasarela no está configurada acá
        if (!res.ok) return setVerification({ state: 'unknown' });
        const data = await res.json();
        if (data.paid) {
          setVerification({ state: 'paid', plan: data.planLabel ?? data.plan ?? null, amountCents: data.amountCents ?? null, currency: data.currency ?? null });
        } else if (attempt < 3) {
          // Tarjeta es instantáneo; PSE, Nequi y los vouchers tardan un
          // momento en pasar a pagado. Dos intentos más.
          setVerification({ state: 'checking' });
          window.setTimeout(check, 2500);
        } else {
          setVerification({ state: 'processing' });
        }
      } catch {
        if (!cancelled) setVerification({ state: 'unknown' });
      }
    };

    check();
    return () => { cancelled = true; };
  }, [ok, sessionId, wompiTx]);

  const money =
    verification.state === 'paid' && verification.amountCents != null
      ? new Intl.NumberFormat(es ? 'es-CO' : 'en-US', { style: 'currency', currency: (verification.currency ?? 'usd').toUpperCase() }).format(verification.amountCents / 100)
      : null;

  const checking = verification.state === 'checking';
  const processing = verification.state === 'processing';
  const unknown = verification.state === 'unknown';
  const good = ok && !processing && !unknown;

  const title = !ok
    ? es ? 'Pago cancelado' : 'Payment cancelled'
    : checking
      ? es ? 'Confirmando tu pago…' : 'Confirming your payment…'
      : processing
        ? es ? 'Tu pago se está procesando' : 'Your payment is processing'
        : unknown
          ? es ? 'No pudimos confirmar este pago' : "We couldn't confirm this payment"
          : es ? '¡Pago recibido!' : 'Payment received!';

  const body = !ok
    ? es
      ? 'No se realizó ningún cobro. Si tuviste algún problema o querés hablar antes de decidir, escribinos.'
      : 'You were not charged. If something went wrong or you want to talk before deciding, message us.'
    : checking
      ? es ? 'Estamos verificando la transacción con la pasarela. Toma unos segundos.' : 'We are verifying the transaction with the payment provider. This takes a few seconds.'
      : processing
        ? es
          ? 'Tu medio de pago necesita unos minutos para acreditarse. Apenas se confirme te llega el email y el plan aparece en tu dashboard, sin que tengas que hacer nada.'
          : 'Your payment method needs a few minutes to clear. As soon as it confirms you get an email and the plan appears in your dashboard — nothing else to do.'
        : unknown
          ? es
            ? 'Si acabás de pagar, revisá tu email: la pasarela envía el recibo al confirmar. Si no, escribinos y lo verificamos con vos.'
            : 'If you just paid, check your email: the payment provider sends the receipt on confirmation. Otherwise message us and we will check it with you.'
          : es
            ? 'Gracias. Te enviamos la confirmación a tu email y nuestro equipo te contacta en menos de 24 horas para arrancar.'
            : 'Thank you. We sent a confirmation to your email and our team will reach out within 24 hours to get started.';

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 py-16">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md text-center"
      >
        <Link href="/" className="inline-block font-logo text-3xl tracking-tight mb-10">
          <span className="text-accent">easy</span>
          <span className="text-primary">comex</span>
        </Link>

        <div className="bg-white rounded-3xl border border-gray-100 app-shadow p-8 md:p-10">
          <div
            className={`w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center ${
              good ? 'bg-green-50 text-green-600' : processing || checking ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-accent'
            }`}
          >
            {checking ? <Loader2 size={36} className="animate-spin" /> : processing ? <Clock size={38} /> : good ? <CheckCircle2 size={40} /> : <XCircle size={40} />}
          </div>

          <h1 className="text-2xl md:text-3xl font-black text-primary mb-3">{title}</h1>

          {verification.state === 'paid' && (verification.plan || money) && (
            <div className="inline-flex flex-col items-center gap-1 px-4 py-3 mb-5 rounded-2xl bg-green-50 border border-green-100">
              {verification.plan && <span className="text-sm font-bold text-green-900">{verification.plan}</span>}
              {money && <span className="text-xl font-black text-green-700">{money}</span>}
            </div>
          )}

          <p className="text-muted-foreground leading-relaxed mb-8">{body}</p>

          {fromApp && (
            <div className="p-3 rounded-2xl bg-orange-50 border border-orange-100 text-sm text-orange-900 mb-6">
              {es
                ? 'Ya podés cerrar esta ventana y volver a la app de Easycomex — tu dashboard se actualiza solo.'
                : 'You can close this window and go back to the Easycomex app — your dashboard updates on its own.'}
            </div>
          )}

          <div className="flex flex-col gap-3">
            {ok ? (
              <Link
                href={user ? '/dashboard' : '/registro'}
                className="tap-scale inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-accent hover:bg-accent/90 text-white font-bold transition-colors"
              >
                {user
                  ? (es ? 'Ir a mi dashboard' : 'Go to my dashboard')
                  : (es ? 'Crear mi cuenta para seguir el avance' : 'Create my account to track progress')}
                <ArrowRight size={18} />
              </Link>
            ) : (
              <Link
                href="/#planes"
                className="tap-scale inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-accent hover:bg-accent/90 text-white font-bold transition-colors"
              >
                {es ? 'Volver a los planes' : 'Back to plans'}
                <ArrowRight size={18} />
              </Link>
            )}
            <a
              href="https://api.whatsapp.com/send/?phone=573136380121"
              target="_blank"
              rel="noopener noreferrer"
              className="tap-scale-sm inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full border border-gray-200 hover:bg-gray-50 text-sm font-bold text-foreground transition-colors"
            >
              <MessageCircle size={16} />
              {es ? 'Hablar por WhatsApp' : 'Chat on WhatsApp'}
            </a>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
