import { useEffect, useRef, useState, FormEvent } from 'react';
import { Link, useLocation } from 'wouter';
import { Lock, AlertTriangle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { getSupabase } from '@/lib/supabase';

/**
 * El enlace de una invitación al casillero (ver server/casillero/invitar.ts):
 * /restablecer?token_hash=…&tipo=invite|recovery&destino=casillero. Se lee
 * una sola vez al cargar, antes de que se borre de la barra de direcciones.
 */
export function leerEnlaceToken(search: string): { tokenHash: string; tipo: 'invite' | 'recovery'; destino: '/casillero' | '/dashboard' } | null {
  const q = new URLSearchParams(search);
  const tokenHash = q.get('token_hash');
  const tipo = q.get('tipo');
  if (!tokenHash || !/^[A-Za-z0-9_-]{8,200}$/.test(tokenHash) || (tipo !== 'invite' && tipo !== 'recovery')) return null;
  return { tokenHash, tipo, destino: q.get('destino') === 'casillero' ? '/casillero' : '/dashboard' };
}

// Landing page for the password-recovery email. Supabase turns the link
// into a short-lived session; the user sets a new password here.
export default function ResetPassword() {
  const { language } = useLanguage();
  const { session, loading, updatePassword } = useAuth();
  const [, navigate] = useLocation();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [waited, setWaited] = useState(false);
  const [enlace] = useState(() => (typeof window === 'undefined' ? null : leerEnlaceToken(window.location.search)));
  const [canje, setCanje] = useState<'nada' | 'canjeando' | 'listo' | 'fallo'>(enlace ? 'canjeando' : 'nada');
  const invitacion = enlace?.tipo === 'invite' || enlace?.destino === '/casillero';

  useEffect(() => {
    const t = window.setTimeout(() => setWaited(true), 4000);
    return () => window.clearTimeout(t);
  }, []);

  // El enlace de invitación trae un token de un solo uso: se canjea por la
  // sesión y se quita de la barra de direcciones (no queda en el historial).
  // Un solo canje aunque el efecto corra dos veces (modo estricto de React):
  // el segundo intento con el mismo token fallaría y taparía al primero.
  const canjeado = useRef(false);
  useEffect(() => {
    if (!enlace || canjeado.current) return;
    canjeado.current = true;
    window.history.replaceState(null, '', window.location.pathname);
    void (async () => {
      const { error } = await (await getSupabase()).auth.verifyOtp({ token_hash: enlace.tokenHash, type: enlace.tipo });
      setCanje(error ? 'fallo' : 'listo');
    })();
  }, [enlace]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError(language === 'es' ? 'Mínimo 8 caracteres.' : 'At least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError(language === 'es' ? 'Las contraseñas no coinciden.' : 'Passwords do not match.');
      return;
    }
    setBusy(true);
    const { error } = await updatePassword(password);
    setBusy(false);
    if (error) {
      setError(error);
      return;
    }
    navigate(enlace?.destino ?? '/dashboard');
  };

  const linkInvalid = canje === 'fallo' || (canje !== 'canjeando' && !loading && !session && waited);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <Link href="/" className="flex justify-center mb-8">
          <span className="font-logo text-3xl tracking-tight">
            <span className="text-accent">easy</span>
            <span className="text-primary">comex</span>
          </span>
        </Link>
        <div className="bg-white rounded-3xl border border-gray-100 app-shadow p-8">
          <h1 className="text-2xl font-black text-primary mb-1">
            {invitacion
              ? language === 'es' ? 'Crea tu contraseña' : 'Create your password'
              : language === 'es' ? 'Nueva contraseña' : 'New password'}
          </h1>
          <p className="text-muted-foreground text-sm mb-6">
            {invitacion
              ? language === 'es'
                ? 'Con ella y tu correo entras a tu casillero de ahora en adelante. Mínimo 8 caracteres.'
                : 'From now on you sign in to your locker with it and your email. At least 8 characters.'
              : language === 'es' ? 'Elegí una contraseña de al menos 8 caracteres.' : 'Choose a password of at least 8 characters.'}
          </p>

          {linkInvalid && (
            <div className="flex items-start gap-2 p-3 rounded-2xl bg-orange-50 border border-orange-100 text-xs text-orange-800 mb-5">
              <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
              <span>
                {invitacion
                  ? language === 'es'
                    ? 'Este enlace ya se usó o venció. Pídele a Easycomex que te reenvíe la invitación, o en el ingreso usa "¿La olvidaste?" con tu correo.'
                    : 'This link was already used or has expired. Ask Easycomex to resend the invitation, or use "Forgot it?" on the login page with your email.'
                  : language === 'es'
                    ? 'El link no es válido o ya venció. Pedí uno nuevo desde "¿La olvidaste?" en el login.'
                    : 'This link is invalid or expired. Request a new one from "Forgot it?" on the login page.'}
              </span>
            </div>
          )}
          {error && <div className="p-3 rounded-2xl bg-red-50 border border-red-100 text-xs text-red-700 mb-5">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4">
            {[
              { value: password, set: setPassword, label: language === 'es' ? 'Contraseña' : 'Password' },
              { value: confirm, set: setConfirm, label: language === 'es' ? 'Confirmar' : 'Confirm' },
            ].map((field) => (
              <div key={field.label}>
                <label className="block text-sm font-semibold text-foreground mb-1.5">{field.label}</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    value={field.value}
                    onChange={(e) => field.set(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-2xl border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            ))}
            <Button type="submit" disabled={busy || !session || canje === 'canjeando'} className="tap-scale w-full rounded-full bg-accent hover:bg-accent/90 text-white py-6 font-bold border-0 app-shadow flex items-center justify-center gap-2">
              {busy ? (language === 'es' ? 'Guardando…' : 'Saving…') : (language === 'es' ? 'Guardar contraseña' : 'Save password')}
              {!busy && <ArrowRight size={18} />}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
