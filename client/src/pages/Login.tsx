import { useState, FormEvent } from 'react';
import { Link, useLocation } from 'wouter';
import { Mail, Lock, AlertTriangle, ArrowRight, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import GoogleButton from '@/components/GoogleButton';
import MfaChallenge from '@/components/MfaChallenge';
import { getMfaStatus } from '@/lib/mfa';

type Mode = 'login' | 'forgot' | 'mfa';

export default function Login() {
  const { language } = useLanguage();
  const { signIn, resetPassword, configured } = useAuth();
  const [, navigate] = useLocation();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error } = await signIn(email, password);
      if (error) {
        // Same message for wrong email and wrong password: no account enumeration.
        setError(language === 'es' ? 'Email o contraseña incorrectos.' : 'Incorrect email or password.');
        return;
      }
      // Si la consulta de MFA falla, entrar igual: la sesión ya es válida
      // y el servidor exige aal2 por su cuenta donde hace falta.
      const status = await getMfaStatus().catch(() => ({ required: false }));
      if (status.required) {
        setMode('mfa');
        return;
      }
      navigate('/dashboard');
    } catch (err) {
      console.error('[login] falló sin avisar:', err);
      setError(language === 'es' ? 'No pudimos entrar. Intenta de nuevo.' : 'We could not sign in. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await resetPassword(email);
    setLoading(false);
    if (error) {
      setError(error);
      return;
    }
    // Always the same message, whether or not the email exists.
    setNotice(language === 'es'
      ? 'Si ese email tiene una cuenta, te enviamos un link para restablecer la contraseña. Vence en 1 hora.'
      : 'If that email has an account, we sent a link to reset your password. It expires in 1 hour.');
  };

  if (mode === 'mfa') {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-4 py-16">
        <MfaChallenge onSuccess={() => navigate('/dashboard')} />
      </div>
    );
  }

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
            {mode === 'forgot'
              ? (language === 'es' ? 'Restablecer contraseña' : 'Reset password')
              : (language === 'es' ? 'Bienvenido de nuevo' : 'Welcome back')}
          </h1>
          <p className="text-muted-foreground text-sm mb-6">
            {mode === 'forgot'
              ? (language === 'es' ? 'Te enviamos un link a tu email.' : "We'll email you a link.")
              : (language === 'es' ? 'Ingresa a tu cuenta de Easycomex' : 'Sign in to your Easycomex account')}
          </p>

          {!configured && (
            <div className="flex items-start gap-2 p-3 rounded-2xl bg-orange-50 border border-orange-100 text-xs text-orange-800 mb-5">
              <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
              <span>
                {language === 'es'
                  ? 'Supabase aún no está configurado en este entorno (faltan las variables VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY). El login no funcionará hasta agregarlas.'
                  : 'Supabase is not configured in this environment yet (missing VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY). Login won\'t work until they are added.'}
              </span>
            </div>
          )}

          {error && <div className="p-3 rounded-2xl bg-red-50 border border-red-100 text-xs text-red-700 mb-5">{error}</div>}
          {notice && (
            <div className="flex items-start gap-2 p-3 rounded-2xl bg-green-50 border border-green-100 text-xs text-green-700 mb-5">
              <CheckCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{notice}</span>
            </div>
          )}

          {mode === 'login' && <GoogleButton onError={setError} />}

          <form onSubmit={mode === 'forgot' ? handleForgot : handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-2xl border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all"
                  placeholder="tu@email.com"
                />
              </div>
            </div>
            {mode === 'login' && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-semibold text-foreground">
                    {language === 'es' ? 'Contraseña' : 'Password'}
                  </label>
                  <button type="button" onClick={() => { setMode('forgot'); setError(null); }} className="text-xs font-semibold text-accent hover:underline bg-transparent border-0 cursor-pointer">
                    {language === 'es' ? '¿La olvidaste?' : 'Forgot it?'}
                  </button>
                </div>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 rounded-2xl border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="tap-scale w-full rounded-full bg-accent hover:bg-accent/90 text-white py-6 font-bold border-0 app-shadow flex items-center justify-center gap-2"
            >
              {mode === 'forgot'
                ? (loading ? (language === 'es' ? 'Enviando…' : 'Sending…') : (language === 'es' ? 'Enviar link' : 'Send link'))
                : (loading ? (language === 'es' ? 'Ingresando…' : 'Signing in…') : (language === 'es' ? 'Ingresar' : 'Sign in'))}
              {!loading && <ArrowRight size={18} />}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            {mode === 'forgot' ? (
              <button onClick={() => { setMode('login'); setNotice(null); setError(null); }} className="text-accent font-bold hover:underline bg-transparent border-0 cursor-pointer">
                {language === 'es' ? 'Volver a ingresar' : 'Back to sign in'}
              </button>
            ) : (
              <>
                {language === 'es' ? '¿No tienes cuenta?' : "Don't have an account?"}{' '}
                <Link href="/registro" className="text-accent font-bold hover:underline">
                  {language === 'es' ? 'Regístrate' : 'Sign up'}
                </Link>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
