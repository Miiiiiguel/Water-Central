import { useEffect, useState, FormEvent } from 'react';
import { ShieldCheck, ShieldOff, Loader2, Copy, Check } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { getMfaStatus, startTotpEnrollment, verifyTotp, disableTotp } from '@/lib/mfa';

// "Seguridad de la cuenta" card in the dashboard: turn TOTP 2FA on/off.
export default function MfaSetup() {
  const { language } = useLanguage();
  const { refreshMfa } = useAuth();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [enrollment, setEnrollment] = useState<{ factorId: string; qrCode: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = () => getMfaStatus().then((s) => setEnabled(s.enrolled)).catch(() => setEnabled(false));
  useEffect(() => {
    load();
  }, []);

  const begin = async () => {
    setError(null);
    setBusy(true);
    try {
      setEnrollment(await startTotpEnrollment());
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  };

  const confirm = async (e: FormEvent) => {
    e.preventDefault();
    if (!enrollment) return;
    setError(null);
    setBusy(true);
    try {
      await verifyTotp(enrollment.factorId, code);
      setEnrollment(null);
      setCode('');
      setEnabled(true);
      await refreshMfa();
    } catch {
      setError(language === 'es' ? 'Código incorrecto. Revisá la hora del teléfono y probá de nuevo.' : 'Wrong code. Check your phone clock and try again.');
    }
    setBusy(false);
  };

  const disable = async () => {
    if (!window.confirm(language === 'es' ? '¿Desactivar la verificación en dos pasos?' : 'Turn off two-step verification?')) return;
    setBusy(true);
    try {
      await disableTotp();
      setEnabled(false);
      await refreshMfa();
    } catch (err) {
      setError((err as Error).message);
    }
    setBusy(false);
  };

  const copySecret = async () => {
    if (!enrollment) return;
    try {
      await navigator.clipboard.writeText(enrollment.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-gray-100 app-shadow">
      <div className="p-6 border-b border-gray-100 flex items-center gap-3">
        <span className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${enabled ? 'bg-green-50 text-green-600' : 'bg-secondary text-accent'}`}>
          {enabled ? <ShieldCheck size={18} /> : <ShieldOff size={18} />}
        </span>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-primary">{language === 'es' ? 'Seguridad de la cuenta' : 'Account security'}</h2>
          <p className="text-xs text-muted-foreground">
            {enabled === null
              ? '…'
              : enabled
                ? (language === 'es' ? 'Verificación en dos pasos activada' : 'Two-step verification is on')
                : (language === 'es' ? 'Verificación en dos pasos desactivada' : 'Two-step verification is off')}
          </p>
        </div>
        {enabled === true && (
          <button onClick={disable} disabled={busy} className="tap-scale-sm text-xs font-semibold text-muted-foreground hover:text-red-600 bg-transparent border-0 cursor-pointer disabled:opacity-50">
            {language === 'es' ? 'Desactivar' : 'Turn off'}
          </button>
        )}
        {enabled === false && !enrollment && (
          <button onClick={begin} disabled={busy} className="tap-scale-sm px-4 py-2 rounded-full bg-accent hover:bg-accent/90 text-white text-xs font-bold border-0 cursor-pointer disabled:opacity-50 flex items-center gap-2">
            {busy ? <Loader2 size={14} className="animate-spin" /> : null}
            {language === 'es' ? 'Activar' : 'Turn on'}
          </button>
        )}
      </div>

      {error && <div className="mx-6 mt-4 p-3 rounded-2xl bg-red-50 border border-red-100 text-xs text-red-700">{error}</div>}

      {enrollment && (
        <form onSubmit={confirm} className="p-6 grid gap-6 md:grid-cols-[auto_1fr] items-start">
          <img src={enrollment.qrCode} alt="QR" className="w-40 h-40 rounded-2xl border border-gray-100 bg-white p-2" />
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {language === 'es'
                ? 'Escaneá el código con Google Authenticator, 1Password, Authy o similar. Si no podés escanear, ingresá esta clave a mano:'
                : "Scan the code with Google Authenticator, 1Password, Authy or similar. If you can't scan, enter this key manually:"}
            </p>
            <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-2">
              <code className="flex-1 text-xs break-all px-2">{enrollment.secret}</code>
              <button type="button" onClick={copySecret} className="p-2 rounded-lg hover:bg-gray-200 bg-transparent border-0 cursor-pointer text-muted-foreground" aria-label="Copiar">
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
            <div className="flex gap-2">
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={7}
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="000000"
                className="flex-1 text-center tracking-[0.4em] font-bold px-4 py-2.5 rounded-xl border border-gray-200 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none"
              />
              <button type="submit" disabled={busy || code.replace(/\s/g, '').length < 6} className="tap-scale px-5 py-2.5 rounded-xl bg-accent hover:bg-accent/90 text-white text-sm font-bold border-0 cursor-pointer disabled:opacity-50">
                {busy ? <Loader2 size={16} className="animate-spin" /> : language === 'es' ? 'Confirmar' : 'Confirm'}
              </button>
            </div>
          </div>
        </form>
      )}

      {enabled === false && !enrollment && (
        <p className="px-6 pb-6 pt-4 text-xs text-muted-foreground">
          {language === 'es'
            ? 'Con esto, aunque alguien consiga tu contraseña, no puede entrar sin el código de tu teléfono. Muy recomendado para el equipo.'
            : "With this on, even someone with your password can't get in without the code on your phone. Strongly recommended for the team."}
        </p>
      )}
    </div>
  );
}
