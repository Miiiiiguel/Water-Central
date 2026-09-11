import { useState, FormEvent } from 'react';
import { Link, useLocation } from 'wouter';
import { Mail, Lock, AlertTriangle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';

export default function Login() {
  const { language } = useLanguage();
  const { signIn, configured } = useAuth();
  const [, navigate] = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      setError(error);
      return;
    }
    navigate('/dashboard');
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
            {language === 'es' ? 'Bienvenido de nuevo' : 'Welcome back'}
          </h1>
          <p className="text-muted-foreground text-sm mb-6">
            {language === 'es' ? 'Ingresa a tu cuenta de Easycomex' : 'Sign in to your Easycomex account'}
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

          {error && (
            <div className="p-3 rounded-2xl bg-red-50 border border-red-100 text-xs text-red-700 mb-5">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
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
                  className="w-full pl-10 pr-4 py-3 rounded-2xl border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-accent hover:bg-accent/90 text-white py-6 font-bold border-0 app-shadow flex items-center justify-center gap-2"
            >
              {loading ? (language === 'es' ? 'Ingresando…' : 'Signing in…') : (language === 'es' ? 'Ingresar' : 'Sign in')}
              {!loading && <ArrowRight size={18} />}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            {language === 'es' ? '¿No tienes cuenta?' : "Don't have an account?"}{' '}
            <Link href="/registro" className="text-accent font-bold hover:underline">
              {language === 'es' ? 'Regístrate' : 'Sign up'}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
