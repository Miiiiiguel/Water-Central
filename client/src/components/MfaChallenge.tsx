import { useState, FormEvent } from 'react';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { completeMfaChallenge } from '@/lib/mfa';

// Six-digit code prompt shown when an account with 2FA signs in.
export default function MfaChallenge({ onSuccess }: { onSuccess: () => void }) {
  const { language } = useLanguage();
  const { refreshMfa, signOut } = useAuth();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await completeMfaChallenge(code);
      await refreshMfa();
      onSuccess();
    } catch (err) {
      setError(language === 'es' ? 'Código incorrecto o vencido. Probá con el siguiente.' : 'Wrong or expired code. Try the next one.');
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-gray-100 app-shadow p-8 w-full max-w-md mx-auto">
      <div className="w-12 h-12 rounded-2xl bg-secondary text-accent flex items-center justify-center mb-4">
        <ShieldCheck size={22} />
      </div>
      <h1 className="text-xl font-black text-primary mb-1">
        {language === 'es' ? 'Verificación en dos pasos' : 'Two-step verification'}
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        {language === 'es'
          ? 'Ingresá el código de 6 dígitos de tu app de autenticación.'
          : 'Enter the 6-digit code from your authenticator app.'}
      </p>
      {error && <div className="p-3 rounded-2xl bg-red-50 border border-red-100 text-xs text-red-700 mb-4">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]*"
          maxLength={7}
          required
          autoFocus
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="w-full text-center text-2xl tracking-[0.5em] font-bold px-4 py-3 rounded-2xl border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none transition-all"
          placeholder="000000"
        />
        <Button type="submit" disabled={loading || code.replace(/\s/g, '').length < 6} className="tap-scale w-full rounded-full bg-accent hover:bg-accent/90 text-white py-6 font-bold border-0">
          {loading ? <Loader2 size={18} className="animate-spin" /> : language === 'es' ? 'Verificar' : 'Verify'}
        </Button>
      </form>
      <button onClick={() => signOut()} className="mt-4 w-full text-xs text-muted-foreground hover:text-accent bg-transparent border-0 cursor-pointer">
        {language === 'es' ? 'Cancelar y cerrar sesión' : 'Cancel and sign out'}
      </button>
    </div>
  );
}
