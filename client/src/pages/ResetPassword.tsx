import { useEffect, useState, FormEvent } from 'react';
import { Link, useLocation } from 'wouter';
import { Lock, AlertTriangle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

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

  useEffect(() => {
    const t = window.setTimeout(() => setWaited(true), 4000);
    return () => window.clearTimeout(t);
  }, []);

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
    navigate('/dashboard');
  };

  const linkInvalid = !loading && !session && waited;

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
            {language === 'es' ? 'Nueva contraseña' : 'New password'}
          </h1>
          <p className="text-muted-foreground text-sm mb-6">
            {language === 'es' ? 'Elegí una contraseña de al menos 8 caracteres.' : 'Choose a password of at least 8 characters.'}
          </p>

          {linkInvalid && (
            <div className="flex items-start gap-2 p-3 rounded-2xl bg-orange-50 border border-orange-100 text-xs text-orange-800 mb-5">
              <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
              <span>
                {language === 'es'
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
            <Button type="submit" disabled={busy || !session} className="tap-scale w-full rounded-full bg-accent hover:bg-accent/90 text-white py-6 font-bold border-0 app-shadow flex items-center justify-center gap-2">
              {busy ? (language === 'es' ? 'Guardando…' : 'Saving…') : (language === 'es' ? 'Guardar contraseña' : 'Save password')}
              {!busy && <ArrowRight size={18} />}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
