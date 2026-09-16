import { useState, FormEvent } from 'react';
import { Link, useLocation } from 'wouter';
import { Mail, Lock, User, Building2, AlertTriangle, ArrowRight, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import GoogleButton from '@/components/GoogleButton';

export default function Register() {
  const { language } = useLanguage();
  const { signUp, configured } = useAuth();
  const [, navigate] = useLocation();
  const [fullName, setFullName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(language === 'es' ? 'Las contraseñas no coinciden.' : 'Passwords do not match.');
      return;
    }
    if (password.length < 8 || !/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
      setError(language === 'es' ? 'La contraseña debe tener al menos 8 caracteres, con letras y números.' : 'Password must be at least 8 characters, with letters and numbers.');
      return;
    }

    setLoading(true);
    // `finally` y no una línea suelta: si algo lanza, el botón tiene que
    // dejar de girar igual. Un "Creando cuenta…" eterno no le dice a
    // nadie si su cuenta se creó o no.
    let result: { error: string | null };
    try {
      result = await signUp(email, password, fullName, company);
    } catch (err) {
      console.error('[registro] falló sin avisar:', err);
      result = { error: language === 'es' ? 'No pudimos crear la cuenta. Intenta de nuevo.' : 'We could not create the account. Try again.' };
    } finally {
      setLoading(false);
    }

    if (result.error) {
      setError(result.error);
      return;
    }
    setSuccess(true);
    setTimeout(() => navigate('/dashboard'), 1200);
  };

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
            {language === 'es' ? 'Crea tu cuenta' : 'Create your account'}
          </h1>
          <p className="text-muted-foreground text-sm mb-6">
            {language === 'es' ? 'Empieza a vender afuera con Easycomex' : 'Start selling abroad with Easycomex'}
          </p>

          {!configured && (
            <div className="flex items-start gap-2 p-3 rounded-2xl bg-orange-50 border border-orange-100 text-xs text-orange-800 mb-5">
              <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
              <span>
                {language === 'es'
                  ? 'Supabase aún no está configurado en este entorno. El registro no funcionará hasta agregar las variables de entorno.'
                  : 'Supabase is not configured in this environment yet. Sign up won\'t work until the env vars are added.'}
              </span>
            </div>
          )}

          {success && (
            <div className="flex items-start gap-2 p-3 rounded-2xl bg-green-50 border border-green-100 text-xs text-green-700 mb-5">
              <CheckCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>
                {language === 'es'
                  ? '¡Cuenta creada! Si tu proyecto requiere confirmación por email, revisa tu bandeja de entrada.'
                  : 'Account created! If your project requires email confirmation, check your inbox.'}
              </span>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-2xl bg-red-50 border border-red-100 text-xs text-red-700 mb-5">
              {error}
            </div>
          )}

          <GoogleButton onError={setError} />

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">
                {language === 'es' ? 'Nombre completo' : 'Full name'}
              </label>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-2xl border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all"
                  placeholder={language === 'es' ? 'Tu nombre' : 'Your name'}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">
                {language === 'es' ? 'Marca / Empresa' : 'Brand / Company'}
              </label>
              <div className="relative">
                <Building2 size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  required
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-2xl border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all"
                  placeholder={language === 'es' ? 'Tu marca' : 'Your brand'}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">Email</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-2xl border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all"
                  placeholder="tu@email.com"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">
                  {language === 'es' ? 'Contraseña' : 'Password'}
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-3 py-3 rounded-2xl border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all"
                    placeholder="••••••••"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">
                  {language === 'es' ? 'Confirmar' : 'Confirm'}
                </label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-3 rounded-2xl border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="tap-scale w-full rounded-full bg-accent hover:bg-accent/90 text-white py-6 font-bold border-0 app-shadow flex items-center justify-center gap-2"
            >
              {loading ? (language === 'es' ? 'Creando cuenta…' : 'Creating account…') : (language === 'es' ? 'Crear cuenta' : 'Create account')}
              {!loading && <ArrowRight size={18} />}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            {language === 'es' ? '¿Ya tienes cuenta?' : 'Already have an account?'}{' '}
            <Link href="/login" className="text-accent font-bold hover:underline">
              {language === 'es' ? 'Ingresa' : 'Sign in'}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
