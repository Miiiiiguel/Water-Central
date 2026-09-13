import { Link } from 'wouter';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, ArrowRight, MessageCircle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';

// Landing pages Stripe redirects back to. Deliberately informational
// only: the real confirmation is the webhook writing public.payments —
// anyone can type this URL, so nothing here grants access to anything.
export default function PaymentResult({ status }: { status: 'success' | 'cancelled' }) {
  const { language } = useLanguage();
  const { user } = useAuth();
  const ok = status === 'success';

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
              ok ? 'bg-green-50 text-green-600' : 'bg-orange-50 text-accent'
            }`}
          >
            {ok ? <CheckCircle2 size={40} /> : <XCircle size={40} />}
          </div>

          <h1 className="text-2xl md:text-3xl font-black text-primary mb-3">
            {ok
              ? (language === 'es' ? '¡Pago recibido!' : 'Payment received!')
              : (language === 'es' ? 'Pago cancelado' : 'Payment cancelled')}
          </h1>
          <p className="text-muted-foreground leading-relaxed mb-8">
            {ok
              ? (language === 'es'
                  ? 'Gracias. Te enviamos la confirmación a tu email y nuestro equipo te contacta en menos de 24 horas para arrancar.'
                  : 'Thank you. We sent a confirmation to your email and our team will reach out within 24 hours to get started.')
              : (language === 'es'
                  ? 'No se realizó ningún cobro. Si tuviste algún problema o querés hablar antes de decidir, escribinos.'
                  : 'You were not charged. If something went wrong or you want to talk before deciding, message us.')}
          </p>

          <div className="flex flex-col gap-3">
            {ok ? (
              <Link
                href={user ? '/dashboard' : '/registro'}
                className="tap-scale inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-accent hover:bg-accent/90 text-white font-bold transition-colors"
              >
                {user
                  ? (language === 'es' ? 'Ir a mi dashboard' : 'Go to my dashboard')
                  : (language === 'es' ? 'Crear mi cuenta para seguir el avance' : 'Create my account to track progress')}
                <ArrowRight size={18} />
              </Link>
            ) : (
              <Link
                href="/#planes"
                className="tap-scale inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-accent hover:bg-accent/90 text-white font-bold transition-colors"
              >
                {language === 'es' ? 'Volver a los planes' : 'Back to plans'}
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
              {language === 'es' ? 'Hablar por WhatsApp' : 'Chat on WhatsApp'}
            </a>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
